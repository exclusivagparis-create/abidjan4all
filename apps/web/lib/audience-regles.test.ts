import { strict as assert } from "node:assert";
import { test } from "node:test";
import { appareilDepuisUa, estUnRobot, natureDuChemin } from "./audience-regles";

/**
 * Ces contrôles existent parce que la mesure d'audience donnait, le 19 octobre
 * 2026, 50 % de visites américaines et 2 % ivoiriennes pour un média
 * d'Abidjan. La cause tenait en deux points : la mesure tournait au rendu
 * serveur, donc tout programme récupérant le HTML comptait ; et la liste des
 * robots ignorait les moissonneurs récents.
 */
test("les navigateurs ordinaires ne sont pas pris pour des robots", () => {
  const vrais = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  ];
  for (const ua of vrais) {
    assert.equal(estUnRobot(ua), false, `pris à tort pour un robot : ${ua.slice(0, 50)}`);
  }
});

test("les moissonneurs qui s'annoncent sont écartés", () => {
  const robots = [
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot",
    "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    "Mozilla/5.0 (compatible; PerplexityBot/1.0)",
    "Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)",
    "Mozilla/5.0 (compatible; CCBot/2.0; https://commoncrawl.org/faq/)",
    "Mozilla/5.0 (compatible; Amazonbot/0.1)",
    "Mozilla/5.0 (compatible; SemrushBot/7~bl)",
    "Mozilla/5.0 (compatible; AhrefsBot/7.0)",
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
    "curl/8.4.0",
    "python-requests/2.31.0",
    "node-fetch/1.0",
    "axios/1.6.2",
    "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36",
    "Java/17.0.2",
    "Apache-HttpClient/4.5.13",
  ];
  for (const ua of robots) {
    assert.equal(estUnRobot(ua), true, `non détecté : ${ua.slice(0, 50)}`);
  }
});

/**
 * Un agent vide est la marque d'un appel automatisé : aucun navigateur n'en
 * envoie. On refuse plutôt que de compter un visiteur dont on ne sait rien.
 */
test("un agent absent compte pour un robot", () => {
  assert.equal(estUnRobot(""), true);
});

test("la nature du chemin distingue l'article du reste", () => {
  assert.equal(natureDuChemin("/"), "accueil");
  assert.equal(natureDuChemin("/videos"), "video");
  assert.equal(natureDuChemin("/podcasts"), "podcast");
  assert.equal(natureDuChemin("/sport"), "rubrique");
  assert.equal(natureDuChemin("/sport/un-titre-quelconque"), "article");
});

test("l'appareil se déduit du navigateur annoncé", () => {
  assert.equal(
    appareilDepuisUa("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148 Safari/604.1"),
    "mobile"
  );
  assert.equal(appareilDepuisUa("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0 Safari/537.36"), "desktop");
});
