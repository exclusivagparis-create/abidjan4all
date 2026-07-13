"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type AdFormat, type AdStatus } from "@a4a/db";
import { auth } from "@/auth";
import { removeUpload, saveImageUpload } from "@/lib/uploads";

const FORMATS: AdFormat[] = ["leaderboard_728x90", "mpu_300x250", "native", "interstitial"];
const TRANSITIONS: Record<AdStatus, AdStatus[]> = {
  draft: ["active"],
  active: ["paused", "ended"],
  paused: ["active", "ended"],
  ended: [],
};

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/ads");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } });
  if (!me || me.role !== "admin") redirect("/admin");
  return me;
}

/** Champs communs du formulaire de campagne. */
function parseCampaignForm(formData: FormData) {
  const advertiser = String(formData.get("advertiser") ?? "").trim().slice(0, 80);
  const format = String(formData.get("format") ?? "");
  const cpm = Number(formData.get("cpm"));
  const headline = String(formData.get("headline") ?? "").trim().slice(0, 120);
  const linkUrl = String(formData.get("linkUrl") ?? "").trim();
  const rubriques = formData.getAll("rubriques").map((s) => String(s).trim()).filter(Boolean);
  const geo = String(formData.get("geo") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{2,6}$/.test(s));
  const startAt = new Date(String(formData.get("startAt") ?? ""));
  const endAt = new Date(String(formData.get("endAt") ?? ""));

  const valid =
    !!advertiser &&
    FORMATS.includes(format as AdFormat) &&
    Number.isInteger(cpm) &&
    cpm > 0 &&
    !Number.isNaN(startAt.getTime()) &&
    !Number.isNaN(endAt.getTime()) &&
    endAt > startAt &&
    (!linkUrl || /^https?:\/\//.test(linkUrl));

  return {
    valid,
    data: {
      advertiser,
      format: format as AdFormat,
      cpm,
      headline: headline || null,
      linkUrl: linkUrl || null,
      targeting: { rubriques, geo },
      startAt,
      endAt,
    },
  };
}

/** Crée une campagne (brouillon), avec visuel optionnel. */
export async function createCampaignAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { valid, data } = parseCampaignForm(formData);
  if (!valid) redirect("/admin/ads?erreur=1");

  let imageUrl: string | null = null;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const up = await saveImageUpload(file);
    if (!up.ok) redirect("/admin/ads?erreur=image");
    imageUrl = up.url;
  }

  await prisma.adCampaign.create({ data: { ...data, imageUrl } });
  revalidatePath("/admin/ads");
  redirect("/admin/ads");
}

/**
 * Modifie une campagne existante (y compris en cours) : champs + visuel.
 * `removeImage=1` retire l'image ; un nouveau fichier la remplace.
 */
export async function updateCampaignAction(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const { valid, data } = parseCampaignForm(formData);
  if (!valid) redirect(`/admin/ads/${id}?erreur=1`);

  const current = await prisma.adCampaign.findUnique({ where: { id }, select: { imageUrl: true } });
  if (!current) redirect("/admin/ads");

  let imageUrl = current.imageUrl;
  const file = formData.get("image");
  const removeImage = formData.get("removeImage") === "1";

  if (file instanceof File && file.size > 0) {
    const up = await saveImageUpload(file);
    if (!up.ok) redirect(`/admin/ads/${id}?erreur=image`);
    await removeUpload(current.imageUrl); // l'ancien ne sert plus
    imageUrl = up.url;
  } else if (removeImage) {
    await removeUpload(current.imageUrl);
    imageUrl = null;
  }

  await prisma.adCampaign.update({ where: { id }, data: { ...data, imageUrl } });
  revalidatePath("/admin/ads");
  revalidatePath(`/admin/ads/${id}`);
  redirect("/admin/ads");
}

/** Supprime une campagne (et son visuel). */
export async function deleteCampaignAction(id: string): Promise<void> {
  await requireAdmin();
  const c = await prisma.adCampaign.findUnique({ where: { id }, select: { imageUrl: true } });
  if (c) await removeUpload(c.imageUrl);
  await prisma.adCampaign.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/ads");
  redirect("/admin/ads");
}

/** Transition de statut contrôlée (draft→active→paused/ended). */
export async function setCampaignStatusAction(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const target = String(formData.get("status") ?? "") as AdStatus;

  const campaign = await prisma.adCampaign.findUnique({ where: { id }, select: { status: true } });
  if (!campaign || !TRANSITIONS[campaign.status]?.includes(target)) return;

  await prisma.adCampaign.update({ where: { id }, data: { status: target } });
  revalidatePath("/admin/ads");
}
