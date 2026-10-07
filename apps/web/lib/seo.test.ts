import { strict as assert } from "node:assert";
import { test } from "node:test";
import { jsonLdScript, xmlEscape } from "./seo";

/**
 * Le JSON-LD part dans une balise `<script>` : si un chevron en sort intact,
 * un titre d'article peut fermer la balise et faire exécuter ce qui suit.
 *
 * Ce contrôle existe parce que la protection a été écrite deux fois sans
 * fonctionner : `"<"` dans un littéral vaut « < », et le remplacement ne
 * faisait rien. Le code avait l'air juste, le commentaire au-dessus décrivait
 * la bonne intention, et rien ne protégeait. Seule une vérification de la
 * SORTIE pouvait le dire.
 */
test("jsonLdScript neutralise une balise fermante dans un titre", () => {
  const piege = { headline: "Enquête </script><script>alert(1)</script> sur le cacao" };
  const sortie = jsonLdScript(piege);

  assert.ok(!sortie.includes("</script>"), "une balise fermante est sortie intacte");
  assert.ok(!sortie.includes("<"), "un chevron ouvrant est sorti intact");
  assert.ok(!sortie.includes(">"), "un chevron fermant est sorti intact");
  assert.ok(sortie.includes("\\u003c"), "le chevron n'a pas été échappé en \\u003c");
});

test("jsonLdScript échappe aussi l'esperluette", () => {
  // `&lt;` dans une donnée pourrait sinon être réinterprété par le navigateur.
  const sortie = jsonLdScript({ headline: "Cacao & marchés" });
  assert.ok(!sortie.includes("&"), "une esperluette est sortie intacte");
  assert.ok(sortie.includes("\\u0026"));
});

test("jsonLdScript reste du JSON valide et préserve la donnée", () => {
  const donnees = {
    "@type": "NewsArticle",
    headline: "Côte d'Ivoire : <b>cacao</b> & récolte",
    author: { name: "Awa Koné" },
  };
  const relu = JSON.parse(jsonLdScript(donnees));

  // L'échappement Unicode est transparent à la lecture : les moteurs de
  // recherche retrouvent exactement la donnée d'origine.
  assert.deepEqual(relu, donnees);
});

test("xmlEscape protège les cinq caractères réservés", () => {
  assert.equal(xmlEscape(`<a href="x">Tom & Jerry's</a>`), "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;");
});
