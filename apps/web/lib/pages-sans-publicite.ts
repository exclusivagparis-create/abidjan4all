/**
 * Où la balise AdSense doit, et ne doit pas, être servie.
 *
 * Le chargeur `adsbygoogle.js` était émis par le layout racine, donc sur
 * TOUTES les pages du site sans exception. Relevé sur la production le
 * 11 octobre 2026 :
 *
 *   /                      1 720 mots visibles
 *   /verification-email      123 mots
 *   /login                    33 mots
 *   /hors-ligne               27 mots   ← la coquille hors-ligne de l'app
 *
 * Or les annonces automatiques — seule forme d'AdSense active sur ce site,
 * puisqu'aucun encart n'est posé dans le code — placent des annonces partout
 * où ce chargeur tourne. Des annonces sur un écran de connexion, dans le
 * back-office ou sur la page affichée quand le réseau manque : c'est
 * exactement ce que Google nomme « annonces diffusées sur des écrans sans
 * contenu éditeur », et c'est un motif de non-respect des règles.
 *
 * D'où cette liste. Elle ne couvre que le rendu serveur : lors d'une
 * navigation interne, le layout racine n'est pas réévalué et le chargeur déjà
 * présent reste en place. Cela suffit face au robot de Google, qui visite
 * chaque adresse directement, mais la ceinture et les bretelles demandent la
 * même liste en exclusions d'URL dans le compte AdSense — « Annonces
 * automatiques », « Gérer les URL exclues ». Les deux moitiés vont ensemble.
 */

/** Écrans sans contenu éditorial, désignés un par un. */
const PAGES_EXCLUES = [
  // Authentification et comptes : des formulaires, rien à lire.
  "/login",
  "/inscription",
  "/mot-de-passe-oublie",
  "/definir-mot-de-passe",
  "/verification-email",
  "/verifie",
  "/parametres",
  // Coquille affichée quand le réseau manque (PWA). Vingt-sept mots.
  "/hors-ligne",
  // Formulaire de désabonnement.
  "/newsletter/desabonnement",
  // Page de démonstration du système graphique, sans contenu éditorial.
  "/design",
  // Formulaire de réservation d'espace publicitaire. Annoncer de la publicité
  // par-dessus un formulaire d'achat de publicité n'aurait pas de sens.
  "/publicite/reserver",
];

/** Sections entières à exclure, par préfixe. */
const SECTIONS_EXCLUES = [
  "/admin", // Studio : aucun contenu éditeur, et la rédaction ne doit pas voir
  //           d'annonces sur son propre site — un clic interne se paie cher.
  "/paiement", // Écrans de paiement.
  "/oauth", // Écran d'autorisation.
  "/espace-membre", // Espace privé du lecteur.
  "/espace-annonceur", // Espace privé de l'annonceur.
  "/recruteur", // Espace privé du recruteur.
];

/**
 * La balise AdSense peut-elle être servie sur ce chemin ?
 *
 * Un chemin inconnu ou vide renvoie `false` : refus par défaut. Le middleware
 * transmet le chemin sur toutes les pages, donc son absence signale une
 * anomalie — et des deux risques, celui de l'annonce déplacée coûte un
 * avertissement de compte, celui de l'annonce manquante coûte une page vue.
 * Le second se répare, le premier se négocie.
 */
export function publiciteAutorisee(chemin: string | null | undefined): boolean {
  if (!chemin || !chemin.startsWith("/")) return false;

  // On compare sans la barre finale : « /login/ » vaut « /login ».
  const net = chemin.length > 1 && chemin.endsWith("/") ? chemin.slice(0, -1) : chemin;

  if (PAGES_EXCLUES.includes(net)) return false;
  return !SECTIONS_EXCLUES.some((s) => net === s || net.startsWith(s + "/"));
}
