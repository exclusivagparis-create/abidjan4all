import { strict as assert } from "node:assert";
import { afterEach, test } from "node:test";
import { simulateurActif } from "./simulateur-paiement";

/**
 * Ce garde-fou décide si une page qui offre l'abonnement sans paiement existe
 * ou non. Il mérite des contrôles qui nomment chaque cas, y compris celui qui
 * a motivé tout ceci : la variable absente.
 */
const initial = process.env.PAYMENT_PROVIDER;
afterEach(() => {
  if (initial === undefined) delete process.env.PAYMENT_PROVIDER;
  else process.env.PAYMENT_PROVIDER = initial;
});

test("le vrai prestataire fait disparaître le simulateur", () => {
  process.env.PAYMENT_PROVIDER = "paydunya";
  assert.equal(simulateurActif(), false);
  // La casse ne doit pas rouvrir la porte.
  process.env.PAYMENT_PROVIDER = "PayDunya";
  assert.equal(simulateurActif(), false);
});

test("le simulateur reste disponible en développement", () => {
  process.env.PAYMENT_PROVIDER = "mock";
  assert.equal(simulateurActif(), true);
});

/**
 * Variable absente : `getProvider` retombe sur le simulateur. C'est le défaut
 * du développement, et c'est exactement pourquoi la page doit se garder
 * elle-même — un `.env` de production incomplet ne doit pas offrir les
 * abonnements, mais au moins le fera-t-il de façon visible et non silencieuse.
 */
test("sans variable, on est en mode simulateur — et on le sait", () => {
  delete process.env.PAYMENT_PROVIDER;
  assert.equal(simulateurActif(), true);
});

test("une valeur inconnue ne vaut pas le vrai prestataire", () => {
  process.env.PAYMENT_PROVIDER = "stripe";
  assert.equal(simulateurActif(), true);
});
