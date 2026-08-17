/**
 * Métadonnées du serveur d'autorisation (RFC 8414), servies sur
 * /.well-known/oauth-authorization-server via une réécriture (next.config.ts).
 *
 * C'est le premier fichier que lit l'application Claude : il lui indique où
 * s'enregistrer, où envoyer le rédacteur pour l'autorisation, et où échanger
 * le code contre un jeton.
 */
import { origine } from "@/lib/oauth";
import { SCOPE_IDS } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const base = origine();

  return Response.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/oauth/register`,
      scopes_supported: SCOPE_IDS,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      // Clients publics (application de bureau) comme confidentiels. PKCE
      // couvre les premiers, le secret les seconds.
      token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
      // S256 uniquement : « plain » ne prouve rien.
      code_challenge_methods_supported: ["S256"],
      service_documentation: `${base}/admin/api`,
    },
    {
      headers: {
        "cache-control": "public, max-age=3600",
        // Le document est public et lu depuis le navigateur du client.
        "access-control-allow-origin": "*",
      },
    }
  );
}
