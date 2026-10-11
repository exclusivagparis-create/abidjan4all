import { strict as assert } from "node:assert";
import { test } from "node:test";
import { motifLisible, nomFormat, resumeRejets } from "./regie-motifs";

/**
 * Un message de diagnostic faux envoie la régie chercher au mauvais endroit —
 * plus coûteux que pas de message du tout. D'où ces contrôles sur le texte
 * lui-même.
 */
test("chaque motif nomme la campagne et dit quoi faire", () => {
  const m = motifLisible({ type: "statut", campagne: "Orange CI", statut: "draft" });
  assert.ok(m.includes("Orange CI"), "la campagne est nommée");
  assert.ok(m.includes("brouillon"), "le statut est traduit");
  assert.ok(m.includes("actif"), "le geste à faire est indiqué");
});

test("le statut brouillon est la cause la plus courante, et elle est explicite", () => {
  assert.match(
    motifLisible({ type: "statut", campagne: "Wave", statut: "draft" }),
    /brouillon.*active est diffusée/s
  );
  assert.match(
    motifLisible({ type: "statut", campagne: "Wave", statut: "pending_review" }),
    /en attente de validation/
  );
  // Un statut inconnu ne doit pas produire « undefined ».
  assert.match(motifLisible({ type: "statut", campagne: "X", statut: "zarbi" }), /est zarbi/);
});

/**
 * Le piège le plus discret du ciblage : une campagne ciblée par rubrique ne
 * sort jamais sur l'accueil, qui n'appartient à aucune rubrique. Le message
 * doit le dire, sinon on cherche pendant une heure.
 */
test("le ciblage par rubrique distingue la page sans rubrique", () => {
  const accueil = motifLisible({
    type: "ciblage_rubrique",
    campagne: "MTN",
    visees: ["sport", "politique"],
    page: null,
  });
  assert.ok(accueil.includes("sport et politique"));
  assert.ok(accueil.includes("aucune rubrique"), "le cas de l'accueil est nommé");
  assert.ok(accueil.includes("Vidéos"), "et la page Vidéos avec");

  const rubrique = motifLisible({
    type: "ciblage_rubrique",
    campagne: "MTN",
    visees: ["sport"],
    page: "culture",
  });
  assert.ok(rubrique.includes("« culture »"));
  assert.ok(rubrique.includes("Ajoutez"), "le geste est indiqué");
});

/**
 * Le ciblage géographique se retourne contre la maison : la rédaction à Paris
 * ne verra jamais une campagne ciblée Côte d'Ivoire et en conclura une panne.
 * Le message doit couper court à ce malentendu.
 */
test("le ciblage géographique dit que la campagne marche, mais pas pour vous", () => {
  const m = motifLisible({ type: "ciblage_geo", campagne: "NSIA", visees: ["CI"], actuel: "FR" });
  assert.ok(m.includes("CI"));
  assert.ok(m.includes("FR"));
  assert.ok(m.includes("s’affiche bien, mais pas pour vous"), "le malentendu est désamorcé");

  // Pays indéterminé : ne pas écrire « depuis null ».
  const inconnu = motifLisible({ type: "ciblage_geo", campagne: "NSIA", visees: ["CI"], actuel: null });
  assert.ok(!inconnu.includes("null"));
  assert.ok(inconnu.includes("pas pu déterminer"));
});

test("le format absent nomme le format attendu et ceux qui existent", () => {
  const m = motifLisible({
    type: "format_absent",
    campagne: "Ecobank",
    attendu: "leaderboard_728x90",
    disponibles: ["mpu_300x250", "native"],
  });
  assert.ok(m.includes("bandeau 728 × 90"), "le format attendu, en clair");
  assert.ok(m.includes("pavé 300 × 250 et natif"), "et ceux dont elle dispose");
});

test("les plafonds donnent le chiffre atteint et la limite", () => {
  assert.match(
    motifLisible({ type: "plafond_impressions", campagne: "Jumia", atteint: 5000, plafond: 5000 }),
    /5000 sur 5000/
  );
  assert.match(
    motifLisible({ type: "plafond_clics", campagne: "Jumia", atteint: 120, plafond: 100 }),
    /120 sur 100/
  );
});

test("les dates sont écrites en français, pas en ISO", () => {
  const m = motifLisible({ type: "terminee", campagne: "Bolloré", fin: new Date("2026-09-30T12:00:00Z") });
  assert.ok(m.includes("30 septembre 2026"), `attendu une date lisible, obtenu : ${m}`);
  assert.ok(!m.includes("2026-09-30"));
  assert.ok(m.includes("permanente"), "l'échappatoire est indiquée");
});

test("un format inconnu ne casse rien", () => {
  assert.equal(nomFormat("mpu_300x250"), "pavé 300 × 250");
  assert.equal(nomFormat("format_de_demain"), "format_de_demain");
});

test("le résumé compte plutôt que d'énumérer", () => {
  assert.equal(resumeRejets([]), "Aucune campagne éligible");
  assert.equal(resumeRejets([{ type: "aucune_campagne" }]), "Régie vide");
  assert.equal(
    resumeRejets([
      { type: "statut", campagne: "A", statut: "draft" },
      { type: "statut", campagne: "B", statut: "draft" },
    ]),
    "2 campagnes écartées"
  );
  assert.equal(resumeRejets([{ type: "statut", campagne: "A", statut: "draft" }]), "1 campagne écartée");
});

/**
 * Aucun motif ne doit rendre une chaîne vide : le cadre afficherait un espace
 * blanc là où on attend une explication, et on douterait de l'outil.
 */
test("aucun motif ne rend une phrase vide", () => {
  const tous = [
    { type: "aucune_campagne" },
    { type: "statut", campagne: "A", statut: "draft" },
    { type: "pas_commencee", campagne: "A", debut: new Date() },
    { type: "terminee", campagne: "A", fin: new Date() },
    { type: "aucune_banniere_active", campagne: "A" },
    { type: "plafond_impressions", campagne: "A", atteint: 1, plafond: 1 },
    { type: "plafond_clics", campagne: "A", atteint: 1, plafond: 1 },
    { type: "ciblage_rubrique", campagne: "A", visees: ["x"], page: null },
    { type: "ciblage_appareil", campagne: "A", vise: "mobile", actuel: null },
    { type: "ciblage_geo", campagne: "A", visees: [], actuel: null },
    { type: "ciblage_tags", campagne: "A", visees: ["x"], page: [] },
    { type: "format_absent", campagne: "A", attendu: "native", disponibles: [] },
  ] as const;
  for (const r of tous) {
    const m = motifLisible(r as never);
    assert.ok(m.length > 20, `motif ${r.type} trop court : « ${m} »`);
    assert.ok(!m.includes("undefined"), `motif ${r.type} contient undefined`);
    assert.ok(!m.includes("null"), `motif ${r.type} contient null`);
  }
});
