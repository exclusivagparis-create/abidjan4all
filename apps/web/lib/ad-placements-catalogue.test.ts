import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  PLACEMENTS,
  emplacementCible,
  getPlacement,
  libellePlacement,
  placementsValides,
} from "./ad-placements-catalogue";

test("le catalogue couvre les douze emplacements, sans doublon", () => {
  assert.equal(PLACEMENTS.length, 12);
  assert.equal(new Set(PLACEMENTS.map((p) => p.slug)).size, 12, "aucun identifiant en double");
  for (const p of PLACEMENTS) {
    assert.ok(p.label.length > 3, `${p.slug} doit porter un libellé`);
    assert.ok(p.zone.length > 3, `${p.slug} doit décrire sa zone`);
  }
});

test("chaque emplacement se retrouve par son identifiant", () => {
  assert.equal(getPlacement("article_mpu")?.format, "mpu_300x250");
  assert.equal(getPlacement("site_leaderboard")?.page, "Global");
  assert.equal(getPlacement("inconnu"), undefined);
});

test("un libellé inconnu se replie sur l'identifiant, sans casser", () => {
  assert.equal(libellePlacement("article_mpu"), "Article — pavé");
  assert.equal(libellePlacement("emplacement_de_demain"), "emplacement_de_demain");
});

/**
 * Le garde-fou de la saisie : un identifiant inventé dans le formulaire ne
 * doit pas entrer en base. Il y dormirait sans jamais correspondre à rien, et
 * la campagne semblerait ciblée alors qu'elle ne sortirait nulle part — le
 * genre de panne qu'on met des heures à comprendre.
 */
test("les identifiants reçus d'un formulaire sont filtrés sur le catalogue", () => {
  assert.deepEqual(placementsValides(["article_mpu", "home_mpu"]), ["article_mpu", "home_mpu"]);
  assert.deepEqual(placementsValides(["article_mpu", "inventé"]), ["article_mpu"]);
  assert.deepEqual(placementsValides([]), []);
  assert.deepEqual(placementsValides(["nawak", ""]), []);
});

test("les doublons sont écartés", () => {
  assert.deepEqual(placementsValides(["home_mpu", "home_mpu", "home_mpu"]), ["home_mpu"]);
});

/**
 * Trois emplacements partagent le format « pavé ». C'est précisément ce qui
 * rendait le ciblage par format insuffisant : vendre « le pavé des articles »
 * était impossible, on vendait les trois.
 */
test("plusieurs emplacements partagent un même format", () => {
  const paves = PLACEMENTS.filter((p) => p.format === "mpu_300x250").map((p) => p.slug);
  assert.deepEqual(paves.sort(), ["article_mpu", "home_mpu", "rubrique_mpu"]);
  const bandeaux = PLACEMENTS.filter((p) => p.format === "leaderboard_728x90");
  assert.equal(bandeaux.length, 1, "le bandeau, lui, est unique");
});

/**
 * Le ciblage par emplacement : ce que l'annonceur a acheté, et rien d'autre.
 * C'est la règle qui manquait — la régie vend des emplacements, pas des formats.
 */
test("une campagne ne sort que sur les emplacements achetés", () => {
  const achetes = ["article_mpu", "article_native"];
  assert.equal(emplacementCible(achetes, "article_mpu"), true);
  assert.equal(emplacementCible(achetes, "article_native"), true);
  assert.equal(emplacementCible(achetes, "home_mpu"), false, "l'accueil n'a pas été acheté");
  assert.equal(emplacementCible(achetes, "rubrique_mpu"), false);
  assert.equal(emplacementCible(achetes, "site_leaderboard"), false);
});

/**
 * Les campagnes créées avant cette règle n'ont pas de liste d'emplacements.
 * Elles doivent continuer de sortir partout où leur format est accepté : on ne
 * change pas la diffusion d'une campagne vendue sous l'ancienne règle.
 */
test("une campagne sans emplacement acheté sort partout, comme avant", () => {
  for (const vide of [undefined, []]) {
    assert.equal(emplacementCible(vide, "home_mpu"), true);
    assert.equal(emplacementCible(vide, "article_native"), true);
    assert.equal(emplacementCible(vide, "site_leaderboard"), true);
  }
});

test("un emplacement courant inconnu ne fait refuser personne", () => {
  // On ne refuse pas sur une information qu'on n'a pas.
  assert.equal(emplacementCible(["article_mpu"], undefined), true);
  assert.equal(emplacementCible(["article_mpu"], ""), true);
});
