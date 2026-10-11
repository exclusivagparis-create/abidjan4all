import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  SEUIL_BREVE_DEFAUT,
  SEUIL_MAX,
  SEUIL_MIN,
  estBreve,
  histogramme,
  portee,
  seuilValide,
} from "./qualite-editoriale";

test("le seuil retenu est de deux minutes", () => {
  assert.equal(SEUIL_BREVE_DEFAUT, 2);
  assert.equal(estBreve(1), true);
  assert.equal(estBreve(2), true, "deux minutes est une brève : seuil inclusif");
  assert.equal(estBreve(3), false);
});

/**
 * Un seuil hors bornes viderait l'index ou n'y toucherait pas. Les deux sont
 * des accidents, et un champ de formulaire ne doit pas pouvoir les provoquer.
 */
test("un seuil hasardeux est ramené dans les bornes", () => {
  assert.equal(seuilValide("3"), 3);
  assert.equal(seuilValide(0), SEUIL_MIN);
  assert.equal(seuilValide(-5), SEUIL_MIN);
  assert.equal(seuilValide(99), SEUIL_MAX);
  assert.equal(seuilValide("abc"), SEUIL_BREVE_DEFAUT);
  assert.equal(seuilValide(null), SEUIL_BREVE_DEFAUT, "absent : le seuil retenu, pas la borne basse");
  assert.equal(seuilValide(""), SEUIL_BREVE_DEFAUT, "champ vide : idem");
  assert.equal(seuilValide(undefined), SEUIL_BREVE_DEFAUT);
  assert.equal(seuilValide(2.5), SEUIL_BREVE_DEFAUT, "un seuil non entier n'a pas de sens");
});

test("l'histogramme compte les articles ET les vues de chaque tranche", () => {
  const h = histogramme(
    [
      { readingTime: 1, views: 2 },
      { readingTime: 1, views: 4 },
      { readingTime: 3, views: 90 },
      { readingTime: 4, views: 10 },
    ],
    2
  );
  assert.deepEqual(
    h.map((t) => [t.minutes, t.articles, t.part, t.vues, t.breve]),
    [
      [1, 2, 50, 6, true],
      [3, 1, 25, 90, false],
      [4, 1, 25, 10, false],
    ]
  );
});

test("l'histogramme d'un corpus vide ne divise pas par zéro", () => {
  assert.deepEqual(histogramme([]), []);
});

/**
 * La portée est ce que l'écran montre AVANT d'agir. Elle doit distinguer les
 * articles déjà retirés de ceux qui le seraient, sinon le chiffre annoncé
 * surestime l'effet et la rédaction perd confiance dans l'outil.
 */
test("la portée distingue le déjà-fait du reste-à-faire", () => {
  const p = portee(
    [
      { readingTime: 1, views: 3, noindex: false },
      { readingTime: 1, views: 1, noindex: true },
      { readingTime: 2, views: 5, noindex: false },
      { readingTime: 4, views: 80, noindex: false },
      { readingTime: 5, views: 60, noindex: true },
    ],
    2
  );
  assert.equal(p.vises, 3, "trois articles sous le seuil");
  assert.equal(p.dejaRetires, 1);
  assert.equal(p.aRetirer, 2);
  assert.equal(p.vuesPerdues, 8, "3 + 5 vues, sans compter celui déjà retiré");
  assert.equal(p.restants, 1, "seul l'article de 4 min resterait à l'index");
  assert.equal(p.retiresAuDessus, 1, "l'article de 5 min retiré à la main est signalé");
});

/**
 * Le garde-fou qui compte : une opération au seuil ne doit jamais réindexer un
 * article long que quelqu'un a retiré délibérément. Ce test fixe l'intention
 * pour que personne ne « simplifie » la fonction plus tard.
 */
test("un article long retiré à la main est signalé, pas réindexé", () => {
  const p = portee([{ readingTime: 9, views: 400, noindex: true }], 2);
  assert.equal(p.vises, 0);
  assert.equal(p.aRetirer, 0);
  assert.equal(p.retiresAuDessus, 1);
  assert.equal(p.restants, 0, "il ne compte pas parmi les pages indexées");
});

/**
 * Les vrais chiffres du corpus au 11 octobre 2026, en miniature : le seuil de
 * deux minutes vise bien plus des trois quarts du site, et c'est assumé.
 */
test("au seuil de deux minutes, la part visée dépasse les trois quarts", () => {
  const corpus = [
    ...Array.from({ length: 2147 }, () => ({ readingTime: 1, views: 3, noindex: false })),
    ...Array.from({ length: 1395 }, () => ({ readingTime: 2, views: 4, noindex: false })),
    ...Array.from({ length: 755 }, () => ({ readingTime: 3, views: 8, noindex: false })),
    ...Array.from({ length: 323 }, () => ({ readingTime: 4, views: 20, noindex: false })),
  ];
  const p = portee(corpus, 2);
  assert.equal(p.vises, 3542);
  assert.equal(p.restants, 1078);
  assert.ok(p.vises / corpus.length > 0.76, "plus des trois quarts");
});
