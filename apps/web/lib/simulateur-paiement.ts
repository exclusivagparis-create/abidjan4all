/**
 * Le simulateur de prestataire est-il le prestataire actif ?
 *
 * Il existe pour le développement : une page aux couleurs d'un prestataire,
 * deux boutons — « j'ai payé », « j'ai renoncé » — et l'abonnement s'active
 * sans qu'un centime circule. Indispensable hors production, dangereux dedans.
 *
 * Or cette page et ses deux actions vivaient dans l'image de production sans
 * la moindre vérification. `settleMockPayment` et `settleMockOrder` sont des
 * fonctions exportées d'un module « use server » : ce sont donc des adresses
 * appelables, et elles confirmaient un paiement sans regarder de quel
 * prestataire il venait. Seule l'obscurité de l'identifiant interne d'un
 * `Payment` — un cuid que le parcours PayDunya ne montre jamais au client —
 * tenait la porte. L'obscurité n'est pas une serrure.
 *
 * `PAYMENT_PROVIDER` fait foi, par la même fonction que le parcours de
 * paiement lui-même : si le vrai prestataire est en service, le simulateur
 * n'existe pas.
 */
import { getProvider } from "@a4a/payments";

export function simulateurActif(): boolean {
  return getProvider().id === "mock";
}
