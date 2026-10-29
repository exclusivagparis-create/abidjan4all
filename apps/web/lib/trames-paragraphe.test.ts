import { strict as assert } from "node:assert";
import { test } from "node:test";
import { TRAMES, TRAMES_VALEURS, teinteTrame } from "./trames-paragraphe";

/**
 * Une trame opaque passe inaperçue en thème clair et saccage le thème sombre :
 * elle y pose une bande pâle sur laquelle le texte, clair lui aussi, disparaît.
 * Le contrôle porte donc sur la forme des valeurs, pas seulement sur leur
 * présence.
 */
test("toutes les teintes sont en rgba faiblement opaque", () => {
  for (const [nom, , couleur] of TRAMES) {
    const m = couleur.match(/^rgba\(\d{1,3},\d{1,3},\d{1,3},(0\.\d+)\)$/);
    assert.ok(m, `${nom} doit être en rgba : ${couleur}`);
    const alpha = Number(m![1]);
    assert.ok(alpha > 0 && alpha <= 0.15, `${nom} : opacité ${alpha} hors des bornes lisibles`);
  }
});

test("un paragraphe sans trame ne reçoit aucun fond", () => {
  // Les trois formes que prend le champ en base : absent, nul, vide.
  assert.equal(teinteTrame(undefined), undefined);
  assert.equal(teinteTrame(null), undefined);
  assert.equal(teinteTrame(""), undefined);
});

test("une valeur inconnue se rend sans fond plutôt que de casser la page", () => {
  // Cas réel attendu : une trame retirée de la palette alors que des articles
  // la portent déjà.
  assert.equal(teinteTrame("turquoise"), undefined);
  assert.equal(teinteTrame("GRAY"), undefined, "la casse n'est pas devinée");
});

test("chaque trame de la palette est résolue", () => {
  for (const v of TRAMES_VALEURS) assert.ok(teinteTrame(v), `${v} doit avoir une teinte`);
});

test("les valeurs du schéma suivent la palette, sans doublon", () => {
  // Le schéma zod de l'article est construit depuis cette liste : un doublon
  // ou un écart y passerait inaperçu jusqu'au refus d'enregistrement.
  assert.equal(TRAMES_VALEURS.length, TRAMES.length);
  assert.equal(new Set(TRAMES_VALEURS).size, TRAMES.length, "pas de valeur en double");
  assert.ok(!TRAMES_VALEURS.includes("none" as never), "l'absence de trame n'est pas une valeur");
});

test("les libellés sont en français et distincts", () => {
  const libelles = TRAMES.map(([, l]) => l);
  assert.equal(new Set(libelles).size, libelles.length);
  for (const l of libelles) assert.match(l, /^[A-ZÉÈ][a-zéèêàç]+$/, `libellé inattendu : ${l}`);
});
