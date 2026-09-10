/**
 * Calcul des périodes d'abonnement mensuelles.
 *
 * Isolé de `billing.ts`, qui parle à la base : ici tout est pur, donc
 * vérifiable sans base ni serveur. C'est voulu — la règle du jour anniversaire
 * est la partie la plus facile à casser sans s'en apercevoir.
 */

/** Nombre de jours du mois contenant `d`. */
function joursDuMois(annee: number, mois: number): number {
  // Jour 0 du mois suivant = dernier jour du mois visé.
  return new Date(annee, mois + 1, 0).getDate();
}

/**
 * Fin de la période mensuelle suivante, à jour anniversaire constant.
 *
 * `setMonth(m + 1)` — ce que faisait le code — déborde sur les mois courts :
 * un abonnement pris le 31 janvier finissait le 3 mars, et le jour
 * anniversaire passait définitivement de 31 à 3. Tous les abonnements
 * souscrits les 29, 30 et 31 dérivaient ainsi, mois après mois.
 *
 * `ancre` porte le jour de souscription, `depart` la date à prolonger. Un mois
 * trop court rabote la date au dernier jour disponible sans jamais la reporter
 * sur le mois suivant, et le jour d'origine revient dès que le mois le permet :
 * 31 janvier → 28 février → 31 mars → 30 avril → 31 mai.
 */
export function finDePeriodeMensuelle(depart: Date, ancre: Date = depart): Date {
  const jourAncre = ancre.getDate();
  const cible = new Date(depart);

  // Se poser sur le 1er avant de changer de mois : sans cela, passer au mois
  // suivant depuis un 31 ferait déjà déborder la date avant tout rabotage.
  cible.setDate(1);
  cible.setMonth(cible.getMonth() + 1);

  cible.setDate(Math.min(jourAncre, joursDuMois(cible.getFullYear(), cible.getMonth())));
  cible.setHours(ancre.getHours(), ancre.getMinutes(), ancre.getSeconds(), 0);
  return cible;
}

/**
 * Jours restants avant l'échéance, arrondis au jour supérieur.
 * Négatif si l'échéance est passée. Sert aux relances avant expiration.
 */
export function joursAvant(echeance: Date, maintenant: Date = new Date()): number {
  return Math.ceil((echeance.getTime() - maintenant.getTime()) / 86_400_000);
}
