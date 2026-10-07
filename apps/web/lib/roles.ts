/**
 * Rôles et périmètres d'accès.
 *
 * Ces constantes vivaient dans auth.ts. Elles en ont été sorties le jour où la
 * connexion sociale a eu besoin de connaître les rôles de la rédaction : auth.ts
 * importe désormais lib/social-login.ts, qui ne peut donc plus importer auth.ts
 * en retour sans créer un cycle. auth.ts les réexporte, si bien que les
 * `import { STUDIO_ROLES } from "@/auth"` existants continuent de fonctionner.
 */

/** Rôles autorisés à entrer dans le back-office. */
export const STUDIO_ROLES = ["journalist", "editor", "admin", "ad_manager"] as const;

/**
 * Administration seule : comptes, abonnés, statistiques, jetons d'API.
 * Ce périmètre s'écrivait `["admin"]` à la main dans six pages.
 */
export const ADMIN_ROLES = ["admin"] as const;

/** Rôles autorisés à programmer/publier (workflow éditorial). */
export const PUBLISH_ROLES = ["editor", "admin"] as const;

/** Rôles autorisés à gérer la régie publicitaire (campagnes, grille des prix). */
export const REGIE_ROLES = ["admin", "ad_manager"] as const;

/**
 * Régie ET rédaction en chef : le brand content et l'affiliation sont des
 * sujets commerciaux que les deux côtés de la maison traitent ensemble.
 *
 * Ce périmètre était écrit à la main, deux fois, sous la forme
 * `[...PUBLISH_ROLES, "ad_manager"]`. Le nommer évite qu'une des deux copies
 * évolue sans l'autre.
 */
export const REGIE_OU_PUBLICATION = [...PUBLISH_ROLES, "ad_manager"] as const;

/**
 * Ce rôle figure-t-il parmi les rôles admis ?
 *
 * Prédicat pur, ici et non dans `garde-role.ts` : celui-ci est marqué
 * `server-only` et importe Prisma, ce qui le rend inéprouvable par un
 * contrôle unitaire. La décision, elle, mérite de l'être.
 *
 * La valeur reçue peut être absente — `exigerRole` lui passe ce qu'il a lu en
 * base, et un compte supprimé ne rend rien. Rien ne doit alors être admis,
 * surtout pas par la grâce d'une chaîne vide.
 */
export function roleAdmis(role: string | null | undefined, roles: readonly string[]): boolean {
  return typeof role === "string" && role.length > 0 && roles.includes(role);
}
