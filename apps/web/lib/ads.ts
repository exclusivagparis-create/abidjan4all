import { prisma, type AdBanner, type AdCampaign, type AdFormat, type AdPriority } from "@a4a/db";
import { emplacementCible } from "@/lib/ad-placements-catalogue";

/**
 * Ciblage d'une campagne, tel qu'il est stocké dans `AdCampaign.targeting`.
 *
 * `placements` est la liste des emplacements achetés par l'annonceur, par
 * identifiant du catalogue — `article_mpu`, `site_leaderboard`… Ajouté le
 * 11 octobre 2026 : jusque-là la zone était décidée par le seul format de la
 * bannière, si bien qu'un pavé acheté pour les articles sortait aussi sur
 * l'accueil et sur les rubriques. La régie vend des emplacements, pas des
 * formats ; le ciblage devait suivre la commande.
 *
 * Liste vide ou absente = tous les emplacements compatibles avec le format,
 * c'est-à-dire le comportement d'avant. Les campagnes existantes ne changent
 * donc pas de diffusion.
 */
export type AdTargeting = {
  rubriques?: string[];
  geo?: string[];
  device?: string;
  tags?: string[];
  placements?: string[];
};

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
 * Pourquoi un emplacement ne sert rien.
 *
 * Huit conditions doivent être réunies pour qu'une bannière s'affiche, et
 * toutes échouaient en silence : la page rendait simplement `null`. Constaté
 * le 11 octobre 2026 — des campagnes saisies au Studio, aucun encart visible
 * sur le site, et aucun moyen de savoir laquelle des huit manquait.
 *
 * Ces motifs sont collectés par la MÊME traversée que la sélection, jamais par
 * une seconde logique parallèle : un diagnostic qui divergerait du moteur
 * mentirait, et mentirait avec autorité.
 */
export type MotifRejet =
  | { type: "aucune_campagne" }
  | { type: "statut"; campagne: string; statut: string }
  | { type: "pas_commencee"; campagne: string; debut: Date }
  | { type: "terminee"; campagne: string; fin: Date }
  | { type: "aucune_banniere_active"; campagne: string }
  | { type: "plafond_impressions"; campagne: string; atteint: number; plafond: number }
  | { type: "plafond_clics"; campagne: string; atteint: number; plafond: number }
  | { type: "ciblage_rubrique"; campagne: string; visees: string[]; page: string | null }
  | { type: "ciblage_appareil"; campagne: string; vise: string; actuel: string | null }
  | { type: "ciblage_geo"; campagne: string; visees: string[]; actuel: string | null }
  | { type: "ciblage_tags"; campagne: string; visees: string[]; page: string[] }
  | { type: "ciblage_emplacement"; campagne: string; visees: string[]; actuel: string }
  | { type: "format_absent"; campagne: string; attendu: AdFormat; disponibles: AdFormat[] };

export interface Selection {
  banniere: BanniereDiffusee | null;
  /** Vide si une bannière a été retenue ; sinon la raison, campagne par campagne. */
  rejets: MotifRejet[];
}

interface ParamsSelection {
  rubrique?: string;
  device?: string;
  country?: string | null;
  format: AdFormat;
  contentTags?: string[];
  /**
   * Emplacement qui demande une bannière — `article_mpu`, `site_leaderboard`…
   *
   * C'est ce qui permet à une campagne de ne sortir QUE sur les emplacements
   * achetés. Sans lui, le ciblage par emplacement ne peut pas s'appliquer :
   * s'il est absent, on ne refuse rien, on sert comme avant.
   */
  placementId?: string;
  /**
   * Mode diagnostic : la requête cesse de filtrer sur le statut et la période,
   * pour pouvoir dire « trois campagnes, aucune active » là où le moteur ne
   * voyait « aucune campagne ».
   *
   * Hors diagnostic, la requête est EXACTEMENT celle d'avant : le chemin du
   * lecteur ne paie rien pour l'outillage de la régie.
   */
  diagnostic?: boolean;
}

/**
 * Sélection d'une bannière pour un emplacement, avec les motifs de rejet.
 *
 * Parcourt les campagnes actives dont la période est en cours (ou permanente),
 * dont les plafonds d'affichages et de clics ne sont pas atteints, et dont le
 * ciblage (rubrique/appareil/géo/mots-clés) est satisfait ; puis, parmi leurs
 * bannières actives du bon format, retient la moins servie relativement à la
 * priorité (rotation pondérée).
 */
export async function selectionnerBanniere(params: ParamsSelection): Promise<Selection> {
  const now = new Date();
  const campaigns = await prisma.adCampaign.findMany({
    where: params.diagnostic
      ? {}
      : {
          status: "active",
          startAt: { lte: now },
          // Période : soit permanente, soit non expirée.
          OR: [{ permanent: true }, { endAt: { gte: now } }],
        },
    // Toutes les bannières actives (tous formats) : nécessaire au calcul des
    // plafonds cumulés de la campagne. En diagnostic on les veut toutes, pour
    // pouvoir nommer les formats qui existent.
    include: { banners: params.diagnostic ? true : { where: { active: true } } },
  });

  const rejets: MotifRejet[] = [];
  if (campaigns.length === 0) return { banniere: null, rejets: [{ type: "aucune_campagne" }] };

  const candidates: BanniereDiffusee[] = [];
  for (const c of campaigns) {
    const nom = c.advertiser;

    // En diagnostic, ce que la requête écartait devient un motif explicite.
    if (params.diagnostic) {
      if (c.status !== "active") {
        rejets.push({ type: "statut", campagne: nom, statut: c.status });
        continue;
      }
      if (c.startAt > now) {
        rejets.push({ type: "pas_commencee", campagne: nom, debut: c.startAt });
        continue;
      }
      if (!c.permanent && c.endAt < now) {
        rejets.push({ type: "terminee", campagne: nom, fin: c.endAt });
        continue;
      }
    }

    const actives = params.diagnostic ? c.banners.filter((b) => b.active) : c.banners;
    if (actives.length === 0) {
      rejets.push({ type: "aucune_banniere_active", campagne: nom });
      continue;
    }

    // Plafonds cumulés sur l'ensemble des bannières de la campagne.
    const totalImp = actives.reduce((s, b) => s + b.impressions, 0);
    const totalClk = actives.reduce((s, b) => s + b.clicks, 0);
    if (c.capImpressions != null && totalImp >= c.capImpressions) {
      rejets.push({ type: "plafond_impressions", campagne: nom, atteint: totalImp, plafond: c.capImpressions });
      continue;
    }
    if (c.capClicks != null && totalClk >= c.capClicks) {
      rejets.push({ type: "plafond_clics", campagne: nom, atteint: totalClk, plafond: c.capClicks });
      continue;
    }

    // Ciblage, au niveau campagne.
    const t = (c.targeting ?? {}) as AdTargeting;

    /**
     * Emplacements achetés, en premier parce que c'est le ciblage le plus
     * explicite : l'annonceur a commandé « le pavé des articles », pas « un
     * pavé quelque part ». Le format reste exigé ensuite — un emplacement
     * acheté sans bannière au bon format ne sert rien, et le motif
     * `format_absent` le dira.
     */
    if (!emplacementCible(t.placements, params.placementId)) {
      rejets.push({
        type: "ciblage_emplacement",
        campagne: nom,
        visees: t.placements ?? [],
        actuel: params.placementId ?? "",
      });
      continue;
    }
    // Une campagne ciblée sur des rubriques ne sort jamais sur une page qui
    // n'en a pas — l'accueil, la page Vidéos. C'est le piège le plus discret
    // du ciblage, et il mérite d'être nommé.
    if (t.rubriques?.length && (!params.rubrique || !t.rubriques.includes(params.rubrique))) {
      rejets.push({ type: "ciblage_rubrique", campagne: nom, visees: t.rubriques, page: params.rubrique ?? null });
      continue;
    }
    if (t.device && params.device && t.device !== params.device) {
      rejets.push({ type: "ciblage_appareil", campagne: nom, vise: t.device, actuel: params.device ?? null });
      continue;
    }
    if (!geoCible(t.geo, params.country ?? null)) {
      rejets.push({ type: "ciblage_geo", campagne: nom, visees: t.geo ?? [], actuel: params.country ?? null });
      continue;
    }
    // Ciblage par mots-clés : la campagne ne s'affiche que sur un contenu
    // portant au moins un des tags visés (sinon exclue, comme le ciblage rubrique).
    if (t.tags?.length) {
      const page = params.contentTags ?? [];
      if (!page.length || !t.tags.some((tag) => page.includes(tag))) {
        rejets.push({ type: "ciblage_tags", campagne: nom, visees: t.tags, page });
        continue;
      }
    }

    const auFormat = actives.filter((b) => b.format === params.format);
    if (auFormat.length === 0) {
      rejets.push({
        type: "format_absent",
        campagne: nom,
        attendu: params.format,
        disponibles: [...new Set(actives.map((b) => b.format))],
      });
      continue;
    }
    for (const b of auFormat) candidates.push({ ...b, campaign: c });
  }

  if (candidates.length === 0) return { banniere: null, rejets };

  // Tirage pondéré déterministe : impressions / poids-de-priorité croissant.
  // La bannière la moins servie au regard de sa priorité passe en premier.
  candidates.sort(
    (a, b) =>
      a.impressions / POIDS_PRIORITE[a.campaign.priority] -
      b.impressions / POIDS_PRIORITE[b.campaign.priority]
  );
  return { banniere: candidates[0] ?? null, rejets: [] };
}

/**
 * Sélection d'une bannière pour un emplacement, ou `null` si aucune n'est
 * éligible. C'est le chemin du lecteur, inchangé.
 */
export async function pickBanner(params: {
  rubrique?: string;
  device?: string;
  country?: string | null;
  format: AdFormat;
  contentTags?: string[];
  placementId?: string;
}): Promise<BanniereDiffusee | null> {
  return (await selectionnerBanniere(params)).banniere;
}

/** Impression servie sur une bannière — comptage fire-and-forget. */
export function countImpression(bannerId: string): void {
  prisma.adBanner
    .update({ where: { id: bannerId }, data: { impressions: { increment: 1 } } })
    .catch(() => {});
}
