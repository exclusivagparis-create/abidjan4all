/**
 * Authentification des appels machine : jetons d'accès pour l'API /api/v1 et le
 * connecteur MCP /api/mcp.
 *
 * Un jeton ressemble à `a4a_7f3c9b21_<48 caractères aléatoires>`. Seule son
 * empreinte SHA-256 est enregistrée ; le secret lui-même n'existe qu'une fois,
 * à l'écran de création. SHA-256 suffit ici — contrairement à un mot de passe,
 * un jeton est 32 octets tirés au sort, donc hors de portée d'une attaque par
 * dictionnaire ; bcrypt ne ferait que ralentir chaque requête API.
 *
 * Le rôle du compte porteur reste le plafond : un jeton ne peut jamais accorder
 * plus que ce que son propriétaire a le droit de faire dans le Studio.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";

/** Portées disponibles, dans l'ordre où elles s'affichent dans le Studio. */
export const SCOPES = [
  { id: "articles:read", label: "Lire les articles", detail: "Rechercher, lire les brouillons et les publications." },
  { id: "articles:write", label: "Rédiger des brouillons", detail: "Créer et modifier des brouillons. Jamais publier." },
  { id: "stats:read", label: "Consulter les statistiques", detail: "Audience, abonnements, chiffres clés du tableau de bord." },
  {
    id: "articles:delete",
    label: "Supprimer des articles",
    // Portée séparée de « articles:write », et non incluse dedans : celle-ci est
    // décrite comme « Créer et modifier des brouillons ». Y glisser la
    // suppression donnerait ce pouvoir, sans le dire, à tous les jetons déjà
    // délivrés sous cette description.
    detail: "Suppression définitive, par lot. Réservée à l'administration et à la rédaction en chef.",
  },
] as const;

export type Scope = (typeof SCOPES)[number]["id"];

export const SCOPE_IDS = SCOPES.map((s) => s.id) as Scope[];

/** Identité résolue d'un appel : par jeton ou par session du navigateur. */
export interface ApiIdentity {
  userId: string;
  name: string;
  role: string;
  scopes: Scope[];
  /** "token" pour un appel machine, "session" pour un appel depuis le Studio. */
  via: "token" | "session";
}

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

const PREFIX_LENGTH = 8;

function hash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Fabrique un jeton et l'enregistre. Renvoie le secret en clair : c'est le seul
 * moment où il est lisible, l'appelant doit l'afficher immédiatement.
 */
export async function creerJeton(input: {
  name: string;
  userId: string;
  scopes: Scope[];
  /** Durée de validité en jours ; absent = pas d'expiration. */
  joursValidite?: number;
  /** Renseigné quand le jeton naît du flux OAuth, pas du formulaire du Studio. */
  oauthClientId?: string;
}): Promise<{ token: string; prefix: string; id: string }> {
  const marqueur = randomBytes(4).toString("hex"); // 8 caractères
  const secret = randomBytes(32).toString("base64url");
  const token = `a4a_${marqueur}_${secret}`;
  const prefix = `a4a_${marqueur}`;

  const row = await prisma.apiToken.create({
    data: {
      name: input.name.slice(0, 80),
      prefix,
      tokenHash: hash(token),
      scopes: input.scopes,
      userId: input.userId,
      oauthClientId: input.oauthClientId ?? null,
      expiresAt: input.joursValidite
        ? new Date(Date.now() + input.joursValidite * 24 * 60 * 60 * 1000)
        : null,
    },
    select: { id: true },
  });

  return { token, prefix, id: row.id };
}

// ---------------------------------------------------------------------------
// Vérification
// ---------------------------------------------------------------------------

/** Extrait le jeton de l'en-tête `Authorization: Bearer …` (ou `X-A4A-Token`). */
function lireEnTete(request: Request): string | null {
  const brut = request.headers.get("authorization");
  if (brut?.toLowerCase().startsWith("bearer ")) return brut.slice(7).trim();
  return request.headers.get("x-a4a-token")?.trim() || null;
}

/**
 * Valide un jeton porteur. Renvoie null si absent, inconnu, révoqué ou expiré.
 * Met à jour `lastUsedAt` sans bloquer la réponse.
 */
export async function verifierJeton(request: Request): Promise<ApiIdentity | null> {
  const token = lireEnTete(request);
  if (!token) return null;

  // Le préfixe n'est qu'un index de recherche ; la décision se prend sur
  // l'empreinte complète, comparée à temps constant.
  const marqueur = token.split("_").slice(0, 2).join("_");
  if (!marqueur.startsWith("a4a_")) return null;

  const row = await prisma.apiToken.findUnique({
    where: { prefix: marqueur },
    select: {
      id: true,
      tokenHash: true,
      scopes: true,
      revokedAt: true,
      expiresAt: true,
      user: { select: { id: true, name: true, role: true } },
    },
  });
  if (!row) return null;

  const attendu = Buffer.from(row.tokenHash, "utf8");
  const fourni = Buffer.from(hash(token), "utf8");
  if (attendu.length !== fourni.length || !timingSafeEqual(attendu, fourni)) return null;

  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  // Trace d'usage : utile pour repérer un jeton oublié. L'échec n'empêche pas
  // la requête d'aboutir.
  void prisma.apiToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return {
    userId: row.user.id,
    name: row.user.name,
    role: row.user.role,
    scopes: row.scopes.filter((s): s is Scope => (SCOPE_IDS as string[]).includes(s)),
    via: "token",
  };
}

/**
 * Résout l'appelant : jeton porteur d'abord, session du navigateur ensuite.
 * Une session du Studio dispose de toutes les portées — les mêmes contrôles de
 * rôle s'appliquent ensuite dans les deux cas.
 */
export async function identifier(request: Request): Promise<ApiIdentity | null> {
  const parJeton = await verifierJeton(request);
  if (parJeton) return parJeton;

  const session = await auth();
  if (!session?.user) return null;
  return {
    userId: session.user.id,
    name: session.user.name ?? "",
    role: session.user.role as string,
    scopes: [...SCOPE_IDS],
    via: "session",
  };
}

/** Le porteur a-t-il la portée demandée ET le rôle correspondant ? */
export function autorise(identite: ApiIdentity, scope: Scope): boolean {
  if (!identite.scopes.includes(scope)) return false;
  // L'écriture d'articles suppose un rôle rédactionnel. Le simple lecteur qui
  // se fabriquerait un jeton « articles:write » n'obtient rien de plus.
  if (scope === "articles:write") {
    return ["journalist", "editor", "admin"].includes(identite.role);
  }
  if (scope === "stats:read") {
    return PUBLISH_ROLES.includes(identite.role as (typeof PUBLISH_ROLES)[number]);
  }
  // Supprimer est irréversible : rédaction en chef et administration seulement,
  // jamais un journaliste — même muni d'un jeton qui porte la portée.
  if (scope === "articles:delete") {
    return PUBLISH_ROLES.includes(identite.role as (typeof PUBLISH_ROLES)[number]);
  }
  return true;
}
