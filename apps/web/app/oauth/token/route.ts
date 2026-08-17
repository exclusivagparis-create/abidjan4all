/**
 * POST /oauth/token — échange d'un code d'autorisation contre un jeton d'accès.
 *
 * Cet endpoint ne délivre jamais de jeton « sur simple demande ». Pour en
 * obtenir un, il faut présenter :
 *   — un code d'autorisation valide, non expiré, jamais utilisé, né d'un clic
 *     humain sur l'écran de consentement ;
 *   — le `code_verifier` PKCE correspondant, que seul l'auteur de la demande
 *     initiale connaît ;
 *   — le bon `client_id` et la même adresse de retour qu'à l'aller ;
 *   — le secret du client, s'il en a reçu un à l'enregistrement.
 *
 * Le jeton émis est un ApiToken ordinaire : visible et révocable dans
 * Studio ▸ Accès API, expiration à 90 jours.
 */
import { prisma } from "@a4a/db";
import { creerJeton, type Scope } from "@/lib/api-auth";
import { consommerCode, empreinte, memeEmpreinte, purgerCodes, TOKEN_TTL_DAYS } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENTETES = { "cache-control": "no-store", pragma: "no-cache" } as const;

function erreur(code: string, description: string, status = 400) {
  return Response.json({ error: code, error_description: description }, { status, headers: ENTETES });
}

/** Le client peut s'authentifier par le corps de la requête ou en HTTP Basic. */
function identifiantsClient(request: Request, form: URLSearchParams): { id: string; secret: string | null } {
  const basic = request.headers.get("authorization");
  if (basic?.toLowerCase().startsWith("basic ")) {
    const [id, secret] = Buffer.from(basic.slice(6).trim(), "base64").toString("utf8").split(":");
    if (id) return { id: decodeURIComponent(id), secret: secret ? decodeURIComponent(secret) : null };
  }
  return { id: form.get("client_id") ?? "", secret: form.get("client_secret") };
}

export async function POST(request: Request) {
  let form: URLSearchParams;
  const type = request.headers.get("content-type") ?? "";
  try {
    // Le format normal est application/x-www-form-urlencoded ; certains clients
    // envoient du JSON. On accepte les deux plutôt que d'échouer sur la forme.
    if (type.includes("application/json")) {
      const brut = (await request.json()) as Record<string, unknown>;
      form = new URLSearchParams(
        Object.entries(brut).map(([k, v]) => [k, String(v)]) as [string, string][]
      );
    } else {
      form = new URLSearchParams(await request.text());
    }
  } catch {
    return erreur("invalid_request", "Corps de requête illisible.");
  }

  if (form.get("grant_type") !== "authorization_code") {
    return erreur(
      "unsupported_grant_type",
      "Seul « authorization_code » est pris en charge. Passez d'abord par /oauth/authorize."
    );
  }

  const code = form.get("code");
  const redirectUri = form.get("redirect_uri") ?? "";
  const verifier = form.get("code_verifier");
  const { id: clientId, secret } = identifiantsClient(request, form);

  if (!code) return erreur("invalid_request", "Paramètre « code » manquant.");
  if (!clientId) return erreur("invalid_client", "Paramètre « client_id » manquant.", 401);
  if (!verifier) return erreur("invalid_request", "Paramètre « code_verifier » manquant (PKCE obligatoire).");

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: { id: true, name: true, clientSecretHash: true },
  });
  if (!client) return erreur("invalid_client", "Client inconnu.", 401);

  // Client confidentiel : le secret doit correspondre.
  if (client.clientSecretHash) {
    if (!secret || !memeEmpreinte(empreinte(secret), client.clientSecretHash)) {
      return erreur("invalid_client", "Secret client invalide.", 401);
    }
  }

  // Le code n'est brûlé qu'après validation complète, PKCE compris.
  const resultat = await consommerCode(code, clientId, redirectUri, verifier);
  if (!resultat.ok) return erreur("invalid_grant", resultat.erreur);

  const { token } = await creerJeton({
    name: client.name,
    userId: resultat.userId,
    scopes: resultat.scopes as Scope[],
    joursValidite: TOKEN_TTL_DAYS,
    oauthClientId: client.id,
  });

  // Ménage opportuniste : quelques lignes périmées, pas de tâche planifiée.
  void purgerCodes();

  return Response.json(
    {
      access_token: token,
      token_type: "Bearer",
      expires_in: TOKEN_TTL_DAYS * 24 * 60 * 60,
      scope: resultat.scopes.join(" "),
    },
    { headers: ENTETES }
  );
}

/** Un GET ici est presque toujours une erreur de configuration : on le dit. */
export function GET() {
  return erreur(
    "invalid_request",
    "Cet endpoint attend une requête POST portant un code d'autorisation. Il ne délivre pas de jeton sans autorisation préalable.",
    405
  );
}
