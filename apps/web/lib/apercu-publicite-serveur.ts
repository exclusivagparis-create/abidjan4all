/**
 * Résolution de l'aperçu des emplacements, côté requête.
 *
 * Séparé de `apercu-publicite.ts`, qui ne contient que la décision pure et
 * reste éprouvable par un contrôle unitaire. Celui-ci touche à la session et à
 * la base, donc il est `server-only` — et donc inéprouvable de la même façon.
 * La frontière est volontaire : c'est exactement la raison pour laquelle
 * `roleAdmis` vit dans `lib/roles.ts` et non dans `lib/garde-role.ts`.
 */
import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { exigerRole } from "@/lib/garde-role";
import { ROLES_APERCU_PUB, apercuPublicite, valeurApercuPub } from "@/lib/apercu-publicite";

/**
 * L'aperçu est-il demandé et accordé pour la requête en cours ?
 *
 * Mémorisé : une page porte jusqu'à trois encarts, plus le bandeau, et tous
 * posent la même question. Le rôle vient de la base — jamais du jeton — mais
 * il n'est lu que si le paramètre est présent : une page ordinaire ne paie
 * rien.
 */
export const apercuPubEnCours = cache(async (): Promise<boolean> => {
  const valeur = valeurApercuPub((await headers()).get("x-a4a-search"));
  if (!valeur) return false;
  const moi = await exigerRole(ROLES_APERCU_PUB);
  return apercuPublicite(moi?.role, valeur);
});
