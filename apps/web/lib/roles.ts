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

/** Rôles autorisés à programmer/publier (workflow éditorial). */
export const PUBLISH_ROLES = ["editor", "admin"] as const;

/** Rôles autorisés à gérer la régie publicitaire (campagnes, grille des prix). */
export const REGIE_ROLES = ["admin", "ad_manager"] as const;
