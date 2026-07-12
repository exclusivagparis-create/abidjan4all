"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type AdFormat, type AdStatus } from "@a4a/db";
import { auth } from "@/auth";

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

/** Crée une campagne (brouillon) depuis le Studio. */
export async function createCampaignAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const advertiser = String(formData.get("advertiser") ?? "").trim().slice(0, 80);
  const format = String(formData.get("format") ?? "");
  const cpm = Number(formData.get("cpm"));
  const headline = String(formData.get("headline") ?? "").trim().slice(0, 120);
  const linkUrl = String(formData.get("linkUrl") ?? "").trim();
  const rubriques = String(formData.get("rubriques") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const geo = String(formData.get("geo") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{2,6}$/.test(s));
  const startAt = new Date(String(formData.get("startAt") ?? ""));
  const endAt = new Date(String(formData.get("endAt") ?? ""));

  if (
    !advertiser ||
    !FORMATS.includes(format as AdFormat) ||
    !Number.isInteger(cpm) ||
    cpm <= 0 ||
    Number.isNaN(startAt.getTime()) ||
    Number.isNaN(endAt.getTime()) ||
    endAt <= startAt ||
    (linkUrl && !/^https?:\/\//.test(linkUrl))
  ) {
    redirect("/admin/ads?erreur=1");
  }

  await prisma.adCampaign.create({
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
  });
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
