"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type DiscountKind } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";

/**
 * Administration des offres A4A+.
 *
 * Deux règles tiennent tout le fichier :
 *
 * — Une offre ne se supprime pas. Des abonnements et des paiements y sont
 *   rattachés ; la retirer laisserait des lignes pointant dans le vide. On la
 *   désactive : elle disparaît de la page publique, les abonnés la gardent.
 *
 * — Le slug (`id`) est immuable après création. Il est inscrit dans chaque
 *   abonnement et chaque paiement ; le renommer réécrirait l'historique.
 */

async function requirePublisher() {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    redirect("/login?next=/admin/offres");
  }
}

function rafraichir() {
  revalidatePath("/admin/offres");
  revalidatePath("/abonnement");
  revalidatePath("/api/v1/plans");
}

/** Slug URL : minuscules, sans accent, tirets. Vide si rien d'exploitable. */
function slugifier(brut: string): string {
  return brut
    .normalize("NFD")
    // Diacritiques en échappement Unicode : écrits en clair, ils survivent mal
    // aux allers-retours d'encodage entre outils.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Une ligne d'avantage par ligne saisie, vides ignorées. */
function lireAvantages(formData: FormData): string[] {
  return String(formData.get("features") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/** Date d'un `<input type="date">` ; `null` si vide ou illisible. */
function lireDate(formData: FormData, champ: string): Date | null {
  const brut = String(formData.get(champ) ?? "").trim();
  if (!brut) return null;
  const d = new Date(brut);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Remise saisie, ramenée à des valeurs exploitables.
 *
 * Un pourcentage est borné à 100 et un montant au prix de l'offre : sans
 * cela, une saisie trop généreuse produirait un montant négatif envoyé au
 * prestataire de paiement.
 */
function lireRemise(formData: FormData, prix: number) {
  const kind = String(formData.get("discountKind") ?? "none") as DiscountKind;
  if (kind !== "percent" && kind !== "amount") {
    return { discountKind: "none" as DiscountKind, discountValue: 0, discountFrom: null, discountTo: null, discountLabel: null };
  }
  const brut = Math.max(0, Math.round(Number(formData.get("discountValue") ?? 0) || 0));
  const valeur = kind === "percent" ? Math.min(100, brut) : Math.min(prix, brut);
  const label = String(formData.get("discountLabel") ?? "").trim().slice(0, 60);
  return {
    discountKind: valeur > 0 ? kind : ("none" as DiscountKind),
    discountValue: valeur,
    discountFrom: lireDate(formData, "discountFrom"),
    discountTo: lireDate(formData, "discountTo"),
    discountLabel: label || null,
  };
}

function lireChamps(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const tagline = String(formData.get("tagline") ?? "").trim().slice(0, 140);
  const prix = Math.max(0, Math.round(Number(formData.get("price") ?? 0) || 0));
  const ordre = Math.round(Number(formData.get("ordre") ?? 0) || 0);
  return {
    name,
    tagline,
    price: prix,
    ordre,
    features: lireAvantages(formData),
    highlight: formData.get("highlight") === "on",
    active: formData.get("active") === "on",
    ...lireRemise(formData, prix),
  };
}

export async function createOfferAction(formData: FormData): Promise<void> {
  await requirePublisher();
  const champs = lireChamps(formData);
  if (!champs.name) redirect("/admin/offres?erreur=nom");
  if (champs.price <= 0) redirect("/admin/offres?erreur=prix");

  const slug = slugifier(String(formData.get("id") ?? "") || champs.name);
  if (!slug) redirect("/admin/offres?erreur=slug");

  // « free » est réservée au socle non payant : la réécrire romprait la clé
  // étrangère des comptes sans abonnement.
  if (slug === "free") redirect("/admin/offres?erreur=slug_reserve");

  const existe = await prisma.offer.findUnique({ where: { id: slug }, select: { id: true } });
  if (existe) redirect("/admin/offres?erreur=slug_pris");

  await prisma.offer.create({ data: { id: slug, ...champs } });
  rafraichir();
  redirect("/admin/offres?ok=creee");
}

export async function updateOfferAction(id: string, formData: FormData): Promise<void> {
  await requirePublisher();
  if (id === "free") redirect("/admin/offres?erreur=slug_reserve");

  const champs = lireChamps(formData);
  if (!champs.name) redirect("/admin/offres?erreur=nom");
  if (champs.price <= 0) redirect("/admin/offres?erreur=prix");

  await prisma.offer.update({ where: { id }, data: champs }).catch(() => {});
  rafraichir();
  redirect("/admin/offres?ok=enregistree");
}

/**
 * Bascule active/inactive. Désactiver retire l'offre de la page publique
 * sans toucher aux abonnements en cours, qui restent valides jusqu'à leur
 * échéance — c'est le remplacement volontaire de la suppression.
 */
export async function toggleOfferAction(id: string): Promise<void> {
  await requirePublisher();
  if (id === "free") redirect("/admin/offres?erreur=slug_reserve");

  const offre = await prisma.offer.findUnique({ where: { id }, select: { active: true } });
  if (!offre) redirect("/admin/offres?erreur=introuvable");

  await prisma.offer.update({ where: { id }, data: { active: !offre.active } });
  rafraichir();
  redirect(`/admin/offres?ok=${offre.active ? "desactivee" : "activee"}`);
}
