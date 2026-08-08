import { prisma, type OrderKind } from "@a4a/db";
import { getProviderForMethod, type PaymentMethodId } from "@a4a/payments";
import { removeUpload } from "@/lib/uploads";
import { sendEmail } from "@/lib/email";
import { trouverPack } from "@/lib/packs";
import { ouvrirAbonnement } from "@/lib/intelligence";
import { annulerInscription, confirmerInscription } from "@/lib/events";
import { TARIFS_EMPLOI, TARIFS_IMMO, TARIFS_WHATSAPP, formatFCFA, trouverPalier, type PalierAnnonce } from "@/lib/tarifs";

/**
 * Palier tarifaire d'une commande. Les packs publicitaires viennent de la base
 * (grille éditable au Studio) ; les autres grilles restent dans lib/tarifs.ts.
 */
async function palierPourOrder(kind: OrderKind, tierId: string): Promise<PalierAnnonce | undefined> {
  if (kind === "ad_reservation") return trouverPack(tierId);
  if (kind === "brief_abonnement") {
    // A4A Intelligence : le « palier » est la série elle-même (tier = son id).
    const serie = await prisma.briefSerie.findUnique({ where: { id: tierId } });
    if (!serie) return undefined;
    return {
      id: serie.id,
      label: serie.title,
      prix: serie.prixAnnuel,
      jours: Math.round(serie.dureeMois * 30.4), // informatif : la durée réelle est en mois
      description: serie.pitch,
    };
  }
  if (kind === "event_ticket") {
    // Billetterie : le « palier » est la catégorie de billet (tier = son id).
    const billet = await prisma.eventTicket.findUnique({
      where: { id: tierId },
      include: { event: { select: { title: true } } },
    });
    if (!billet) return undefined;
    return {
      id: billet.id,
      label: `${billet.event.title} — ${billet.label}`,
      prix: billet.prix,
      jours: 0, // sans objet : un billet ne court pas sur une durée
      description: billet.description,
    };
  }
  const grille = kind === "listing_emploi" ? TARIFS_EMPLOI : kind === "listing_immobilier" ? TARIFS_IMMO : TARIFS_WHATSAPP;
  return trouverPalier(grille, tierId);
}

export type StartOrderResult =
  /** `orderId` permet à l'appelant de rattacher son objet métier à la commande. */
  { ok: true; checkoutUrl: string; orderId: string } | { ok: false; error: string };

/**
 * Démarre le paiement d'une commande one-off (dépôt d'annonce payant, adhésion
 * WhatsApp Club). Crée un Order `pending`, ouvre une session chez le prestataire
 * et renvoie l'URL de paiement. Totalement séparé de Subscription/Payment.
 */
export async function startOrderCheckout(params: {
  userId: string;
  email: string;
  kind: OrderKind;
  tierId: string;
  method: PaymentMethodId;
  listingId?: string;
  campaignId?: string;
}): Promise<StartOrderResult> {
  const palier = await palierPourOrder(params.kind, params.tierId);
  if (!palier) return { ok: false, error: "Formule invalide." };

  const compte = await prisma.user.findUnique({ where: { id: params.userId }, select: { id: true } });
  if (!compte) return { ok: false, error: "Compte introuvable." };

  const provider = getProviderForMethod(params.method);
  const order = await prisma.order.create({
    data: {
      userId: params.userId,
      kind: params.kind,
      tier: palier.id,
      amount: palier.prix,
      currency: "XOF",
      provider: provider.id,
      providerRef: "",
      status: "pending",
      listingId: params.listingId ?? null,
      campaignId: params.campaignId ?? null,
    },
  });

  const session = await provider.createCheckout({
    paymentId: order.id,
    amount: palier.prix,
    currency: "XOF",
    method: params.method,
    customerEmail: params.email,
    returnUrl: "/espace-membre?commande=ok",
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { providerRef: session.providerRef, provider: session.provider },
  });

  // Prestataire simulé : la page mock des commandes est distincte de celle des
  // abonnements (les identifiants ne sont pas des Payment).
  const checkoutUrl =
    session.provider === "mock" ? `/paiement/mock-order/${order.id}` : session.checkoutUrl;
  return { ok: true, checkoutUrl, orderId: order.id };
}

export type FulfillOrderResult = { ok: true } | { ok: false; error: string; notFound?: boolean };

/**
 * Confirme une commande payée (webhook prestataire ou page mock) : Order `paid`
 * puis application de l'effet — publication de l'annonce (avec échéance selon
 * la durée du palier) ou activation/prolongation de l'adhésion WhatsApp.
 * Idempotent. Renvoie `notFound` si aucune commande ne correspond, pour que le
 * webhook puisse retomber sur le fulfillment d'abonnement.
 */
export async function fulfillOrder(providerRef: string): Promise<FulfillOrderResult> {
  if (!providerRef) return { ok: false, error: "Référence absente.", notFound: true };

  const order = await prisma.order.findFirst({ where: { providerRef } });
  if (!order) return { ok: false, error: "Commande inconnue.", notFound: true };
  if (order.status === "paid") return { ok: true }; // déjà traitée

  const palier = await palierPourOrder(order.kind, order.tier);
  if (!palier) return { ok: false, error: "Palier introuvable pour cette commande." };

  const now = new Date();
  const echeance = new Date(now.getTime() + palier.jours * 24 * 3600 * 1000);

  if (order.kind === "ad_reservation") {
    // Réservation payée : la campagne attend la VALIDATION de la rédaction
    // avant diffusion (statut pending_review). Les dates posées ici sont
    // provisoires — l'approbation les recale pour la durée pleine du pack.
    // L'acheteur devient « partner » dès maintenant pour suivre son dossier.
    const echeanceCampagne = new Date(now.getTime() + palier.jours * 24 * 3600 * 1000);
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: "paid" } }),
      ...(order.campaignId
        ? [
            prisma.adCampaign.update({
              where: { id: order.campaignId },
              data: { status: "pending_review", startAt: now, endAt: echeanceCampagne, advertiserUserId: order.userId },
            }),
          ]
        : []),
    ]);
    // Accès à l'espace annonceur (sans rétrograder un compte du Studio).
    await prisma.user.updateMany({
      where: { id: order.userId, role: { in: ["reader", "member"] } },
      data: { role: "partner" },
    });
    // Prévient la régie qu'une validation est attendue — best effort : un
    // échec d'e-mail ne doit jamais faire échouer le webhook de paiement.
    if (order.campaignId) {
      const campagne = await prisma.adCampaign.findUnique({
        where: { id: order.campaignId },
        select: { advertiser: true },
      });
      const destinataires = [process.env.SMTP_USER, process.env.CONTACT_TO ?? "contact@abidjan4all.info"]
        .filter((a): a is string => Boolean(a))
        .filter((a, i, t) => t.indexOf(a) === i);
      if (destinataires.length > 0) {
        const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://abidjan4all.info";
        const url = `${base}/admin/ads/${order.campaignId}`;
        sendEmail({
          to: destinataires.join(", "),
          subject: `Réservation publicitaire à valider — ${campagne?.advertiser ?? "annonceur"}`,
          html: `<p>Une réservation d'emplacement vient d'être payée (${palier.label}, ${formatFCFA(palier.prix)}).</p><p>La campagne est <b>en attente de validation</b> : approuvez ou refusez la diffusion depuis le Studio.</p><p><a href="${url}">${url}</a></p>`,
          text: `Réservation payée (${palier.label}, ${formatFCFA(palier.prix)}). À valider au Studio : ${url}`,
        }).catch(() => {});
      }
    }
    return { ok: true };
  }

  if (order.kind === "event_ticket") {
    // Billet payé : l'inscription (créée « en attente ») est confirmée.
    await prisma.order.update({ where: { id: order.id }, data: { status: "paid" } });
    await confirmerInscription(order.id);
    return { ok: true };
  }

  if (order.kind === "brief_abonnement") {
    // A4A Intelligence : ouverture (ou prolongation) de l'abonnement à la série.
    const serie = await prisma.briefSerie.findUnique({ where: { id: order.tier }, select: { dureeMois: true } });
    await prisma.order.update({ where: { id: order.id }, data: { status: "paid" } });
    await ouvrirAbonnement({
      userId: order.userId,
      serieId: order.tier,
      dureeMois: serie?.dureeMois ?? 12,
      orderId: order.id,
    });
    return { ok: true };
  }

  if (order.kind === "whatsapp") {
    const membership = await prisma.whatsappMembership.findUnique({ where: { userId: order.userId } });
    // Prolongation : on repart de l'échéance en cours si elle est future.
    const base = membership && membership.expiresAt > now ? membership.expiresAt : now;
    const expiresAt = new Date(base.getTime() + palier.jours * 24 * 3600 * 1000);
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: "paid" } }),
      prisma.whatsappMembership.upsert({
        where: { userId: order.userId },
        create: { userId: order.userId, tier: palier.id, expiresAt },
        update: { tier: palier.id, expiresAt },
      }),
    ]);
    return { ok: true };
  }

  // Annonce payante : publication + échéance.
  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { status: "paid" } }),
    ...(order.listingId
      ? [
          prisma.listing.update({
            where: { id: order.listingId },
            data: { status: "published", expiresAt: echeance, paidTier: palier.id },
          }),
        ]
      : []),
  ]);
  return { ok: true };
}

/** Échec/abandon d'une commande one-off. */
export async function failOrder(providerRef: string): Promise<void> {
  if (!providerRef) return;
  const orders = await prisma.order.findMany({
    where: { providerRef, status: "pending" },
    select: { kind: true, campaignId: true },
  });
  if (orders.length === 0) return;
  await prisma.order.updateMany({ where: { providerRef, status: "pending" }, data: { status: "failed" } });

  // Billet abandonné : l'inscription en attente est annulée, la place se libère.
  const abandonnees = await prisma.order.findMany({
    where: { providerRef, kind: "event_ticket" },
    select: { id: true },
  });
  await Promise.all(abandonnees.map((o) => annulerInscription(o.id)));

  // Réservation abandonnée : on retire la campagne restée en brouillon.
  for (const o of orders) {
    if (o.kind !== "ad_reservation" || !o.campaignId) continue;
    const camp = await prisma.adCampaign.findUnique({ where: { id: o.campaignId }, select: { status: true } });
    if (camp?.status !== "draft") continue;
    const banners = await prisma.adBanner.findMany({ where: { campaignId: o.campaignId }, select: { imageUrl: true } });
    await Promise.all(banners.map((b) => removeUpload(b.imageUrl)));
    await prisma.adCampaign.delete({ where: { id: o.campaignId } }).catch(() => {});
  }
}
