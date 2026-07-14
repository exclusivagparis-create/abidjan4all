"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type ListingStatus, type ListingType } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";

const TYPES: ListingType[] = ["emploi", "immobilier", "service"];
/** Durée de publication d'une annonce (jours). */
const DUREE_JOURS = 30;

export type ListingResult = { ok: true } | { ok: false; error: string };

/**
 * Dépôt d'une annonce par un membre connecté. Elle part en modération
 * (status `pending`) — la rédaction la publie depuis le Studio.
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
  const expiresAt = new Date(Date.now() + DUREE_JOURS * 24 * 3600 * 1000);

  await prisma.listing.create({
    data: {
      type: type as ListingType,
      title,
      description,
      price,
      location,
      attributes: contact ? { contact } : {},
      authorId: author.id,
      expiresAt,
    },
  });
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
