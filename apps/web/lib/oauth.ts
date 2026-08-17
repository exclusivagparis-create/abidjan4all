/**
 * OAuth 2.1 pour le connecteur MCP — le flux qu'attend l'application Claude.
 *
 * Déroulé complet :
 *   1. Claude appelle POST /oauth/register et se déclare (RFC 7591). Cela ne
 *      lui donne aucun droit : c'est une carte de visite, pas une clé.
 *   2. Claude ouvre GET /oauth/authorize dans le navigateur du rédacteur. Il
 *      doit être connecté au Studio ; un écran lui montre qui demande quoi.
 *   3. Le rédacteur clique « Autoriser » → redirection vers Claude avec un code
 *      à usage unique, valable dix minutes.
 *   4. Claude échange ce code contre un jeton sur POST /oauth/token, en
 *      prouvant par PKCE qu'il est bien celui qui a lancé la demande.
 *
 * Rien n'est délivré sans qu'un humain ait cliqué. Le jeton obtenu est un
 * ApiToken ordinaire : il apparaît dans Studio ▸ Accès API et s'y révoque.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@a4a/db";
import { SCOPE_IDS, type Scope } from "@/lib/api-auth";

/** Durée de vie d'un code d'autorisation. Court : il ne fait que transiter. */
export const CODE_TTL_MS = 10 * 60 * 1000;

/**
 * Durée de vie d'un jeton d'accès. Nous n'émettons pas de jeton de
 * rafraîchissement — un connecteur qui expire se réautorise en un clic, et
 * c'est une occasion de reconsidérer un accès dont on n'a plus l'usage.
 */
export const TOKEN_TTL_DAYS = 90;

export function empreinte(valeur: string): string {
  return createHash("sha256").update(valeur, "utf8").digest("hex");
}

/** Comparaison à temps constant de deux empreintes hexadécimales. */
export function memeEmpreinte(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** L'adresse du site, sans barre oblique finale — sert d'`issuer`. */
export function origine(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://abidjan4all.info").replace(/\/$/, "");
}

// ---------------------------------------------------------------------------
// Adresses de retour
// ---------------------------------------------------------------------------

/**
 * Une adresse de retour doit être en HTTPS. On tolère http://localhost et
 * http://127.0.0.1 : les applications de bureau écoutent en local, sans TLS,
 * et cette exception est prévue par la spécification.
 */
export function redirectionAcceptable(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.hash) return false; // une ancre dans l'URL de retour n'a aucun sens ici
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
}

// ---------------------------------------------------------------------------
// PKCE (RFC 7636)
// ---------------------------------------------------------------------------

/**
 * Vérifie que le `code_verifier` présenté correspond au `code_challenge` reçu
 * au départ. C'est ce qui empêche un code d'autorisation intercepté d'être
 * échangé par quelqu'un d'autre : seul l'auteur de la demande connaît le
 * verifier. Nous n'acceptons que S256 — « plain » n'apporte aucune garantie.
 */
export function pkceValide(verifier: string, challenge: string, method: string): boolean {
  if (method !== "S256") return false;
  if (verifier.length < 43 || verifier.length > 128) return false;
  const calcule = createHash("sha256").update(verifier, "utf8").digest("base64url");
  return memeEmpreinte(calcule, challenge);
}

// ---------------------------------------------------------------------------
// Portées
// ---------------------------------------------------------------------------

/**
 * Analyse le paramètre `scope` (portées séparées par des espaces) et ne garde
 * que celles que nous connaissons. Une portée inconnue est ignorée plutôt que
 * de faire échouer la demande — le consentement affichera ce qui est réellement
 * accordé, et l'utilisateur peut de toute façon décocher.
 */
export function portéesDemandées(scope: string | null): Scope[] {
  if (!scope) return ["articles:read"];
  const demandées = scope
    .split(/\s+/)
    .filter(Boolean)
    .filter((s): s is Scope => (SCOPE_IDS as string[]).includes(s));
  return demandées.length > 0 ? demandées : ["articles:read"];
}

// ---------------------------------------------------------------------------
// Codes d'autorisation
// ---------------------------------------------------------------------------

/** Crée un code d'autorisation et renvoie sa valeur en clair (usage unique). */
export async function creerCode(input: {
  oauthClientId: string;
  userId: string;
  redirectUri: string;
  scopes: Scope[];
  codeChallenge: string;
  method: string;
}): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  await prisma.oAuthCode.create({
    data: {
      codeHash: empreinte(code),
      oauthClientId: input.oauthClientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      scopes: input.scopes,
      codeChallenge: input.codeChallenge,
      method: input.method,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
}

/**
 * Consomme un code : vérifie qu'il existe, n'a pas servi, n'a pas expiré, qu'il
 * est présenté par le bon client depuis la bonne adresse de retour, et que le
 * `code_verifier` correspond.
 *
 * Tout se joue dans une seule transaction, et le code n'est marqué « utilisé »
 * qu'une fois TOUS les contrôles passés, PKCE compris. L'ordre importe : si on
 * brûlait le code avant de vérifier PKCE, quelqu'un qui aurait intercepté le
 * code — sans connaître le verifier, donc sans pouvoir s'en servir — pourrait
 * malgré tout le détruire en le présentant le premier, et faire échouer la
 * connexion légitime. La transaction garantit par ailleurs qu'un même code
 * présenté deux fois en parallèle ne passe qu'une seule fois.
 */
export async function consommerCode(
  code: string,
  clientId: string,
  redirectUri: string,
  verifier: string
): Promise<{ ok: true; userId: string; scopes: Scope[]; oauthClientId: string } | { ok: false; erreur: string }> {
  const hash = empreinte(code);

  return prisma.$transaction(async (tx) => {
    const ligne = await tx.oAuthCode.findUnique({
      where: { codeHash: hash },
      select: {
        id: true,
        userId: true,
        scopes: true,
        codeChallenge: true,
        method: true,
        redirectUri: true,
        expiresAt: true,
        usedAt: true,
        oauthClientId: true,
        client: { select: { clientId: true } },
      },
    });

    if (!ligne) return { ok: false as const, erreur: "Code d'autorisation inconnu." };
    if (ligne.usedAt) return { ok: false as const, erreur: "Ce code a déjà été utilisé." };
    if (ligne.expiresAt.getTime() < Date.now()) return { ok: false as const, erreur: "Code d'autorisation expiré." };
    if (ligne.client.clientId !== clientId) {
      return { ok: false as const, erreur: "Ce code a été délivré à une autre application." };
    }
    if (ligne.redirectUri !== redirectUri) {
      return { ok: false as const, erreur: "L'adresse de retour ne correspond pas à celle de la demande." };
    }
    if (!pkceValide(verifier, ligne.codeChallenge, ligne.method)) {
      return { ok: false as const, erreur: "Le code_verifier ne correspond pas au code_challenge de la demande." };
    }

    await tx.oAuthCode.update({ where: { id: ligne.id }, data: { usedAt: new Date() } });

    return {
      ok: true as const,
      userId: ligne.userId,
      scopes: ligne.scopes.filter((s): s is Scope => (SCOPE_IDS as string[]).includes(s)),
      oauthClientId: ligne.oauthClientId,
    };
  });
}

/**
 * Purge les codes périmés. Appelée à l'occasion, depuis /oauth/token : inutile
 * de faire tourner une tâche planifiée pour quelques lignes.
 */
export async function purgerCodes(): Promise<void> {
  await prisma.oAuthCode
    .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    .catch(() => undefined);
}
