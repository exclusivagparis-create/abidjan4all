/**
 * Aperçu rédaction : voir un article premium entier, sans abonnement.
 *
 * La règle par défaut reste celle du lecteur — la rédaction voit le mur
 * payant comme tout le monde. C'est un témoin : le jour où le mur cesserait
 * de fonctionner et servirait un article payant en entier, quelqu'un de la
 * maison s'en apercevrait en naviguant. Si la rédaction était débloquée en
 * permanence, plus personne à l'intérieur ne verrait jamais le mur, et une
 * fuite pourrait durer des semaines.
 *
 * Mais la prévisualisation, elle, doit montrer l'article tel qu'un abonné le
 * recevra : mise en page, photos, encarts, articles liés. Sans cela, le
 * bouton « Prévisualiser » du Studio est inutile précisément sur les articles
 * qui demandent le plus de soin.
 *
 * D'où ce compromis : l'article entier s'ouvre uniquement quand on le demande
 * explicitement, par `?apercu=1`, et un bandeau rappelle alors que le lecteur,
 * lui, voit le mur. Naviguer normalement sur le site ne déverrouille rien.
 *
 * Module sans accès à la base ni au DOM.
 */

/** Rôles autorisés à demander un aperçu. Mêmes que pour les brouillons. */
export const ROLES_REDACTION = ["journalist", "editor", "admin"];

/** Valeurs acceptées pour `?apercu=` — on ne devine pas les intentions. */
const VALEURS_VRAIES = ["1", "true", "oui"];

export const APERCU_PARAM = "apercu";

/**
 * L'aperçu est-il demandé ET accordé ?
 *
 * Le rôle doit venir de la BASE, pas du jeton de session : un compte
 * rétrogradé garderait sinon son aperçu jusqu'à l'expiration de son jeton.
 * L'appelant s'en charge ; cette fonction ne fait que la décision.
 */
export function apercuRedaction(role: string | null | undefined, parametre: string | string[] | undefined): boolean {
  const valeur = Array.isArray(parametre) ? parametre[0] : parametre;
  if (!valeur || !VALEURS_VRAIES.includes(valeur.toLowerCase())) return false;
  return ROLES_REDACTION.includes(role ?? "");
}

/** Le rôle a-t-il besoin d'être lu en base pour cette page ? */
export function doitLireLeRole(options: {
  /** Article non publié : la page est déjà réservée à la rédaction. */
  enApercu: boolean;
  /** Article masqué. */
  masque: boolean;
  /** `?apercu=` présent dans l'adresse. */
  apercuDemande: boolean;
  /** Visiteur connecté. */
  connecte: boolean;
}): boolean {
  if (!options.connecte) return false;
  return options.enApercu || options.masque || options.apercuDemande;
}
