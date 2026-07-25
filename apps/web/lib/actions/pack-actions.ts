"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type AdFormat } from "@a4a/db";
import { auth } from "@/auth";

const FORMATS: AdFormat[] = ["leaderboard_728x90", "mpu_300x250", "native", "interstitial", "skin", "video"];

/** Administration ou Gestionnaire Régie (rôle relu en base, jamais le JWT seul). */
async function requireRegie() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/ads/tarifs");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } });
  if (!me || !["admin", "ad_manager"].includes(me.role)) redirect("/admin");
  return me;
}

function parsePackForm(formData: FormData) {
  const format = String(formData.get("format") ?? "");
  const label = String(formData.get("label") ?? "").trim().slice(0, 80);
  const jours = Number(formData.get("jours"));
  const prix = Number(formData.get("prix"));
  const description = String(formData.get("description") ?? "").trim().slice(0, 200);
  const ordre = Number(formData.get("ordre"));

  const valid =
    FORMATS.includes(format as AdFormat) &&
    !!label &&
    Number.isInteger(jours) &&
    jours > 0 &&
    Number.isInteger(prix) &&
    prix > 0;

  return {
    valid,
    data: {
      format: format as AdFormat,
      label,
      jours,
      prix,
      description,
      ordre: Number.isInteger(ordre) ? ordre : 0,
    },
  };
}

/** Slug stable et unique pour un nouveau pack (référencé par Order.tier). */
async function slugLibre(base: string): Promise<string> {
  const slug =
    base
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "pack";
  for (let i = 0; ; i++) {
    const candidat = i === 0 ? slug : `${slug}-${i + 1}`;
    const existe = await prisma.adPack.findUnique({ where: { id: candidat }, select: { id: true } });
    if (!existe) return candidat;
  }
}

/** Ajoute un pack à la grille des prix. */
export async function createPackAction(formData: FormData): Promise<void> {
  await requireRegie();
  const { valid, data } = parsePackForm(formData);
  if (!valid) redirect("/admin/ads/tarifs?erreur=1");

  const id = await slugLibre(data.label);
  await prisma.adPack.create({ data: { id, ...data } });
  revalidatePath("/admin/ads/tarifs");
  redirect("/admin/ads/tarifs");
}

/** Modifie un pack (prix, durée, libellé, ordre) — l'identifiant ne change jamais. */
export async function updatePackAction(id: string, formData: FormData): Promise<void> {
  await requireRegie();
  const { valid, data } = parsePackForm(formData);
  if (!valid) redirect("/admin/ads/tarifs?erreur=1");

  await prisma.adPack.update({ where: { id }, data }).catch(() => {});
  revalidatePath("/admin/ads/tarifs");
  redirect("/admin/ads/tarifs");
}

/** Retire un pack de la vente / le remet en vente (l'historique est conservé). */
export async function setPackActifAction(id: string, formData: FormData): Promise<void> {
  await requireRegie();
  const actif = String(formData.get("actif") ?? "") === "1";
  await prisma.adPack.update({ where: { id }, data: { actif } }).catch(() => {});
  revalidatePath("/admin/ads/tarifs");
}

/**
 * Supprime un pack. Refusé s'il est référencé par des commandes (Order.tier) :
 * on le retire de la vente à la place, pour garder l'historique lisible.
 */
export async function deletePackAction(id: string): Promise<void> {
  await requireRegie();
  const commandes = await prisma.order.count({ where: { kind: "ad_reservation", tier: id } });
  if (commandes > 0) redirect("/admin/ads/tarifs?erreur=utilise");
  await prisma.adPack.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/ads/tarifs");
  redirect("/admin/ads/tarifs");
}
