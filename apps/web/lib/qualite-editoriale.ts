/**
 * Brèves et substance : ce que Google regarde quand il juge un site.
 *
 * Le 11 octobre 2026, AdSense a suspendu la diffusion sur abidjan4all.info au
 * motif « Contenu à faible valeur informative ». La mesure du corpus, article
 * par article, a donné ceci :
 *
 *   1 min (≈ 300 mots ou moins) : 2 147  46,5 %
 *   2 min                       : 1 395  30,2 %
 *   3 min                       :   755  16,3 %
 *   4 min et plus               :   323   7,0 %
 *
 * Plus des trois quarts du site sous les 500 mots, sur 4 646 adresses
 * déclarées au sitemap. Et ces pages ne rapportent presque rien : 3,4 vues par
 * article sur 87 jours, contre 30 pour les articles récents.
 *
 * Un détail des mêmes données dit quoi faire : les cinq articles les plus lus
 * font tous 3 ou 4 minutes. Pas un seul d'une minute. Les lecteurs lisent ce
 * qui est écrit long.
 *
 * Ce module ne décide rien tout seul : il compte, il nomme, il propose un
 * seuil. Retirer des milliers de pages de l'index est un geste éditorial qui
 * se prend en connaissance du chiffre exact, au Studio, et se reprend.
 *
 * Module sans accès à la base ni au DOM.
 */

/**
 * Seuil par défaut, en minutes de lecture : un article de DEUX minutes ou
 * moins est traité comme une brève.
 *
 * Choisi avec la rédaction le 11 octobre 2026. Il est délibérément sévère —
 * il vise 3 542 articles sur 4 620 — et c'est le propos : laisser à l'index un
 * millier de pages substantielles plutôt que quatre mille cinq cents brèves.
 * Réglable à l'écran, parce que ce n'est pas au code d'en juger.
 */
export const SEUIL_BREVE_DEFAUT = 2;

/** Bornes acceptées pour le seuil, pour qu'un réglage hasardeux ne vide pas l'index. */
export const SEUIL_MIN = 1;
export const SEUIL_MAX = 5;

/**
 * Un seuil reçu d'un formulaire, ramené dans les bornes.
 *
 * Distinguer l'absence du hors-bornes : un champ vide — ou `null` — signifie
 * « je n'ai rien choisi » et doit rendre le seuil retenu, tandis qu'un `0`
 * tapé délibérément est une valeur hors bornes qu'on ramène à `SEUIL_MIN`.
 * Les confondre fait retomber l'absence sur la borne basse, ce qui change
 * silencieusement la règle : `Number(null)` vaut 0.
 */
export function seuilValide(valeur: unknown): number {
  if (valeur === null || valeur === undefined || valeur === "") return SEUIL_BREVE_DEFAUT;
  const n = Number(valeur);
  if (!Number.isInteger(n)) return SEUIL_BREVE_DEFAUT;
  return Math.min(SEUIL_MAX, Math.max(SEUIL_MIN, n));
}

/** Cet article est-il une brève, au sens du seuil retenu ? */
export function estBreve(readingTime: number, seuil: number = SEUIL_BREVE_DEFAUT): boolean {
  return readingTime <= seuil;
}

/**
 * Une ligne de l'histogramme des longueurs, telle que l'écran l'affiche.
 */
export interface TrancheLongueur {
  /** Minutes de lecture. */
  minutes: number;
  articles: number;
  /** Part du corpus, en pourcentage arrondi au dixième. */
  part: number;
  /** Vues cumulées de la tranche — pour montrer ce qu'on perdrait. */
  vues: number;
  /** La tranche tombe-t-elle sous le seuil retenu ? */
  breve: boolean;
}

/**
 * Construit l'histogramme à partir des longueurs et des vues.
 *
 * Les vues comptent autant que le nombre d'articles : elles répondent à la
 * seule objection sérieuse contre une désindexation massive — « et le trafic
 * qu'on perd ? ». Quand la réponse est « 3,4 vues par article en trois mois »,
 * l'objection tombe, mais il faut l'avoir sous les yeux.
 */
export function histogramme(
  articles: { readingTime: number; views: number }[],
  seuil: number = SEUIL_BREVE_DEFAUT
): TrancheLongueur[] {
  const parMinute = new Map<number, { articles: number; vues: number }>();
  for (const a of articles) {
    const cle = Math.max(0, a.readingTime);
    const t = parMinute.get(cle) ?? { articles: 0, vues: 0 };
    t.articles += 1;
    t.vues += a.views;
    parMinute.set(cle, t);
  }
  const total = articles.length || 1;
  return [...parMinute.entries()]
    .sort((x, y) => x[0] - y[0])
    .map(([minutes, t]) => ({
      minutes,
      articles: t.articles,
      part: Math.round((1000 * t.articles) / total) / 10,
      vues: t.vues,
      breve: estBreve(minutes, seuil),
    }));
}

/** Ce que l'application du seuil changerait, avant de l'appliquer. */
export interface Portee {
  /** Articles sous le seuil, donc visés. */
  vises: number;
  /** Parmi eux, ceux qui sont déjà retirés de l'index. */
  dejaRetires: number;
  /** Ceux qui seraient effectivement retirés par l'opération. */
  aRetirer: number;
  /** Articles retirés de l'index alors qu'ils sont AU-DESSUS du seuil. */
  retiresAuDessus: number;
  /** Ce qui resterait à l'index après l'opération. */
  restants: number;
  /** Vues cumulées des articles qui seraient retirés. */
  vuesPerdues: number;
}

/**
 * Calcule la portée d'une application du seuil.
 *
 * `retiresAuDessus` n'est pas une curiosité : c'est le garde-fou contre
 * l'opération qui s'emballe. Un article long retiré à la main doit le rester,
 * et l'écran doit pouvoir dire « vous en avez 12 dans ce cas » plutôt que de
 * les réindexer en silence.
 */
export function portee(
  articles: { readingTime: number; views: number; noindex: boolean }[],
  seuil: number = SEUIL_BREVE_DEFAUT
): Portee {
  const sous = articles.filter((a) => estBreve(a.readingTime, seuil));
  const dejaRetires = sous.filter((a) => a.noindex).length;
  const aRetirerListe = sous.filter((a) => !a.noindex);
  return {
    vises: sous.length,
    dejaRetires,
    aRetirer: aRetirerListe.length,
    retiresAuDessus: articles.filter((a) => !estBreve(a.readingTime, seuil) && a.noindex).length,
    restants: articles.filter((a) => !estBreve(a.readingTime, seuil) && !a.noindex).length,
    vuesPerdues: aRetirerListe.reduce((s, a) => s + a.views, 0),
  };
}
