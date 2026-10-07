/**
 * La règle du mur payant, écrite une fois.
 *
 * Elle existait déjà, appliquée correctement à deux endroits — la page
 * d'article et `GET /api/v1/articles/:slug`, qui répond 402 et ne laisse
 * passer que les deux premiers blocs. Mais les routes d'intelligence
 * artificielle, elles, lisaient `article.body` en entier sans jamais regarder
 * `premium`.
 *
 * Le défaut n'était pas théorique : `AI_API_KEY` n'étant pas renseignée, la
 * traduction retombait sur un repli qui renvoie *le texte original*. Un appel
 * anonyme à `POST /api/v1/ai/translate` rendait donc 4 167 caractères d'une
 * enquête payante, en clair, gratuitement. Vérifié sur la production le
 * 7 octobre 2026.
 *
 * D'où ce module : la décision porte un nom, vit à un seul endroit, et les
 * trois routes concernées s'y réfèrent au lieu de la réinventer — ou de
 * l'oublier.
 *
 * Aucune exception de rôle pour la *livraison du texte*, volontairement. Un
 * journaliste qui veut relire son article payant entier dispose de `?apercu=1`
 * sur le site ; donner ici un privilège rouvrirait, par une porte de service,
 * le débat tranché en faisant de la rédaction un lecteur comme un autre.
 *
 * La *fabrication d'un résumé* est autre chose, et suit sa propre règle ci-
 * dessous : ce qui en sort est déjà public sur la page d'article.
 *
 * Module sans accès à la base : l'appelant fournit les faits, celui-ci décide.
 */

/** Le texte intégral peut-il être servi à cet appelant ? */
export function corpsLisible(options: {
  /** L'article est-il réservé aux abonnés ? */
  premium: boolean;
  /** L'appelant a-t-il un abonnement A4A+ en cours de validité ? */
  abonne: boolean;
}): boolean {
  return !options.premium || options.abonne;
}

/**
 * Qui peut forcer la régénération d'un résumé ?
 *
 * `?force=1` relance le modèle en ignorant le cache : chaque appel coûte de
 * l'argent et écrit en base. C'est un geste éditorial, pas une consultation.
 */
export const ROLES_REGENERATION = ["editor", "admin"];

export function regenerationAutorisee(role: string | null | undefined): boolean {
  return ROLES_REGENERATION.includes(role ?? "");
}

/** Message unique, pour que les trois routes refusent dans les mêmes termes. */
export const MESSAGE_PREMIUM = "Cet article est réservé aux abonnés A4A+.";
