import { prisma, type AdCampaign } from "@a4a/db";

export type AdTargeting = { rubriques?: string[]; geo?: string[]; device?: string };

/**
 * Sélection d'une campagne active pour un emplacement : période en cours,
 * ciblage rubrique/device satisfait (une campagne sans ciblage matche tout),
 * la moins servie d'abord (lissage simple des impressions).
 */
export async function pickCampaign(params: {
  rubrique?: string;
  device?: string;
}): Promise<AdCampaign | null> {
  const now = new Date();
  const candidates = await prisma.adCampaign.findMany({
    where: { status: "active", startAt: { lte: now }, endAt: { gte: now } },
    orderBy: { impressions: "asc" },
  });

  for (const c of candidates) {
    const t = (c.targeting ?? {}) as AdTargeting;
    if (t.rubriques?.length && params.rubrique && !t.rubriques.includes(params.rubrique)) continue;
    if (t.rubriques?.length && !params.rubrique) continue; // campagne ciblée hors rubrique
    if (t.device && params.device && t.device !== params.device) continue;
    return c;
  }
  return null;
}

/** Impression servie — comptage fire-and-forget. */
export function countImpression(id: string): void {
  prisma.adCampaign
    .update({ where: { id }, data: { impressions: { increment: 1 } } })
    .catch(() => {});
}
