/**
 * Segments d'audience de La Matinale (Business Model 2026-2031 : newsletter
 * quotidienne segmentée). L'inscrit choisit ce qui l'intéresse ; une édition
 * peut viser un ou plusieurs segments.
 *
 * Module SÉPARÉ de `lib/newsletter.ts` à dessein : ce dernier importe
 * `node:crypto` (jetons de désabonnement), que le navigateur ne sait pas
 * empaqueter. Le formulaire d'inscription est un composant client — il doit
 * pouvoir lire les segments sans entraîner tout le module serveur.
 */

export const SEGMENTS: Array<{ id: string; label: string; description: string }> = [
  { id: "ci", label: "Côte d'Ivoire", description: "L'actualité du pays, au quotidien." },
  { id: "diaspora", label: "Diaspora", description: "Démarches, retours au pays, vie des communautés." },
  { id: "afrique", label: "Afrique", description: "Le continent et la sous-région ouest-africaine." },
  { id: "business", label: "Business", description: "Économie, marchés, entreprises, cacao." },
];

export const SEGMENT_IDS = SEGMENTS.map((s) => s.id);

/** Ne garde que des segments connus — une valeur inventée fausserait les envois. */
export function segmentsValides(valeurs: string[]): string[] {
  return [...new Set(valeurs.filter((v) => SEGMENT_IDS.includes(v)))];
}

/**
 * Un inscrit doit-il recevoir cette édition ?
 * Édition sans ciblage → oui (envoi général). Inscrit sans préférence → oui
 * (il veut tout). Sinon il faut au moins un segment en commun.
 */
export function recoitEdition(segmentsEdition: string[], segmentsInscrit: string[]): boolean {
  if (segmentsEdition.length === 0) return true;
  if (segmentsInscrit.length === 0) return true;
  return segmentsEdition.some((s) => segmentsInscrit.includes(s));
}
