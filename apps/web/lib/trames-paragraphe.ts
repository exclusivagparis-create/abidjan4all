/**
 * Trames de fond des paragraphes.
 *
 * À ne pas confondre avec le surlignage de la barre de mise en forme. Celui-ci
 * peint derrière les mots sélectionnés, par `hiliteColor`, et vit dans le HTML
 * du paragraphe ; la trame, elle, couvre le paragraphe entier, marges
 * comprises, et c'est une propriété du bloc. On s'en sert pour détacher un
 * passage du fil de l'article — un rappel, un avertissement, un aparté — sans
 * aller jusqu'à l'encadré, qui impose un titre et un liseré.
 *
 * Les teintes passent par rgba à faible opacité, comme celles des encadrés
 * (CALLOUT_TINT dans article-body) : une couleur opaque choisie pour le thème
 * clair découpe une bande blafarde en thème sombre, où le texte devient
 * illisible. Posée en rgba, la trame se teinte du fond de la page et suit le
 * thème sans qu'on ait à la décliner deux fois.
 *
 * Le vocabulaire est celui des encadrés — des noms de couleur en anglais —
 * parce que les deux champs cohabitent dans le même bloc et passent par le
 * même schéma. Les libellés affichés, eux, sont en français.
 */
export const TRAMES = [
  ["gray", "Gris", "rgba(128,128,128,0.10)"],
  ["yellow", "Jaune", "rgba(234,179,8,0.11)"],
  ["orange", "Orange", "rgba(244,121,32,0.09)"],
  ["green", "Vert", "rgba(0,102,51,0.09)"],
  ["blue", "Bleu", "rgba(26,58,92,0.09)"],
  ["red", "Rouge", "rgba(160,21,32,0.08)"],
  ["purple", "Violet", "rgba(124,58,140,0.09)"],
] as const satisfies ReadonlyArray<readonly [string, string, string]>;

export type TrameFond = (typeof TRAMES)[number][0];

/** Les valeurs admises par le schéma du bloc, dans l'ordre de la palette. */
export const TRAMES_VALEURS = TRAMES.map(([v]) => v) as unknown as [TrameFond, ...TrameFond[]];

/**
 * Teinte d'un paragraphe, ou `undefined` s'il n'en porte pas.
 *
 * Tolérant par construction : le champ vient de la base, où dorment des
 * articles écrits avant l'arrivée des trames, et pourrait porter demain une
 * valeur retirée de la palette. Dans les deux cas le paragraphe se rend sans
 * fond plutôt que de casser la page.
 */
export function teinteTrame(fond: string | null | undefined): string | undefined {
  if (!fond) return undefined;
  return TRAMES.find(([v]) => v === fond)?.[2];
}
