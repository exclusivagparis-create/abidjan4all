/**
 * Fil personnalisé — classement des articles pour un membre connecté.
 *
 * Deux principes gouvernent ce module.
 *
 * **Rien n'est espionné.** Le classement ne repose que sur ce que le membre a
 * déclaré — ses rubriques suivies —, sur ce qu'il a mis en favori, et sur son
 * pays d'inscription. Aucun historique de lecture n'est conservé : la mesure
 * d'audience du site est anonyme et le reste, et la politique de
 * confidentialité annonce qu'aucun profil de lecture n'est constitué.
 *
 * **Le classement s'explique.** Chaque article affiché porte la raison de sa
 * présence — « vous suivez Diaspora » — et aucune pondération n'est opaque :
 * tout est dans les constantes ci-dessous. Un lecteur qui ne comprend pas
 * pourquoi on lui montre un article se méfie du média qui le lui montre.
 *
 * Module sans accès à la base ni au DOM : le classement est du calcul pur.
 */

/** Poids, en points. Volontairement peu nombreux et lisibles. */
export const POIDS = {
  /** Rubrique explicitement suivie par le membre. */
  rubriqueSuivie: 100,
  /** Rubrique d'un article déjà mis en favori : un goût constaté, non déclaré. */
  rubriqueDesFavoris: 60,
  /** Diaspora pour un membre hors de Côte d'Ivoire. */
  diasporaHorsCI: 40,
  /** Rubriques du quotidien ivoirien pour un membre en Côte d'Ivoire. */
  localPourCI: 25,
  /** Fraîcheur : points pour un article du jour, décroissant jusqu'à zéro. */
  fraicheurMax: 50,
  /** Au-delà, la fraîcheur ne joue plus. */
  fraicheurJours: 14,
} as const;

/** Rubriques considérées comme « proches » selon le lieu de vie. */
const RUBRIQUES_DIASPORA = ["diaspora"];
const RUBRIQUES_LOCALES = ["actualite", "faits-divers", "politique", "societe"];

export interface Preferences {
  /** Identifiants des rubriques suivies, déclarés par le membre. */
  interets: string[];
  /** Identifiants des rubriques des articles mis en favori. */
  rubriquesDesFavoris: string[];
  /** Code pays du compte : « CI », « FR », « CA »… ou rien. */
  pays: string | null;
}

export interface ArticleClassable {
  id: string;
  publishedAt: Date | null;
  rubriqueId: string;
  rubrique: { slug: string; name: string };
}

export interface ArticleClasse<T> {
  article: T;
  score: number;
  /** Phrase affichée sous l'article. Vide quand il n'est là que par fraîcheur. */
  raison: string;
}

/** Points de fraîcheur : 50 le jour même, 0 au-delà de quinze jours. */
function fraicheur(publishedAt: Date | null, maintenant: Date): number {
  if (!publishedAt) return 0;
  const jours = (maintenant.getTime() - publishedAt.getTime()) / 86_400_000;
  if (jours >= POIDS.fraicheurJours) return 0;
  if (jours <= 0) return POIDS.fraicheurMax;
  return Math.round(POIDS.fraicheurMax * (1 - jours / POIDS.fraicheurJours));
}

/**
 * Note un article et dit pourquoi.
 *
 * La raison retenue est la plus forte, pas la somme : « vous suivez Économie »
 * se comprend, « vous suivez Économie, vous avez gardé un article d'Économie,
 * et vous vivez en Côte d'Ivoire » ressemble à un dossier de police.
 */
export function noter<T extends ArticleClassable>(
  article: T,
  prefs: Preferences,
  maintenant: Date = new Date()
): ArticleClasse<T> {
  let score = fraicheur(article.publishedAt, maintenant);
  let raison = "";
  let meilleure = 0;

  const retiens = (points: number, phrase: string) => {
    score += points;
    if (points > meilleure) {
      meilleure = points;
      raison = phrase;
    }
  };

  if (prefs.interets.includes(article.rubriqueId)) {
    retiens(POIDS.rubriqueSuivie, `Vous suivez ${article.rubrique.name}`);
  }
  if (prefs.rubriquesDesFavoris.includes(article.rubriqueId)) {
    retiens(POIDS.rubriqueDesFavoris, `Vous avez déjà gardé un article de ${article.rubrique.name}`);
  }

  const pays = (prefs.pays ?? "").toUpperCase();
  if (pays && pays !== "CI" && RUBRIQUES_DIASPORA.includes(article.rubrique.slug)) {
    retiens(POIDS.diasporaHorsCI, "Vous lisez depuis l'étranger");
  }
  if (pays === "CI" && RUBRIQUES_LOCALES.includes(article.rubrique.slug)) {
    retiens(POIDS.localPourCI, "L'actualité près de chez vous");
  }

  return { article, score, raison };
}

/**
 * Classe une liste d'articles. À score égal, le plus récent passe devant :
 * sans cette règle, l'ordre dépendrait de celui de la base, donc de rien.
 */
export function classer<T extends ArticleClassable>(
  articles: T[],
  prefs: Preferences,
  maintenant: Date = new Date()
): Array<ArticleClasse<T>> {
  return articles
    .map((a) => noter(a, prefs, maintenant))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.article.publishedAt?.getTime() ?? 0) - (a.article.publishedAt?.getTime() ?? 0);
    });
}

/** Le fil est-il réellement personnalisé, ou n'est-ce que l'actualité récente ? */
export function estPersonnalise(prefs: Preferences): boolean {
  return prefs.interets.length > 0 || prefs.rubriquesDesFavoris.length > 0 || Boolean(prefs.pays);
}
