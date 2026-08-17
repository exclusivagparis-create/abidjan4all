/**
 * POST /oauth/register — enregistrement dynamique de client (RFC 7591).
 *
 * L'application Claude se présente ici et repart avec un `client_id`. Ouvert à
 * tous, et ce n'est pas un oubli : s'enregistrer ne donne aucun accès. Sans le
 * clic d'un rédacteur sur l'écran d'autorisation, un client enregistré ne peut
 * strictement rien lire ni écrire. C'est une carte de visite, pas une clé.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@a4a/db";
import { empreinte, redirectionAcceptable } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function erreur(code: string, description: string, status = 400) {
  return Response.json(
    { error: code, error_description: description },
    { status, headers: { "cache-control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const corps = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corps) return erreur("invalid_client_metadata", "Corps JSON illisible.");

  const uris = Array.isArray(corps.redirect_uris) ? corps.redirect_uris.map(String) : [];
  if (uris.length === 0) {
    return erreur("invalid_redirect_uri", "Au moins une adresse de retour (redirect_uris) est requise.");
  }
  if (uris.length > 10) {
    return erreur("invalid_redirect_uri", "Dix adresses de retour au maximum.");
  }
  const fautive = uris.find((u) => !redirectionAcceptable(u));
  if (fautive) {
    return erreur(
      "invalid_redirect_uri",
      `Adresse de retour refusée : « ${fautive} ». HTTPS exigé, sauf http://localhost.`
    );
  }

  // « none » = client public s'appuyant sur PKCE (application de bureau).
  const methode = typeof corps.token_endpoint_auth_method === "string" ? corps.token_endpoint_auth_method : "none";
  if (!["none", "client_secret_post", "client_secret_basic"].includes(methode)) {
    return erreur("invalid_client_metadata", `Méthode d'authentification non prise en charge : « ${methode} ».`);
  }

  const nom =
    typeof corps.client_name === "string" && corps.client_name.trim()
      ? corps.client_name.trim().slice(0, 80)
      : "Application sans nom";

  const clientId = `a4a-cli_${randomBytes(16).toString("hex")}`;
  const secret = methode === "none" ? null : randomBytes(32).toString("base64url");

  await prisma.oAuthClient.create({
    data: {
      clientId,
      clientSecretHash: secret ? empreinte(secret) : null,
      name: nom,
      redirectUris: uris,
    },
  });

  return Response.json(
    {
      client_id: clientId,
      ...(secret ? { client_secret: secret } : {}),
      client_name: nom,
      redirect_uris: uris,
      token_endpoint_auth_method: methode,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      // 0 = pas d'expiration, comme le prévoit la RFC.
      client_id_issued_at: Math.floor(Date.now() / 1000),
      ...(secret ? { client_secret_expires_at: 0 } : {}),
    },
    { status: 201, headers: { "cache-control": "no-store" } }
  );
}
