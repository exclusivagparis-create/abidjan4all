"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type AdFormat, type AdPriority, type AdStatus } from "@a4a/db";
import { auth } from "@/auth";
import { removeUpload, saveImageUpload } from "@/lib/uploads";
import { getPlacement } from "@/lib/ad-placements";
import { sendMonthlyAdReports } from "@/lib/ad-reports";

const FORMATS: AdFormat[] = ["leaderboard_728x90", "mpu_300x250", "native", "interstitial", "skin", "video"];
const PRIORITES: AdPriority[] = ["basse", "moyenne", "haute"];
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

function entierPositifOuNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ---------------------------------------------------------------------------
// Campagnes (conteneur : annonceur, ciblage, période, plafonds, priorité)
// ---------------------------------------------------------------------------

function parseCampaignForm(formData: FormData) {
  const advertiser = String(formData.get("advertiser") ?? "").trim().slice(0, 80);
  const cpm = Number(formData.get("cpm"));
  const rubriques = formData.getAll("rubriques").map((s) => String(s).trim()).filter(Boolean);
  const geo = String(formData.get("geo") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{2,6}$/.test(s));
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  const advertiserUserId = String(formData.get("advertiserUserId") ?? "").trim() || null;
  const priorityRaw = String(formData.get("priority") ?? "moyenne");
  const priority = (PRIORITES.includes(priorityRaw as AdPriority) ? priorityRaw : "moyenne") as AdPriority;
  const permanent = String(formData.get("permanent") ?? "") === "1";
  const capImpressions = entierPositifOuNull(formData.get("capImpressions"));
  const capClicks = entierPositifOuNull(formData.get("capClicks"));

  const startAt = new Date(String(formData.get("startAt") ?? ""));
  let endAt = new Date(String(formData.get("endAt") ?? ""));
  // Diffusion permanente : la date de fin est facultative (repli à +10 ans).
  if (permanent && Number.isNaN(endAt.getTime()) && !Number.isNaN(startAt.getTime())) {
    endAt = new Date(startAt.getTime() + 10 * 365 * 24 * 3600 * 1000);
  }

  const valid =
    !!advertiser &&
    Number.isInteger(cpm) &&
    cpm > 0 &&
    !Number.isNaN(startAt.getTime()) &&
    !Number.isNaN(endAt.getTime()) &&
    endAt > startAt;

  return {
    valid,
    data: {
      advertiser,
      cpm,
      targeting: { rubriques, geo, tags },
      advertiserUserId,
      priority,
      permanent,
      capImpressions,
      capClicks,
      startAt,
      endAt,
    },
  };
}

/** Crée une campagne (brouillon) puis ouvre sa fiche pour y ajouter des bannières. */
export async function createCampaignAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { valid, data } = parseCampaignForm(formData);
  if (!valid) redirect("/admin/ads?erreur=1");

  const campaign = await prisma.adCampaign.create({ data });
  revalidatePath("/admin/ads");
  redirect(`/admin/ads/${campaign.id}`);
}

/** Modifie une campagne existante (champs de conteneur uniquement). */
export async function updateCampaignAction(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const { valid, data } = parseCampaignForm(formData);
  if (!valid) redirect(`/admin/ads/${id}?erreur=1`);

  const current = await prisma.adCampaign.findUnique({ where: { id }, select: { status: true } });
  if (!current) redirect("/admin/ads");

  // Reconduction : une campagne terminée modifiée avec une échéance future
  // (ou passée en permanente) repasse en brouillon, prête à être réactivée.
  const reconduite = current.status === "ended" && (data.permanent || data.endAt > new Date());
  await prisma.adCampaign.update({
    where: { id },
    data: { ...data, ...(reconduite ? { status: "draft" as const } : {}) },
  });
  revalidatePath("/admin/ads");
  revalidatePath(`/admin/ads/${id}`);
  redirect(`/admin/ads/${id}`);
}

/** Supprime une campagne et toutes ses bannières (visuels compris). */
export async function deleteCampaignAction(id: string): Promise<void> {
  await requireAdmin();
  const banners = await prisma.adBanner.findMany({ where: { campaignId: id }, select: { imageUrl: true } });
  await Promise.all(banners.map((b) => removeUpload(b.imageUrl)));
  await prisma.adCampaign.delete({ where: { id } }).catch(() => {}); // cascade → bannières
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
  revalidatePath(`/admin/ads/${id}`);
}

// ---------------------------------------------------------------------------
// Bannières (créatifs d'une campagne)
// ---------------------------------------------------------------------------

function parseBannerForm(formData: FormData) {
  const format = String(formData.get("format") ?? "");
  const headline = String(formData.get("headline") ?? "").trim().slice(0, 120);
  const linkUrl = String(formData.get("linkUrl") ?? "").trim();
  const valid = FORMATS.includes(format as AdFormat) && (!linkUrl || /^https?:\/\//.test(linkUrl));
  return { valid, data: { format: format as AdFormat, headline: headline || null, linkUrl: linkUrl || null } };
}

/** Ajoute une bannière à une campagne (visuel optionnel). */
export async function createBannerAction(campaignId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const campaign = await prisma.adCampaign.findUnique({ where: { id: campaignId }, select: { id: true } });
  if (!campaign) redirect("/admin/ads");
  const { valid, data } = parseBannerForm(formData);
  if (!valid) redirect(`/admin/ads/${campaignId}?erreur=banniere`);

  let imageUrl: string | null = null;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const up = await saveImageUpload(file);
    if (!up.ok) redirect(`/admin/ads/${campaignId}?erreur=image`);
    imageUrl = up.url;
  }

  await prisma.adBanner.create({ data: { ...data, imageUrl, campaignId } });
  revalidatePath(`/admin/ads/${campaignId}`);
  redirect(`/admin/ads/${campaignId}`);
}

/** Modifie une bannière : format, accroche, lien, visuel (remplacer/retirer). */
export async function updateBannerAction(bannerId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const current = await prisma.adBanner.findUnique({ where: { id: bannerId }, select: { campaignId: true, imageUrl: true } });
  if (!current) redirect("/admin/ads");
  const { valid, data } = parseBannerForm(formData);
  if (!valid) redirect(`/admin/ads/${current.campaignId}?erreur=banniere`);

  let imageUrl = current.imageUrl;
  const file = formData.get("image");
  const removeImage = formData.get("removeImage") === "1";
  if (file instanceof File && file.size > 0) {
    const up = await saveImageUpload(file);
    if (!up.ok) redirect(`/admin/ads/${current.campaignId}?erreur=image`);
    await removeUpload(current.imageUrl);
    imageUrl = up.url;
  } else if (removeImage) {
    await removeUpload(current.imageUrl);
    imageUrl = null;
  }

  await prisma.adBanner.update({ where: { id: bannerId }, data: { ...data, imageUrl } });
  revalidatePath(`/admin/ads/${current.campaignId}`);
  redirect(`/admin/ads/${current.campaignId}`);
}

/** Active/désactive une bannière (sans la supprimer). */
export async function setBannerActiveAction(bannerId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const active = String(formData.get("active") ?? "") === "1";
  const b = await prisma.adBanner.update({ where: { id: bannerId }, data: { active }, select: { campaignId: true } }).catch(() => null);
  if (b) revalidatePath(`/admin/ads/${b.campaignId}`);
}

/** Supprime une bannière (et son visuel). */
export async function deleteBannerAction(bannerId: string): Promise<void> {
  await requireAdmin();
  const b = await prisma.adBanner.findUnique({ where: { id: bannerId }, select: { campaignId: true, imageUrl: true } });
  if (!b) return;
  await removeUpload(b.imageUrl);
  await prisma.adBanner.delete({ where: { id: bannerId } }).catch(() => {});
  revalidatePath(`/admin/ads/${b.campaignId}`);
}

// ---------------------------------------------------------------------------
// Emplacements (catalogue lib/ad-placements)
// ---------------------------------------------------------------------------

/** Envoie manuellement les récapitulatifs mensuels aux comptes annonceurs. */
export async function sendMonthlyReportsAction(): Promise<void> {
  await requireAdmin();
  const { envoyes, ignores } = await sendMonthlyAdReports();
  revalidatePath("/admin/ads");
  redirect(`/admin/ads?rapports=${envoyes}-${ignores}`);
}

/** Active/désactive un emplacement publicitaire. */
export async function setPlacementEnabledAction(slug: string, formData: FormData): Promise<void> {
  await requireAdmin();
  if (!getPlacement(slug)) return; // slug hors catalogue
  const enabled = String(formData.get("enabled") ?? "") === "1";
  await prisma.adPlacement.upsert({ where: { slug }, create: { slug, enabled }, update: { enabled } });
  revalidatePath("/admin/ads");
  revalidatePath("/", "layout"); // les encarts sont partout
}
