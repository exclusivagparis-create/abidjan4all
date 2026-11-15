import { strict as assert } from "node:assert";
import { test } from "node:test";
import { construirePayload, signer, signatureValide, urlArticle, type ArticleADiffuser } from "./diffusion-regles";

const ARTICLE: ArticleADiffuser = {
  id: "art1",
  slug: "ouattara-ceremonie",
  title: "*Ouattara* à la cérémonie",
  dek: "  Le chef de l'État était présent.  ",
  tags: ["politique", "ouattara"],
  publishedAt: new Date("2026-11-15T09:30:00Z"),
  rubrique: { slug: "politique", name: "Politique" },
  author: { name: "A. Koné" },
  coverAsset: { url: "/uploads/photo.jpg" },
};

/**
 * Une adresse relative partie chez Facebook se résout contre facebook.com :
 * le lien mène alors nulle part, et personne ne s'en aperçoit avant que la
 * publication soit en ligne.
 */
test("l'adresse et l'image sont absolues", () => {
  const p = construirePayload(ARTICLE, "https://abidjan4all.info");
  assert.equal(p.article.url, "https://abidjan4all.info/politique/ouattara-ceremonie");
  assert.equal(p.article.image, "https://abidjan4all.info/uploads/photo.jpg");
});

test("une barre finale sur la racine ne double pas", () => {
  assert.equal(
    urlArticle("https://abidjan4all.info/", "politique", "x"),
    "https://abidjan4all.info/politique/x"
  );
  const p = construirePayload(ARTICLE, "https://abidjan4all.info/");
  assert.ok(!p.article.image!.includes("//uploads"), "pas de double barre devant l'image");
});

test("le balisage d'emphase des titres ne part pas sur les réseaux", () => {
  // La rédaction pose des astérisques dans les titres ; Facebook les afficherait tels quels.
  assert.equal(construirePayload(ARTICLE, "https://x.fr").article.titre, "Ouattara à la cérémonie");
});

test("le chapeau est nettoyé, et vide devient absent", () => {
  assert.equal(construirePayload(ARTICLE, "https://x.fr").article.chapeau, "Le chef de l'État était présent.");
  const sansChapeau = { ...ARTICLE, dek: "   " };
  assert.equal(construirePayload(sansChapeau, "https://x.fr").article.chapeau, null);
});

test("un article sans couverture ne prétend pas en avoir une", () => {
  const sansImage = { ...ARTICLE, coverAsset: null };
  assert.equal(construirePayload(sansImage, "https://x.fr").article.image, null);
});

test("un auteur sans nom ne laisse pas « null » sur la page", () => {
  const anonyme = { ...ARTICLE, author: { name: null } };
  assert.equal(construirePayload(anonyme, "https://x.fr").article.auteur, "La rédaction");
});

test("le payload est versionné", () => {
  // Un flux Activepieces déjà construit lit des champs : les renommer sans
  // changer la version casserait la diffusion en silence.
  const p = construirePayload(ARTICLE, "https://x.fr");
  assert.equal(p.version, 1);
  assert.equal(p.evenement, "article.publie");
});

/**
 * L'automate est joignable depuis l'extérieur. Sans signature, qui connaît son
 * adresse peut faire publier ce qu'il veut sur la page officielle.
 */
test("la signature authentifie le corps exact", () => {
  const corps = JSON.stringify({ a: 1 });
  const s = signer(corps, "secret");
  assert.match(s, /^[0-9a-f]{64}$/);
  assert.ok(signatureValide(corps, "secret", s));
});

test("un corps modifié, même d'un caractère, invalide la signature", () => {
  const s = signer(JSON.stringify({ a: 1 }), "secret");
  assert.equal(signatureValide(JSON.stringify({ a: 2 }), "secret", s), false);
});

test("un autre secret ne signe pas", () => {
  const corps = JSON.stringify({ a: 1 });
  assert.equal(signatureValide(corps, "autre", signer(corps, "secret")), false);
});

test("une signature de longueur inattendue est refusée sans lever", () => {
  // timingSafeEqual lève si les tampons diffèrent en taille — d'où le garde-fou.
  const corps = JSON.stringify({ a: 1 });
  assert.equal(signatureValide(corps, "secret", "court"), false);
  assert.equal(signatureValide(corps, "secret", ""), false);
});

test("les mots-clés sont plafonnés", () => {
  const bavard = { ...ARTICLE, tags: Array.from({ length: 30 }, (_, i) => `t${i}`) };
  assert.equal(construirePayload(bavard, "https://x.fr").article.motsCles.length, 12);
});
