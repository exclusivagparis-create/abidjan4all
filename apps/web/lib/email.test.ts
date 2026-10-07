import { strict as assert } from "node:assert";
import { test } from "node:test";
import { echapperHtml } from "./email";

/**
 * Le formulaire de contact envoyait du HTML non échappé à la rédaction : du
 * hameçonnage expédié par notre propre serveur, sous notre SPF. Ces contrôles
 * fixent la règle et échoueraient si quelqu'un simplifiait la fonction.
 */
test("les cinq caractères dangereux sont neutralisés", () => {
  assert.equal(echapperHtml(`<a href="x">`), "&lt;a href=&quot;x&quot;&gt;");
  assert.equal(echapperHtml("l'apostrophe"), "l&#39;apostrophe");
});

test("l'esperluette est traitée en premier, sans double échappement", () => {
  // Dans le mauvais ordre, « < » deviendrait « &amp;lt; » et s'afficherait
  // littéralement dans le courriel.
  assert.equal(echapperHtml("&"), "&amp;");
  assert.equal(echapperHtml("&lt;"), "&amp;lt;");
  assert.equal(echapperHtml("a & b < c"), "a &amp; b &lt; c");
});

test("une tentative d'injection réelle devient du texte", () => {
  const injection = `Bonjour</p><a href="https://faux-abidjan4all.test/mot-de-passe">Réinitialisez ici</a><p>`;
  const sortie = echapperHtml(injection);
  assert.ok(!sortie.includes("<a "), "plus aucune balise ouvrante");
  assert.ok(!sortie.includes("</p>"), "plus aucune balise fermante");
  assert.ok(sortie.includes("Réinitialisez ici"), "le texte, lui, reste lisible");
});

test("les valeurs absentes ne produisent pas « null » ni « undefined »", () => {
  assert.equal(echapperHtml(null), "");
  assert.equal(echapperHtml(undefined), "");
  assert.equal(echapperHtml(""), "");
  // Les accents et le reste de l'Unicode passent intacts.
  assert.equal(echapperHtml("Côte d’Ivoire"), "Côte d’Ivoire");
});
