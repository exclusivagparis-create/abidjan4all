import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@a4a/db";
import { adresseDesEntetes } from "@/lib/limite-debit";

/**
 * Mesure d'audience maison, sans cookie ni service tiers.
 *
 * Choix RGPD : l'adresse IP sert au calcul puis est jetée — jamais stockée.
 * L'empreinte visiteur est salée avec un secret QUOTIDIEN tiré au hasard au
 * démarrage : elle distingue les visiteurs sur la journée, et devient
 * inexploitable ensuite (impossible de relier deux jours, ni de retrouver
 * une IP par force brute puisque le sel est inconnu et change).
 *
 * Aucun cookie n'étant posé, la mesure compte AUSSI les lecteurs qui refusent
 * le bandeau — contrairement à Google Analytics.
 */

/** Fenêtre d'inactivité au-delà de laquelle on compte une nouvelle visite. */
const SESSION_MINUTES = 30;

let selDuJour = randomBytes(32).toString("hex");
let jourDuSel = new Date().toISOString().slice(0, 10);

function sel(): string {
  const aujourdHui = new Date().toISOString().slice(0, 10);
  if (aujourdHui !== jourDuSel) {
    selDuJour = randomBytes(32).toString("hex");
    jourDuSel = aujourdHui;
  }
  return selDuJour;
}

/**
 * Adresse du visiteur, d'après `X-Forwarded-For`.
 *
 * Le Caddyfile remplace cet en-tête par l'adresse du pair au lieu de s'y
 * ajouter : le premier maillon est donc celui du visiteur, et non une valeur
 * qu'il aurait écrite lui-même. Avant ce réglage, le sel quotidien comme le
 * pays d'origine reposaient sur une donnée fournie par l'appelant.
 */
export function ipDeLaRequete(h: Headers): string | null {
  // Une seule lecture de l'en-tête dans tout le dépôt : celle de la limitation
  // de débit. La logique était dupliquée ici, à un détail près — de quoi
  // corriger un jour l'une sans l'autre.
  const adresse = adresseDesEntetes(h);
  return adresse === "inconnu" ? null : adresse;
}

/**
 * Chargement paresseux de la base pays.
 *
 * Surtout PAS en import de module : geoip-lite lit ses fichiers `.dat` sur le
 * disque, et un import raté fait tomber TOUTES les pages avec une 500 — un
 * `try/catch` autour de l'appel n'y peut rien, l'erreur survient à l'import.
 * Ici, si la base manque, le pays vaut simplement null et le site continue.
 */
type Geoip = { lookup: (ip: string) => { country?: string } | null };
let geoip: Geoip | null | undefined;

function chargerGeoip(): Geoip | null {
  if (geoip !== undefined) return geoip;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    geoip = require("geoip-lite") as Geoip;
  } catch (e) {
    console.error("[audience] base pays indisponible — pays non renseigné :", e);
    geoip = null;
  }
  return geoip;
}

export function paysDepuisIp(ip: string | null): string | null {
  if (!ip) return null;
  try {
    return chargerGeoip()?.lookup(ip)?.country ?? null;
  } catch {
    return null;
  }
}

/** Téléphone ou tablette, d'après le navigateur annoncé. */
export function appareilDepuisUa(ua: string): "mobile" | "desktop" {
  return /Mobile|Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(ua) ? "mobile" : "desktop";
}

/** Robots connus — exclus des statistiques, sinon les chiffres sont faux. */
const ROBOT =
  /bot|crawl|spider|scanner|curl|wget|python|scrapy|semrush|ahrefs|censys|zgrab|masscan|Go-http|okhttp|monitoring|uptime|headless|lighthouse|facebookexternalhit|WhatsApp|Twitterbot|TelegramBot|Discordbot|Slackbot|preview/i;
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

/**
 * Enregistre une page vue. Ne lève JAMAIS : une panne de mesure ne doit pas
 * empêcher la page de s'afficher.
 */
export async function enregistrerPageVue(opts: {
  path: string;
  userAgent: string;
  ip: string | null;
}): Promise<void> {
  try {
    if (estUnRobot(opts.userAgent)) return;

    const visitorHash = createHash("sha256")
      .update(`${sel()}|${opts.ip ?? "?"}|${opts.userAgent}`)
      .digest("hex")
      .slice(0, 32);

    // Même visiteur revu dans les 30 min : on prolonge sa visite en cours.
    const depuis = new Date(Date.now() - SESSION_MINUTES * 60_000);
    const precedente = await prisma.pageView.findFirst({
      where: { visitorHash, createdAt: { gte: depuis } },
      orderBy: { createdAt: "desc" },
      select: { sessionId: true },
    });

    // Compteur « Lu N fois » affiché sous la signature de l'article.
    //
    // Le champ `views` existait depuis l'origine mais n'était incrémenté nulle
    // part : il valait zéro partout, ce qui rendait aussi le bloc « Les plus
    // lus » de l'accueil arbitraire, puisqu'il trie là-dessus.
    //
    // On compte ici plutôt que dans la page : ce chemin écarte déjà les robots
    // et connaît le visiteur. Et on ne compte qu'UNE FOIS par visiteur et par
    // article dans la fenêtre de session — sans quoi un rechargement, ou un
    // lecteur qui revient en arrière, gonflerait le chiffre. Un compteur de
    // lectures qu'on peut faire monter en appuyant sur F5 n'informe personne.
    if (natureDuChemin(opts.path) === "article") {
      const dejaVu = await prisma.pageView.findFirst({
        where: { visitorHash, path: opts.path, createdAt: { gte: depuis } },
        select: { id: true },
      });
      if (!dejaVu) {
        const slug = opts.path.split("/").filter(Boolean).pop();
        if (slug) {
          // `updateMany` et non `update` : le chemin peut ne correspondre à
          // aucun article publié (aperçu, page inconnue), et cela ne doit pas
          // lever. Le filtre sur le statut évite de compter les lectures d'un
          // brouillon prévisualisé par la rédaction.
          await prisma.article.updateMany({
            where: { slug, status: "published" },
            data: { views: { increment: 1 } },
          });
        }
      }
    }

    await prisma.pageView.create({
      data: {
        path: opts.path.slice(0, 300),
        kind: natureDuChemin(opts.path),
        visitorHash,
        sessionId: precedente?.sessionId ?? randomBytes(12).toString("hex"),
        device: appareilDepuisUa(opts.userAgent),
        country: paysDepuisIp(opts.ip),
      },
    });
  } catch (e) {
    console.error("[audience] enregistrement ignoré :", e);
  }
}
