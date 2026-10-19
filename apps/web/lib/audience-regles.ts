/**
 * Règles de la mesure d'audience — qui compte, et pour quoi.
 *
 * Séparé de `audience.ts`, qui est `server-only` et charge la base pays : ces
 * trois décisions sont les plus faciles à casser de tout le module, et les
 * seules qu'un contrôle unitaire puisse tenir. Même frontière que
 * `roles.ts` / `garde-role.ts`.
 *
 * `audience.ts` réexporte tout ce qui suit : les imports existants ne bougent
 * pas.
 */

/**
 * Robots connus — exclus des statistiques, sinon les chiffres sont faux.
 *
 * Cette liste ne suffit pas, et il faut le savoir : elle n'attrape que les
 * machines qui s'annoncent. Relevé le 19 octobre 2026 dans les statistiques du
 * Studio, ce filtre déjà appliqué :
 *
 *   Japon          2 958 visites   1,01 page par visite
 *   Brésil           239 visites   1,00
 *   Afrique du Sud   203 visites   1,00
 *   France         1 204 visites   2,02
 *   Allemagne        865 visites   1,68
 *
 * Une page, jamais une seconde : des machines qui se présentent comme des
 * navigateurs ordinaires. La France et l'Allemagne, qui en lisent deux, sont
 * des gens.
 *
 * D'où la vraie parade, qui n'est pas ici : la mesure est déclenchée depuis le
 * NAVIGATEUR (components/audience-tracker.tsx), si bien qu'un programme qui
 * n'exécute pas de script ne se voit plus, quel que soit le nom qu'il se
 * donne. Cette liste reste en première ligne, pour les robots honnêtes et pour
 * les appels directs à l'adresse de mesure.
 */
const ROBOT =
  /bot|crawl|spider|scanner|curl|wget|python|scrapy|semrush|ahrefs|censys|zgrab|masscan|Go-http|okhttp|monitoring|uptime|headless|lighthouse|facebookexternalhit|WhatsApp|Twitterbot|TelegramBot|Discordbot|Slackbot|preview|GPTBot|ClaudeBot|Claude-Web|anthropic|CCBot|PerplexityBot|Bytespider|Amazonbot|Applebot|meta-external|Google-Extended|DataForSeo|BLEXBot|MJ12|DotBot|Barkrowler|SeekportBot|SerpstatBot|ImagesiftBot|Timpibot|node-fetch|axios|HeadlessChrome|PhantomJS|Playwright|Puppeteer|libwww|Java\/|Apache-HttpClient/i;

/** Un agent vide compte pour un robot : aucun navigateur n'en envoie. */
export function estUnRobot(ua: string): boolean {
  return !ua || ROBOT.test(ua);
}

/** Nature de la page — alimente les compteurs « vidéos vues », « podcasts vus »… */
export function natureDuChemin(path: string): string {
  if (path === "/videos" || path.startsWith("/videos/")) return "video";
  if (path === "/podcasts" || path.startsWith("/podcasts/")) return "podcast";
  if (path === "/") return "accueil";
  // /rubrique/slug = un article ; /rubrique seul = une page de rubrique
  const segments = path.split("/").filter(Boolean);
  if (segments.length >= 2) return "article";
  if (segments.length === 1) return "rubrique";
  return "autre";
}

/** Mobile ou ordinateur, d'après le navigateur annoncé. */
export function appareilDepuisUa(ua: string): "mobile" | "desktop" {
  return /Mobile|Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(ua) ? "mobile" : "desktop";
}
