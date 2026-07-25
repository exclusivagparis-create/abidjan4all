"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import type { PaymentMethodId } from "@a4a/payments";
import { auth } from "@/auth";
import { startOrderCheckout, fulfillOrder, failOrder } from "@/lib/order-billing";
import { trouverPalier, TARIFS_WHATSAPP } from "@/lib/tarifs";
import { listActivePacks } from "@/lib/packs";
import { saveImageUpload } from "@/lib/uploads";

const METHODS: PaymentMethodId[] = ["momo", "orange", "wave", "moov", "djamo", "card", "paypal"];

/** Destination de retour après paiement, selon le type de commande. */
function retourOk(kind: string): string {
  if (kind === "whatsapp") return "/club?ok=1";
  if (kind === "ad_reservation") return "/espace-annonceur?bienvenue=1";
  return "/annonces?depot=paye";
}
function retourEchec(kind: string): string {
  if (kind === "whatsapp") return "/club?echec=1";
  if (kind === "ad_reservation") return "/publicite/reserver?echec=1";
  return "/annonces?echec=1";
}

/** Page mock PSP (commandes one-off) : simule l'issue puis revient sur le site. */
export async function settleMockOrder(orderId: string, outcome: "paid" | "failed") {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) redirect("/annonces");

  if (outcome === "paid") {
    await fulfillOrder(order.providerRef);
    revalidatePath("/", "layout");
    redirect(retourOk(order.kind));
  } else {
    await failOrder(order.providerRef);
    redirect(retourEchec(order.kind));
  }
}

/** Réservation d'un emplacement publicitaire en self-service (page /publicite). */
export async function startAdReservationAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/publicite/reserver");

  const packId = String(formData.get("pack") ?? "");
  const method = String(formData.get("method") ?? "") as PaymentMethodId;
  // Grille lue en base (éditable au Studio) : seuls les packs en vente sont réservables.
  const pack = (await listActivePacks()).find((p) => p.id === packId);
  if (!pack || !METHODS.includes(method)) redirect("/publicite/reserver?echec=saisie");

  const headline = String(formData.get("headline") ?? "").trim().slice(0, 120);
  const linkUrl = String(formData.get("linkUrl") ?? "").trim();
  if (linkUrl && !/^https?:\/\//.test(linkUrl)) redirect("/publicite/reserver?echec=lien");

  // Visuel optionnel ; à défaut, une accroche est requise.
  let imageUrl: string | null = null;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const up = await saveImageUpload(file);
    if (!up.ok) redirect("/publicite/reserver?echec=image");
    imageUrl = up.url;
  }
  if (!imageUrl && !headline) redirect("/publicite/reserver?echec=creatif");

  const now = new Date();
  // Campagne créée en brouillon, rattachée à l'acheteur ; ses dates réelles
  // sont fixées à la confirmation du paiement (fulfillOrder).
  const campaign = await prisma.adCampaign.create({
    data: {
      advertiser: (session.user.name ?? session.user.email ?? "Annonceur").slice(0, 80),
      cpm: 0,
      targeting: { rubriques: [], geo: [], tags: [] },
      priority: "moyenne",
      startAt: now,
      endAt: new Date(now.getTime() + pack.jours * 24 * 3600 * 1000),
      status: "draft",
      advertiserUserId: session.user.id,
      banners: { create: { format: pack.format, headline: headline || null, linkUrl: linkUrl || null, imageUrl, active: true } },
    },
  });

  const result = await startOrderCheckout({
    userId: session.user.id,
    email: session.user.email ?? "",
    kind: "ad_reservation",
    tierId: pack.id,
    method,
    campaignId: campaign.id,
  });
  if (!result.ok) {
    await prisma.adCampaign.delete({ where: { id: campaign.id } }).catch(() => {});
    redirect("/publicite/reserver?indisponible=1");
  }
  redirect(result.checkoutUrl);
}

/** Démarre le paiement d'une adhésion WhatsApp Club (palier + moyen). */
export async function startWhatsappCheckoutAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/club");

  const tierId = String(formData.get("tier") ?? "");
  const method = String(formData.get("method") ?? "") as PaymentMethodId;
  if (!trouverPalier(TARIFS_WHATSAPP, tierId) || !METHODS.includes(method)) redirect("/club?echec=saisie");

  const result = await startOrderCheckout({
    userId: session.user.id,
    email: session.user.email ?? "",
    kind: "whatsapp",
    tierId,
    method,
  });
  if (!result.ok) redirect(`/club?indisponible=1`);
  redirect(result.checkoutUrl);
}
