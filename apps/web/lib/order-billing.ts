import { prisma, type OrderKind } from "@a4a/db";
import { getProviderForMethod, type PaymentMethodId } from "@a4a/payments";
import { TARIFS_EMPLOI, TARIFS_IMMO, TARIFS_WHATSAPP, trouverPalier, type PalierAnnonce } from "@/lib/tarifs";

/** Grille tarifaire correspondant au type de commande. */
function grillePourKind(kind: OrderKind): PalierAnnonce[] {
  if (kind === "listing_emploi") return TARIFS_EMPLOI;
  if (kind === "listing_immobilier") return TARIFS_IMMO;
  return TARIFS_WHATSAPP;
}

export type StartOrderResult = { ok: true; checkoutUrl: string } | { ok: false; error: string };

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
}): Promise<StartOrderResult> {
  const palier = trouverPalier(grillePourKind(params.kind), params.tierId);
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
  return { ok: true, checkoutUrl };
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

  const palier = trouverPalier(grillePourKind(order.kind), order.tier);
  if (!palier) return { ok: false, error: "Palier introuvable pour cette commande." };

  const now = new Date();
  const echeance = new Date(now.getTime() + palier.jours * 24 * 3600 * 1000);

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
  await prisma.order.updateMany({ where: { providerRef, status: "pending" }, data: { status: "failed" } });
}
