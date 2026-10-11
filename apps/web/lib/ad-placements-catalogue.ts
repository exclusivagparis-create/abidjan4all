/**
 * Catalogue des emplacements publicitaires — données pures.
 *
 * Chaque entrée est un encart physique sur une page, lié à un format.
 *
 * Séparé de `ad-placements.ts`, qui lit l'état activé/désactivé en base et
 * n'est donc pas éprouvable par un contrôle unitaire. Ici, pas une ligne qui
 * touche Prisma : le ciblage par emplacement et les messages de diagnostic ont
 * besoin des libellés, et ils doivent pouvoir les obtenir sans traîner la base
 * derrière eux. Même frontière que `roles.ts` / `garde-role.ts`.
 *
 * `ad-placements.ts` réexporte tout ce qui suit : les imports existants
 * continuent de fonctionner.
 */
import type { AdFormat } from "@a4a/db";

export type Placement = {
  slug: string;
  page: "Global" | "Accueil" | "Rubrique" | "Article" | "Vidéo";
  format: AdFormat;
  label: string;
  zone: string; // description de l'emplacement, pour le Studio
  defaultEnabled: boolean;
};

export const PLACEMENTS: Placement[] = [
  // Global — présent sur TOUTES les pages publiques (rendu dans l'en-tête).
  { slug: "site_leaderboard", page: "Global", format: "leaderboard_728x90", label: "Global — bandeau (toutes les pages)", zone: "Sous l'en-tête, sur tout le site", defaultEnabled: true },
  { slug: "site_skin", page: "Global", format: "skin", label: "Global — habillage (fond de page)", zone: "Fond de page, visible dans les marges sur grand écran", defaultEnabled: false },
  // Vidéo
  { slug: "video_preroll", page: "Vidéo", format: "video", label: "Vidéo — encart sponsor", zone: "Au-dessus du lecteur, page Vidéos", defaultEnabled: true },
  // Accueil
  { slug: "home_mpu", page: "Accueil", format: "mpu_300x250", label: "Accueil — pavé colonne", zone: "Colonne latérale, sous « Les plus lus »", defaultEnabled: true },
  { slug: "home_native", page: "Accueil", format: "native", label: "Accueil — natif in-feed", zone: "Entre les sections d'articles", defaultEnabled: true },
  { slug: "home_interstitial", page: "Accueil", format: "interstitial", label: "Accueil — interstitiel mobile", zone: "Plein écran mobile, 1×/session", defaultEnabled: false },
  // Rubrique
  { slug: "rubrique_mpu", page: "Rubrique", format: "mpu_300x250", label: "Rubrique — pavé", zone: "Au milieu de la liste d'articles", defaultEnabled: true },
  { slug: "rubrique_native", page: "Rubrique", format: "native", label: "Rubrique — natif in-feed", zone: "Au fil de la liste d'articles", defaultEnabled: true },
  { slug: "rubrique_interstitial", page: "Rubrique", format: "interstitial", label: "Rubrique — interstitiel mobile", zone: "Plein écran mobile, 1×/session", defaultEnabled: false },
  // Article
  { slug: "article_mpu", page: "Article", format: "mpu_300x250", label: "Article — pavé", zone: "Après le chapeau / dans le corps", defaultEnabled: true },
  { slug: "article_native", page: "Article", format: "native", label: "Article — natif fin d'article", zone: "Sous le corps de l'article", defaultEnabled: true },
  { slug: "article_interstitial", page: "Article", format: "interstitial", label: "Article — interstitiel mobile", zone: "Plein écran mobile, 1×/session", defaultEnabled: false },
];

const PAR_SLUG = new Map(PLACEMENTS.map((p) => [p.slug, p]));

export function getPlacement(slug: string): Placement | undefined {
  return PAR_SLUG.get(slug);
}

/** Libellé lisible d'un emplacement, ou son identifiant si le catalogue l'ignore. */
export function libellePlacement(slug: string): string {
  return PAR_SLUG.get(slug)?.label ?? slug;
}

/**
 * Les identifiants d'emplacement reçus d'un formulaire, filtrés sur le
 * catalogue.
 *
 * Un identifiant inventé dans le formulaire ne doit pas entrer en base : il y
 * dormirait sans jamais correspondre à rien, et la campagne semblerait ciblée
 * alors qu'elle ne sortirait nulle part.
 */
export function placementsValides(valeurs: string[]): string[] {
  return [...new Set(valeurs)].filter((s) => PAR_SLUG.has(s));
}

/**
 * La campagne vise-t-elle l'emplacement qui demande une bannière ?
 *
 * Deux absences valent « oui », et pour deux raisons différentes :
 *
 * — Liste vide ou absente : la campagne n'a pas acheté d'emplacement précis,
 *   elle sort partout où son format est accepté. C'est le comportement des
 *   campagnes créées avant le 11 octobre 2026, qu'il ne faut pas changer sous
 *   leurs pieds.
 * — Emplacement courant inconnu : l'appelant ne nous dit pas où il est, et on
 *   ne refuse pas sur une information qu'on n'a pas.
 *
 * Fonction pure, et c'est voulu : la condition vit dans une boucle qui
 * interroge la base, donc inéprouvable là-bas, alors qu'elle décide de ce
 * qu'un annonceur a acheté.
 */
export function emplacementCible(visees: string[] | undefined, actuel: string | undefined): boolean {
  if (!visees?.length) return true;
  if (!actuel) return true;
  return visees.includes(actuel);
}
