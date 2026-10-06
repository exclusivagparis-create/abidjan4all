/**
 * Demandes de remboursement — règles communes au membre et au Studio.
 *
 * Le remboursement lui-même se fait chez le prestataire ; le site n'engage
 * aucun mouvement d'argent. Ce module décide seulement ce qu'un lecteur peut
 * demander, et comment chaque état se dit en français.
 *
 * Module sans accès à la base ni au DOM.
 */

export const ETATS = {
  en_attente: { label: "En attente", couleur: "var(--orange)" },
  acceptee: { label: "Acceptée", couleur: "var(--blue)" },
  refusee: { label: "Refusée", couleur: "var(--red)" },
  remboursee: { label: "Remboursée", couleur: "var(--green)" },
} as const;

export type EtatRemboursement = keyof typeof ETATS;

export const ETATS_IDS = Object.keys(ETATS) as EtatRemboursement[];

export const estEtat = (v: string): v is EtatRemboursement => ETATS_IDS.includes(v as EtatRemboursement);

/**
 * Délai pendant lequel un paiement reste contestable, en jours.
 *
 * Trente jours : au-delà, le service a été rendu et consommé, et les
 * conditions générales n'ouvrent pas de droit. Ce n'est pas une barrière
 * technique — la rédaction peut toujours rembourser de sa propre initiative
 * chez le prestataire — mais la limite de ce que le formulaire accepte.
 */
export const JOURS_CONTESTABLES = 30;

/** Longueur minimale du motif : « remboursez-moi » n'aide personne à trancher. */
export const MOTIF_MIN = 15;
export const MOTIF_MAX = 1500;

export interface PaiementContestable {
  id: string;
  createdAt: Date;
  status: string;
  /** Une demande existe-t-elle déjà pour ce paiement ? */
  dejaDemande: boolean;
}

/**
 * Un paiement peut-il faire l'objet d'une demande ?
 *
 * Trois conditions : il a réellement été encaissé, il date de moins de trente
 * jours, et il n'a pas déjà sa demande. La troisième évite qu'un lecteur
 * inquiet n'en dépose cinq et que la rédaction ne traite cinq fois la même
 * affaire.
 */
export function contestable(p: PaiementContestable, maintenant: Date = new Date()): boolean {
  // `succeeded` : l'argent est arrivé. Un paiement en attente n'a rien à
  // rembourser, un échoué non plus, et un déjà remboursé encore moins.
  if (p.status !== "succeeded") return false;
  if (p.dejaDemande) return false;
  const jours = (maintenant.getTime() - p.createdAt.getTime()) / 86_400_000;
  return jours <= JOURS_CONTESTABLES;
}

/** Message affiché quand aucun paiement n'est contestable. */
export function raisonIndisponible(paiements: PaiementContestable[], maintenant: Date = new Date()): string {
  if (paiements.length === 0) return "Aucun paiement enregistré sur votre compte.";
  if (paiements.some((p) => p.dejaDemande)) return "Une demande est déjà en cours pour votre dernier paiement.";
  const recents = paiements.filter((p) => (maintenant.getTime() - p.createdAt.getTime()) / 86_400_000 <= JOURS_CONTESTABLES);
  if (recents.length === 0) return `Vos paiements datent de plus de ${JOURS_CONTESTABLES} jours.`;
  return "Aucun paiement encaissé à contester.";
}
