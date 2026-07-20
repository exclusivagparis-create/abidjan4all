import { prisma, type AdCampaign, type AdFormat } from "@a4a/db";

export type AdTargeting = { rubriques?: string[]; geo?: string[]; device?: string };

/**
 * Codes pays ISO-2 de la zone CEDEAO (ECOWAS). Une campagne ciblée « CEDEAO »
 * s'affiche pour tout visiteur d'un de ces pays. Côte d'Ivoire (CI) comprise,
 * mais on la cible aussi directement par « CI ».
 */
const CEDEAO = new Set([
  "BJ", "BF", "CV", "CI", "GM", "GH", "GN", "GW", "LR", "ML", "NE", "NG", "SN", "SL", "TG",
]);

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
 * Sélection d'une campagne active pour un emplacement : période en cours,
 * ciblage rubrique/device/géo satisfait (une campagne sans ciblage matche
 * tout), la moins servie d'abord (lissage simple des impressions).
 * `format` restreint à un gabarit d'emplacement (bandeau, pavé, natif…).
 */
export async function pickCampaign(params: {
  rubrique?: string;
  device?: string;
  country?: string | null;
  format?: AdFormat | AdFormat[];
}): Promise<AdCampaign | null> {
  const now = new Date();
  const formats = params.format ? (Array.isArray(params.format) ? params.format : [params.format]) : null;
  const candidates = await prisma.adCampaign.findMany({
    where: {
      status: "active",
      startAt: { lte: now },
      endAt: { gte: now },
      ...(formats ? { format: { in: formats } } : {}),
    },
    orderBy: { impressions: "asc" },
  });

  for (const c of candidates) {
    const t = (c.targeting ?? {}) as AdTargeting;
    if (t.rubriques?.length && params.rubrique && !t.rubriques.includes(params.rubrique)) continue;
    if (t.rubriques?.length && !params.rubrique) continue; // campagne ciblée hors rubrique
    if (t.device && params.device && t.device !== params.device) continue;
    if (!geoCible(t.geo, params.country ?? null)) continue; // ciblage géographique
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
