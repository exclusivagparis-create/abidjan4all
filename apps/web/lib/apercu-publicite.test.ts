import { strict as assert } from "node:assert";
import { test } from "node:test";
import { apercuPublicite, valeurApercuPub } from "./apercu-publicite";

test("le lectorat ne voit jamais les cadres, même en le demandant", () => {
  for (const role of ["reader", "member", "partner", "", null, undefined]) {
    assert.equal(apercuPublicite(role, "1"), false, `${role} ne doit rien voir`);
  }
});

test("toute la maison peut regarder, sur demande explicite", () => {
  for (const role of ["journalist", "editor", "admin", "ad_manager"]) {
    assert.equal(apercuPublicite(role, "1"), true, `${role} devrait voir les cadres`);
    assert.equal(apercuPublicite(role, null), false, `${role} ne voit rien sans le paramètre`);
    assert.equal(apercuPublicite(role, ""), false);
  }
});

test("seules des valeurs explicites valent demande", () => {
  assert.equal(apercuPublicite("ad_manager", "oui"), true);
  assert.equal(apercuPublicite("ad_manager", "TRUE"), true);
  assert.equal(apercuPublicite("ad_manager", "0"), false);
  assert.equal(apercuPublicite("ad_manager", "non"), false);
});

test("la valeur se lit dans la chaîne de requête, avec ou sans point d'interrogation", () => {
  assert.equal(valeurApercuPub("?pub=1"), "1");
  assert.equal(valeurApercuPub("pub=1"), "1");
  assert.equal(valeurApercuPub("?q=cacao&pub=oui"), "oui");
  assert.equal(valeurApercuPub("?q=cacao"), null);
  assert.equal(valeurApercuPub(""), null);
  assert.equal(valeurApercuPub(null), null);
  assert.equal(valeurApercuPub(undefined), null);
});

/**
 * Le cas qui compte : une recherche sur le mot « pub » ne doit pas déclencher
 * l'aperçu. C'est le paramètre qui fait foi, pas le contenu de la page.
 */
test("un autre paramètre ne déclenche rien", () => {
  assert.equal(valeurApercuPub("?q=pub"), null);
  assert.equal(apercuPublicite("admin", valeurApercuPub("?q=pub")), false);
  assert.equal(apercuPublicite("admin", valeurApercuPub("?q=pub&pub=1")), true);
});
