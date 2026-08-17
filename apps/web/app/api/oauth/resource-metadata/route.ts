/**
 * Métadonnées de la ressource protégée (RFC 9728), servies sur
 * /.well-known/oauth-protected-resource via une réécriture (next.config.ts).
 *
 * Le client MCP les lit pour savoir quel serveur d'autorisation interroger
 * avant d'appeler /api/mcp. C'est le pendant du document précédent, côté
 * ressource plutôt que côté autorisation.
 */
import { origine } from "@/lib/oauth";
import { SCOPE_IDS } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const base = origine();

  return Response.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
      scopes_supported: SCOPE_IDS,
      bearer_methods_supported: ["header"],
      resource_documentation: `${base}/admin/api`,
    },
    {
      headers: {
        "cache-control": "public, max-age=3600",
        "access-control-allow-origin": "*",
      },
    }
  );
}
