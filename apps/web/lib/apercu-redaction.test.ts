import { strict as assert } from "node:assert";
import { test } from "node:test";
import { apercuRedaction, doitLireLeRole } from "./apercu-redaction";

/**
 * L'aperçu ouvre un article payant en entier : la règle mérite des contrôles
 * qui disent explicitement qui entre et qui reste dehors.
 */
test("un lecteur ne déverrouille rien, même en demandant l'aperçu", () => {
  assert.equal(apercuRedaction("reader", "1"), false);
  assert.equal(apercuRedaction("member", "1"), false);
  assert.equal(apercuRedaction("partner", "1"), false);
  assert.equal(apercuRedaction(null, "1"), false);
  assert.equal(apercuRedaction(undefined, "1"), false);
});

test("la rédaction déverrouille, mais seulement sur demande explicite", () => {
  for (const role of ["journalist", "editor", "admin"]) {
    assert.equal(apercuRedaction(role, "1"), true, `${role} devrait voir l'aperçu`);
    assert.equal(apercuRedaction(role, undefined), false, `${role} ne doit rien voir sans le paramètre`);
    assert.equal(apercuRedaction(role, ""), false);
  }
});

test("seules des valeurs explicites valent demande", () => {
  assert.equal(apercuRedaction("editor", "oui"), true);
  assert.equal(apercuRedaction("editor", "TRUE"), true);
  // « 0 » ou « non » ne sont pas des demandes : on ne devine pas l'intention.
  assert.equal(apercuRedaction("editor", "0"), false);
  assert.equal(apercuRedaction("editor", "non"), false);
  assert.equal(apercuRedaction("editor", "peut-etre"), false);
});

test("un paramètre répété prend la première valeur", () => {
  assert.equal(apercuRedaction("editor", ["1", "0"]), true);
  assert.equal(apercuRedaction("editor", ["0", "1"]), false);
});

/**
 * Lire le rôle coûte une requête : on ne la fait que lorsqu'elle peut changer
 * quelque chose. Un visiteur déconnecté n'a jamais de rôle à lire.
 */
test("le rôle n'est lu que quand il peut servir", () => {
  const base = { enApercu: false, masque: false, apercuDemande: false, connecte: true };
  assert.equal(doitLireLeRole(base), false, "page ordinaire : aucune lecture");
  assert.equal(doitLireLeRole({ ...base, enApercu: true }), true);
  assert.equal(doitLireLeRole({ ...base, masque: true }), true);
  assert.equal(doitLireLeRole({ ...base, apercuDemande: true }), true);
  assert.equal(doitLireLeRole({ ...base, apercuDemande: true, connecte: false }), false, "déconnecté : rien à lire");
});
