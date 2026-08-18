/**
 * Téléchargement d'une image distante pour la médiathèque.
 *
 * Faire télécharger au serveur une adresse fournie par un tiers est un
 * classique des failles dites SSRF : le serveur, lui, voit le réseau interne.
 * Une adresse comme http://127.0.0.1:3000/api/… ou http://169.254.169.254/
 * (métadonnées d'hébergeur) lui ferait rapatrier des données que personne ne
 * devrait voir — et, ici, les publierait dans la médiathèque, donc sur le web.
 *
 * Le risque n'est pas théorique dans notre cas : le connecteur MCP est piloté
 * par un modèle qui lit des contenus extérieurs. Une consigne glissée dans une
 * page pourrait lui faire appeler cet outil sur une adresse interne.
 *
 * D'où les cinq verrous ci-dessous : protocole, adresse IP résolue, redirections
 * revalidées une à une, taille plafonnée pendant la lecture, et type de fichier
 * déterminé par les octets eux-mêmes — jamais par ce que le serveur distant
 * prétend.
 */
import { lookup } from "node:dns/promises";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAX_UPLOAD, UPLOAD_DIR } from "@/lib/uploads";

const DELAI_MS = 15_000;
const REDIRECTIONS_MAX = 3;

/** Formats acceptés, reconnus à leurs octets d'en-tête. */
const SIGNATURES: { ext: string; mime: string; test: (b: Buffer) => boolean }[] = [
  { ext: "jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: "png",
    mime: "image/png",
    test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  { ext: "gif", mime: "image/gif", test: (b) => b.subarray(0, 6).toString("ascii").match(/^GIF8[79]a$/) !== null },
  {
    ext: "webp",
    mime: "image/webp",
    test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

// Le SVG est volontairement absent : c'est du XML exécutable, il peut porter du
// script. Un administrateur peut en déposer un depuis le Studio, en connaissance
// de cause ; on ne va pas en rapatrier depuis une adresse quelconque.

// ---------------------------------------------------------------------------
// Contrôle des adresses
// ---------------------------------------------------------------------------

/** Adresse IPv4 réservée, privée ou autrement non routable sur l'internet. */
function ipv4Interne(ip: string): boolean {
  const o = ip.split(".").map(Number);
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = o as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 169 && b === 254) return true; // lien-local, métadonnées d'hébergeur
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 et 192.0.2.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // bancs d'essai
  if (a >= 224) return true; // multicast et réservé
  return false;
}

function ipInterne(ip: string): boolean {
  const brut = ip.toLowerCase();
  if (brut.includes(".")) {
    // Forme IPv4 pure, ou IPv4 encapsulée en IPv6 (::ffff:192.168.0.1).
    return ipv4Interne(brut.slice(brut.lastIndexOf(":") + 1));
  }
  if (brut === "::1" || brut === "::" || brut === "0:0:0:0:0:0:0:1") return true;
  if (/^f[cd]/.test(brut)) return true; // fc00::/7, adresses locales uniques
  if (/^fe[89ab]/.test(brut)) return true; // fe80::/10, lien-local
  if (/^ff/.test(brut)) return true; // multicast
  return false;
}

/**
 * Vérifie qu'une URL est publique : protocole autorisé, et TOUTES les adresses
 * IP derrière le nom de domaine sont routables. Un nom peut résoudre vers
 * plusieurs adresses ; il suffit d'une interne pour refuser.
 */
async function adressePublique(u: URL): Promise<{ ok: true } | { ok: false; erreur: string }> {
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, erreur: `Protocole refusé (${u.protocol}). Seuls http et https sont acceptés.` };
  }

  let adresses: { address: string }[];
  try {
    adresses = await lookup(u.hostname, { all: true });
  } catch {
    return { ok: false, erreur: `Nom de domaine introuvable : ${u.hostname}` };
  }
  if (adresses.length === 0) return { ok: false, erreur: `Nom de domaine sans adresse : ${u.hostname}` };

  const fautive = adresses.find((a) => ipInterne(a.address));
  if (fautive) {
    return {
      ok: false,
      erreur: `Adresse interne refusée (${u.hostname} → ${fautive.address}). Seules les images publiques sont acceptées.`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Téléchargement
// ---------------------------------------------------------------------------

/** Lit le corps en s'arrêtant net au-delà du plafond, sans le charger d'abord. */
async function lireAvecPlafond(reponse: Response, plafond: number): Promise<Buffer | null> {
  const flux = reponse.body?.getReader();
  if (!flux) return null;

  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await flux.read();
    if (done) break;
    total += value.length;
    if (total > plafond) {
      await flux.cancel().catch(() => undefined);
      return null;
    }
    morceaux.push(value);
  }
  return Buffer.concat(morceaux);
}

export type ResultatTelechargement =
  | { ok: true; url: string; nom: string; taille: number; mime: string }
  | { ok: false; erreur: string };

/**
 * Télécharge une image publique et l'écrit dans le dossier des téléversements.
 * Ne touche pas à la base : l'appelant crée l'entrée MediaAsset.
 */
export async function telechargerImage(
  urlSource: string,
  nomSouhaite?: string
): Promise<ResultatTelechargement> {
  let cible: URL;
  try {
    cible = new URL(urlSource);
  } catch {
    return { ok: false, erreur: "Adresse illisible." };
  }

  // Les redirections sont suivies à la main : chaque étape est revalidée, sinon
  // une adresse publique pourrait rediriger vers une adresse interne.
  let reponse: Response;
  for (let saut = 0; ; saut++) {
    const controle = await adressePublique(cible);
    if (!controle.ok) return { ok: false, erreur: controle.erreur };

    try {
      reponse = await fetch(cible, {
        redirect: "manual",
        signal: AbortSignal.timeout(DELAI_MS),
        headers: { accept: "image/*", "user-agent": "Abidjan4All/1.0 (mediatheque)" },
      });
    } catch (e) {
      const motif = e instanceof Error && e.name === "TimeoutError" ? "délai dépassé" : "injoignable";
      return { ok: false, erreur: `Téléchargement impossible (${motif}).` };
    }

    if (reponse.status < 300 || reponse.status >= 400) break;

    const suite = reponse.headers.get("location");
    if (!suite) return { ok: false, erreur: "Redirection sans destination." };
    if (saut >= REDIRECTIONS_MAX) return { ok: false, erreur: "Trop de redirections." };
    try {
      cible = new URL(suite, cible);
    } catch {
      return { ok: false, erreur: "Redirection illisible." };
    }
  }

  if (!reponse.ok) {
    return { ok: false, erreur: `Le serveur distant a répondu ${reponse.status}.` };
  }

  // Refus immédiat si la taille annoncée dépasse déjà le plafond.
  const annoncee = Number(reponse.headers.get("content-length") ?? 0);
  if (annoncee > MAX_UPLOAD) {
    return { ok: false, erreur: `Image trop lourde (${Math.round(annoncee / 1024 / 1024)} Mo, 8 Mo maximum).` };
  }

  const corps = await lireAvecPlafond(reponse, MAX_UPLOAD);
  if (!corps) return { ok: false, erreur: "Image trop lourde (8 Mo maximum)." };
  if (corps.length === 0) return { ok: false, erreur: "Fichier vide." };

  // Le type vient des octets, pas de l'en-tête : un serveur distant peut
  // annoncer image/jpeg et servir tout autre chose.
  const format = SIGNATURES.find((s) => s.test(corps));
  if (!format) {
    return {
      ok: false,
      erreur: "Ce fichier n'est pas une image reconnue (formats acceptés : jpg, png, gif, webp).",
    };
  }

  const base = nettoyerNom(nomSouhaite) ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const nom = `${base}.${format.ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, nom), corps);

  return { ok: true, url: `/uploads/${nom}`, nom, taille: corps.length, mime: format.mime };
}

/**
 * Réduit un nom proposé à un identifiant sûr. Renvoie null si rien d'utilisable
 * ne subsiste — l'appelant retombe alors sur un nom généré. Un suffixe aléatoire
 * évite qu'un import écrase l'image d'un autre.
 */
function nettoyerNom(propose?: string): string | null {
  if (!propose) return null;
  const base = propose
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/, "") // extension éventuelle : on impose la nôtre
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (!base) return null;
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}
