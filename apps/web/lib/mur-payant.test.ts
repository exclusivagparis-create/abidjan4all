import { strict as assert } from "node:assert";
import { test } from "node:test";
import { corpsLisible, regenerationAutorisee } from "./mur-payant";

/**
 * Ces contrôles existent parce que la règle avait été oubliée dans trois
 * routes : ils disent noir sur blanc qui reçoit le texte intégral, et ils
 * échouent si quelqu'un réintroduit un privilège de rôle.
 */
test("un article ordinaire est lisible par tout le monde", () => {
  assert.equal(corpsLisible({ premium: false, abonne: false }), true);
  assert.equal(corpsLisible({ premium: false, abonne: true }), true);
});

test("un article payant n'est lisible que par un abonné", () => {
  assert.equal(corpsLisible({ premium: true, abonne: false }), false);
  assert.equal(corpsLisible({ premium: true, abonne: true }), true);
});

test("la régénération d'un résumé reste un geste éditorial", () => {
  for (const role of ["editor", "admin"]) {
    assert.equal(regenerationAutorisee(role), true, `${role} devrait pouvoir régénérer`);
  }
  // Un journaliste non : le coût est réel et la décision revient à la hiérarchie.
  for (const role of ["journalist", "member", "reader", "partner", "ad_manager", ""]) {
    assert.equal(regenerationAutorisee(role), false, `${role} ne devrait pas pouvoir régénérer`);
  }
  assert.equal(regenerationAutorisee(null), false);
  assert.equal(regenerationAutorisee(undefined), false);
});
