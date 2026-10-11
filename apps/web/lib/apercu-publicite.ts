/**
 * Voir ses emplacements publicitaires, même vides.
 *
 * Les onze emplacements du catalogue sont posés dans le code et pilotables au
 * Studio, mais `AdSlot` ne rend rien — `return null` — quand l'emplacement est
 * désactivé ou qu'aucune campagne active ne cible la page. C'est le bon
 * comportement pour le lecteur : mieux vaut rien qu'un cadre vide. Mais il a
 * un effet de bord gênant pour la maison, constaté le 11 octobre 2026 : sans
 * campagne vendue, la régie est invisible, et personne ne peut vérifier où les
 * encarts tombent, quelle place ils prennent, ni ce qu'ils feront à la mise en
 * page une fois remplis.
 *
 * D'où `?pub=1`, sur le modèle de `?apercu=1` pour les articles payants : la
 * demande est explicite, elle n'est accordée qu'à la maison, et naviguer
 * normalement sur le site ne révèle rien.
 *
 * Deux règles à ne pas perdre de vue si ce fichier évolue :
 *
 * — Le rôle vient de la BASE, jamais du jeton de session. Un compte
 *   rétrogradé garderait sinon la vue interne de la régie.
 * — La prévisualisation NE COMPTE AUCUNE IMPRESSION. Les impressions
 *   alimentent le plafond de diffusion d'une campagne et le rapport mensuel
 *   facturé à l'annonceur : les gonfler en regardant sa propre mise en page
 *   reviendrait à lui facturer notre curiosité.
 *
 * Module sans accès à la base ni au DOM.
 */

/** Qui peut regarder la régie de l'intérieur : toute la maison. */
export const ROLES_APERCU_PUB = ["journalist", "editor", "admin", "ad_manager"];

/** Valeurs acceptées pour `?pub=` — on ne devine pas les intentions. */
const VALEURS_VRAIES = ["1", "true", "oui"];

export const APERCU_PUB_PARAM = "pub";

/**
 * L'aperçu des emplacements est-il demandé ET accordé ?
 *
 * @param role      Rôle relu en base, pas celui du jeton.
 * @param parametre Valeur brute de `?pub=`, telle qu'elle arrive.
 */
export function apercuPublicite(role: string | null | undefined, parametre: string | null | undefined): boolean {
  if (!parametre || !VALEURS_VRAIES.includes(parametre.toLowerCase())) return false;
  return ROLES_APERCU_PUB.includes(role ?? "");
}

/**
 * Extrait la valeur de `?pub=` d'une chaîne de requête.
 *
 * `AdSlot` est rendu au fond de l'arbre, sans accès aux `searchParams` de la
 * page : le middleware lui transmet la chaîne de requête par un en-tête, comme
 * il transmet déjà le chemin. Onze points d'appel évitent ainsi d'avoir à
 * passer la même information de main en main.
 */
export function valeurApercuPub(chaineDeRequete: string | null | undefined): string | null {
  if (!chaineDeRequete) return null;
  const params = new URLSearchParams(chaineDeRequete.startsWith("?") ? chaineDeRequete.slice(1) : chaineDeRequete);
  return params.get(APERCU_PUB_PARAM);
}
