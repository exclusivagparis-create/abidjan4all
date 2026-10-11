import { strict as assert } from "node:assert";
import { test } from "node:test";
import { publiciteAutorisee } from "./pages-sans-publicite";

/**
 * Ces contrôles tiennent un avertissement de compte AdSense : ils disent
 * explicitement où la balise part et où elle ne part pas.
 */
test("les pages éditoriales portent la balise", () => {
  for (const chemin of [
    "/",
    "/actualite",
    "/actualite/un-article-quelconque",
    "/videos",
    "/podcasts",
    "/guide",
    "/guide/cote-d-ivoire",
    "/evenements",
    "/recherche",
    "/contact",
    "/politique-de-confidentialite",
    "/abonnement",
    "/publicite",
  ]) {
    assert.equal(publiciteAutorisee(chemin), true, `${chemin} devrait porter la balise`);
  }
});

test("les écrans sans contenu éditorial ne la portent pas", () => {
  for (const chemin of [
    "/login",
    "/inscription",
    "/mot-de-passe-oublie",
    "/definir-mot-de-passe",
    "/verification-email",
    "/verifie",
    "/parametres",
    "/hors-ligne",
    "/newsletter/desabonnement",
    "/design",
    "/publicite/reserver",
  ]) {
    assert.equal(publiciteAutorisee(chemin), false, `${chemin} ne devrait pas la porter`);
  }
});

test("les sections privées sont exclues en entier", () => {
  for (const chemin of [
    "/admin",
    "/admin/articles",
    "/admin/articles/abc123",
    "/paiement/mock/cm123",
    "/paiement/mock-order/cm456",
    "/oauth/authorize",
    "/espace-membre",
    "/espace-membre/cv",
    "/espace-annonceur",
    "/recruteur",
  ]) {
    assert.equal(publiciteAutorisee(chemin), false, `${chemin} ne devrait pas la porter`);
  }
});

/**
 * Le piège du préfixe : exclure « /admin » ne doit pas emporter une rubrique
 * qui commencerait par les mêmes lettres. La rédaction peut créer n'importe
 * quelle rubrique, et une exclusion trop large coûterait des revenus en
 * silence.
 */
test("un préfixe n'emporte pas un chemin qui lui ressemble", () => {
  assert.equal(publiciteAutorisee("/administration-publique"), true);
  assert.equal(publiciteAutorisee("/paiements-mobiles"), true);
  assert.equal(publiciteAutorisee("/oauth-et-securite"), true);
  assert.equal(publiciteAutorisee("/logine"), true);
  assert.equal(publiciteAutorisee("/design-ivoirien"), true);
});

test("la barre finale ne change rien", () => {
  assert.equal(publiciteAutorisee("/login/"), false);
  assert.equal(publiciteAutorisee("/admin/"), false);
  assert.equal(publiciteAutorisee("/actualite/"), true);
  assert.equal(publiciteAutorisee("/"), true);
});

/**
 * Refus par défaut : le middleware transmet le chemin sur toutes les pages,
 * donc son absence est une anomalie, et des deux risques celui de l'annonce
 * déplacée est le plus cher.
 */
test("un chemin absent ou douteux refuse la balise", () => {
  assert.equal(publiciteAutorisee(null), false);
  assert.equal(publiciteAutorisee(undefined), false);
  assert.equal(publiciteAutorisee(""), false);
  assert.equal(publiciteAutorisee("actualite"), false, "un chemin sans barre initiale est douteux");
});
