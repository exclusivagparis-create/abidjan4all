"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type ListingStatus, type ListingType, type OrderKind } from "@a4a/db";
import type { PaymentMethodId } from "@a4a/payments";
import { auth, PUBLISH_ROLES } from "@/auth";
import { startOrderCheckout } from "@/lib/order-billing";
import { TARIFS_EMPLOI, TARIFS_IMMO, trouverPalier, type PalierAnnonce } from "@/lib/tarifs";

const TYPES: ListingType[] = ["emploi", "immobilier", "service"];
/** Durée d'une annonce gratuite (service) — les payantes suivent leur palier. */
const DUREE_JOURS = 30;
const METHODS: PaymentMethodId[] = ["momo", "orange", "wave", "moov", "djamo", "card", "paypal"];

/** Emploi et immobilier sont payants (cf. lib/tarifs) ; service reste gratuit. */
const GRILLE_PAYANTE: Partial<Record<ListingType, { grille: PalierAnnonce[]; kind: OrderKind }>> = {
  emploi: { grille: TARIFS_EMPLOI, kind: "listing_emploi" },
  immobilier: { grille: TARIFS_IMMO, kind: "listing_immobilier" },
};

export type ListingResult = { ok: true } | { ok: false; error: string };

/**
 * Dépôt d'une annonce par un membre connecté.
 * - service : gratuit, part en modération (status `pending`) ;
 * - emploi / immobilier : payant — l'annonce est créée `pending` puis publiée
 *   automatiquement à la confirmation du paiement (redirection vers le PSP).
 */
export async function createListingAction(_prev: ListingResult | undefined, formData: FormData): Promise<ListingResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Connectez-vous pour déposer une annonce." };
  const author = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } });
  if (!author) return { ok: false, error: "Session expirée — reconnectez-vous." };

  const type = String(formData.get("type") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 140);
  const description = String(formData.get("description") ?? "").trim().slice(0, 4000);
  const location = String(formData.get("location") ?? "").trim().slice(0, 80);
  const priceRaw = String(formData.get("price") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim().slice(0, 120);

  if (!TYPES.includes(type as ListingType)) return { ok: false, error: "Catégorie invalide." };
  if (title.length < 5) return { ok: false, error: "Titre trop court (5 caractères min.)." };
  if (description.length < 20) return { ok: false, error: "Description trop courte (20 caractères min.)." };
  if (!location) return { ok: false, error: "Localisation requise." };

  const price = priceRaw ? Math.max(0, Number(priceRaw) || 0) : null;
  const payant = GRILLE_PAYANTE[type as ListingType];

  // Palier + moyen de paiement requis pour les catégories payantes.
  let palier: PalierAnnonce | undefined;
  let method: PaymentMethodId | undefined;
  if (payant) {
    palier = trouverPalier(payant.grille, String(formData.get("tier") ?? ""));
    method = String(formData.get("method") ?? "") as PaymentMethodId;
    if (!palier) return { ok: false, error: "Choisissez une formule de publication." };
    if (!METHODS.includes(method)) return { ok: false, error: "Choisissez un moyen de paiement." };
  }

  // Annonce créée en attente. Gratuite (service) → modération ; payante → sera
  // publiée par le fulfillment de la commande, avec l'échéance du palier.
  const dureeJours = palier?.jours ?? DUREE_JOURS;
  const listing = await prisma.listing.create({
    data: {
      type: type as ListingType,
      title,
      description,
      price,
      location,
      attributes: contact ? { contact } : {},
      authorId: author.id,
      expiresAt: new Date(Date.now() + dureeJours * 24 * 3600 * 1000),
    },
  });

  if (payant && palier && method) {
    const checkout = await startOrderCheckout({
      userId: author.id,
      email: session.user.email ?? "",
      kind: payant.kind,
      tierId: palier.id,
      method,
      listingId: listing.id,
    });
    if (!checkout.ok) {
      // Paiement impossible à démarrer : on retire l'annonce en attente.
      await prisma.listing.delete({ where: { id: listing.id } }).catch(() => {});
      return { ok: false, error: checkout.error };
    }
    redirect(checkout.checkoutUrl);
  }

  revalidatePath("/admin/annonces");
  return { ok: true };
}

async function requirePublisher() {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    redirect("/login?next=/admin/annonces");
  }
}

/** Modération : publier ou faire expirer une annonce. */
export async function setListingStatusAction(id: string, formData: FormData): Promise<void> {
  await requirePublisher();
  const status = String(formData.get("status") ?? "") as ListingStatus;
  if (!["pending", "published", "expired"].includes(status)) return;

  // republier une annonce expirée lui redonne une période complète
  const extra =
    status === "published"
      ? { expiresAt: new Date(Date.now() + DUREE_JOURS * 24 * 3600 * 1000) }
      : {};
  await prisma.listing.update({ where: { id }, data: { status, ...extra } });
  revalidatePath("/admin/annonces");
  revalidatePath("/annonces");
}

export async function deleteListingAction(id: string): Promise<void> {
  await requirePublisher();
  await prisma.listing.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/annonces");
  revalidatePath("/annonces");
}
