import { cache } from "react";
import { prisma, type AdFormat } from "@a4a/db";

/**
 * Catalogue des emplacements publicitaires. Chaque entrée = un encart physique
 * sur une page, lié à un format. L'état activé/désactivé est piloté depuis la
 * régie Studio (table AdPlacement) ; ici on définit seulement le catalogue et
 * l'état par défaut.
 */
export type Placement = {
  slug: string;
  page: "Accueil" | "Rubrique" | "Article";
  format: AdFormat;
  label: string;
  zone: string; // description de l'emplacement, pour le Studio
  defaultEnabled: boolean;
};

export const PLACEMENTS: Placement[] = [
  // Accueil
  { slug: "home_leaderboard", page: "Accueil", format: "leaderboard_728x90", label: "Accueil — bandeau haut", zone: "Sous le fil d'actualité", defaultEnabled: true },
  { slug: "home_mpu", page: "Accueil", format: "mpu_300x250", label: "Accueil — pavé colonne", zone: "Colonne latérale, sous « Les plus lus »", defaultEnabled: true },
  { slug: "home_native", page: "Accueil", format: "native", label: "Accueil — natif in-feed", zone: "Entre les sections d'articles", defaultEnabled: true },
  { slug: "home_interstitial", page: "Accueil", format: "interstitial", label: "Accueil — interstitiel mobile", zone: "Plein écran mobile, 1×/session", defaultEnabled: false },
  // Rubrique
  { slug: "rubrique_leaderboard", page: "Rubrique", format: "leaderboard_728x90", label: "Rubrique — bandeau haut", zone: "Sous le titre de rubrique", defaultEnabled: true },
  { slug: "rubrique_mpu", page: "Rubrique", format: "mpu_300x250", label: "Rubrique — pavé", zone: "Sous le bandeau, avant la liste", defaultEnabled: true },
  { slug: "rubrique_native", page: "Rubrique", format: "native", label: "Rubrique — natif in-feed", zone: "Au fil de la liste d'articles", defaultEnabled: true },
  { slug: "rubrique_interstitial", page: "Rubrique", format: "interstitial", label: "Rubrique — interstitiel mobile", zone: "Plein écran mobile, 1×/session", defaultEnabled: false },
  // Article
  { slug: "article_leaderboard", page: "Article", format: "leaderboard_728x90", label: "Article — bandeau haut", zone: "Sous le fil d'ariane", defaultEnabled: true },
  { slug: "article_mpu", page: "Article", format: "mpu_300x250", label: "Article — pavé", zone: "Après le chapeau / dans le corps", defaultEnabled: true },
  { slug: "article_native", page: "Article", format: "native", label: "Article — natif fin d'article", zone: "Sous le corps de l'article", defaultEnabled: true },
  { slug: "article_interstitial", page: "Article", format: "interstitial", label: "Article — interstitiel mobile", zone: "Plein écran mobile, 1×/session", defaultEnabled: false },
];

const PAR_SLUG = new Map(PLACEMENTS.map((p) => [p.slug, p]));

export function getPlacement(slug: string): Placement | undefined {
  return PAR_SLUG.get(slug);
}

/**
 * État activé de chaque emplacement (catalogue + surcharges DB). Mis en cache
 * pour la durée d'un rendu : plusieurs AdSlot sur la même page ne déclenchent
 * qu'UNE requête. Un slug sans ligne en base garde son état par défaut.
 */
export const emplacementsActifs = cache(async (): Promise<Map<string, boolean>> => {
  const rows = await prisma.adPlacement.findMany({ select: { slug: true, enabled: true } });
  const override = new Map(rows.map((r) => [r.slug, r.enabled]));
  return new Map(PLACEMENTS.map((p) => [p.slug, override.get(p.slug) ?? p.defaultEnabled]));
});

/** Un emplacement est-il actif ? (défaut catalogue si non renseigné en base) */
export async function placementActif(slug: string): Promise<boolean> {
  const p = getPlacement(slug);
  if (!p) return false;
  return (await emplacementsActifs()).get(slug) ?? p.defaultEnabled;
}
