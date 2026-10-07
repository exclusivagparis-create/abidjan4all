import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PUBLISH_ROLES, STUDIO_ROLES, roleAdmis } from "./roles";

/**
 * La partie décidable sans base. Ces contrôles disent qui entre et qui reste
 * dehors pour les deux périmètres réellement utilisés dans le Studio.
 */
test("le périmètre de publication exclut le journaliste", () => {
  assert.equal(roleAdmis("editor", PUBLISH_ROLES), true);
  assert.equal(roleAdmis("admin", PUBLISH_ROLES), true);
  // Un journaliste rédige et programme, il ne publie pas — et il ne doit pas
  // non plus toucher aux redirections ni au menu du site.
  assert.equal(roleAdmis("journalist", PUBLISH_ROLES), false);
  assert.equal(roleAdmis("ad_manager", PUBLISH_ROLES), false);
});

test("le périmètre du Studio admet la régie, pas le lectorat", () => {
  for (const role of ["journalist", "editor", "admin", "ad_manager"]) {
    assert.equal(roleAdmis(role, STUDIO_ROLES), true, `${role} entre dans le Studio`);
  }
  for (const role of ["reader", "member", "partner"]) {
    assert.equal(roleAdmis(role, STUDIO_ROLES), false, `${role} reste dehors`);
  }
});

/**
 * Cas du compte disparu ou du rôle illisible : `exigerRole` passe ici la
 * valeur lue en base, qui peut être absente. Rien ne doit alors être admis —
 * surtout pas par la grâce d'une chaîne vide.
 */
test("une valeur absente ou vide n'admet jamais", () => {
  assert.equal(roleAdmis(null, STUDIO_ROLES), false);
  assert.equal(roleAdmis(undefined, STUDIO_ROLES), false);
  assert.equal(roleAdmis("", STUDIO_ROLES), false);
  assert.equal(roleAdmis("Admin", STUDIO_ROLES), false, "la casse ne doit pas ouvrir");
});
