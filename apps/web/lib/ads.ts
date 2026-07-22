import { prisma, type AdBanner, type AdCampaign, type AdFormat, type AdPriority } from "@a4a/db";

export type AdTargeting = { rubriques?: string[]; geo?: string[]; device?: string };

/** Bannière retenue pour diffusion, avec sa campagne (annonceur, ciblage). */
export type BanniereDiffusee = AdBanner & { campaign: AdCampaign };

/**
 * Codes pays ISO-2 de la zone CEDEAO (ECOWAS). Une campagne ciblée « CEDEAO »
 * s'affiche pour tout visiteur d'un de ces pays. Côte d'Ivoire (CI) comprise,
 * mais on la cible aussi directement par « CI ».
 */
const CEDEAO = new Set([
  "BJ", "BF", "CV", "CI", "GM", "GH", "GN", "GW", "LR", "ML", "NE", "NG", "SN", "SL", "TG",
]);

/** Poids de tirage par priorité : une campagne « haute » est servie ~6× plus
 *  souvent qu'une « basse » à impressions égales. */
const POIDS_PRIORITE: Record<AdPriority, number> = { basse: 1, moyenne: 3, haute: 6 };

/**
 * Le pays visiteur satisfait-il le ciblage géo de la campagne ?
 * - liste vide → aucune contrainte, matche tout le monde ;
 * - « CEDEAO » → vrai si le pays appartient à la zone ;
 * - sinon → correspondance directe du code pays (ex. « CI », « FR »).
 * Si le pays est inconnu (geoip indisponible), une campagne géo-ciblée ne
 * s'affiche pas — on ne devine pas une zone qu'on ne peut pas confirmer.
 */
export function geoCible(geo: string[] | undefined, country: string | null): boolean {
  if (!geo?.length) return true;
  if (!country) return false;
  return geo.some((g) => (g === "CEDEAO" ? CEDEAO.has(country) : g === country));
}

/**
 * Sélection d'une bannière pour un emplacement. Parcourt les campagnes actives
 * dont la période est en cours (ou permanente), dont les plafonds d'affichages
 * et de clics ne sont pas atteints, et dont le ciblage (rubrique/appareil/géo)
 * est satisfait ; puis, parmi leurs bannières actives du bon format, retient la
 * moins servie relativement à la priorité (rotation pondérée). Retourne `null`
 * si aucune bannière n'est éligible.
 */
export async function pickBanner(params: {
  rubrique?: string;
  device?: string;
  country?: string | null;
  format: AdFormat;
}): Promise<BanniereDiffusee | null> {
  const now = new Date();
  const campaigns = await prisma.adCampaign.findMany({
    where: {
      status: "active",
      startAt: { lte: now },
      // Période : soit permanente, soit non expirée.
      OR: [{ permanent: true }, { endAt: { gte: now } }],
    },
    // Toutes les bannières actives (tous formats) : nécessaire au calcul des
    // plafonds cumulés de la campagne.
    include: { banners: { where: { active: true } } },
  });

  const candidates: BanniereDiffusee[] = [];
  for (const c of campaigns) {
    if (c.banners.length === 0) continue;

    // Plafonds cumulés sur l'ensemble des bannières de la campagne.
    const totalImp = c.banners.reduce((s, b) => s + b.impressions, 0);
    const totalClk = c.banners.reduce((s, b) => s + b.clicks, 0);
    if (c.capImpressions != null && totalImp >= c.capImpressions) continue;
    if (c.capClicks != null && totalClk >= c.capClicks) continue;

    // Ciblage (identique à l'ancien comportement, au niveau campagne).
    const t = (c.targeting ?? {}) as AdTargeting;
    if (t.rubriques?.length && params.rubrique && !t.rubriques.includes(params.rubrique)) continue;
    if (t.rubriques?.length && !params.rubrique) continue; // campagne ciblée hors rubrique
    if (t.device && params.device && t.device !== params.device) continue;
    if (!geoCible(t.geo, params.country ?? null)) continue;

    for (const b of c.banners) {
      if (b.format === params.format) candidates.push({ ...b, campaign: c });
    }
  }

  if (candidates.length === 0) return null;

  // Tirage pondéré déterministe : impressions / poids-de-priorité croissant.
  // La bannière la moins servie au regard de sa priorité passe en premier.
  candidates.sort(
    (a, b) =>
      a.impressions / POIDS_PRIORITE[a.campaign.priority] -
      b.impressions / POIDS_PRIORITE[b.campaign.priority]
  );
  return candidates[0] ?? null;
}

/** Impression servie sur une bannière — comptage fire-and-forget. */
export function countImpression(bannerId: string): void {
  prisma.adBanner
    .update({ where: { id: bannerId }, data: { impressions: { increment: 1 } } })
    .catch(() => {});
}
