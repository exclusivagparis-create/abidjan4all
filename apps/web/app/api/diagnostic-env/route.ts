// TEMPORAIRE — diagnostic de lecture des variables d'environnement en
// production. Ne renvoie que des booléens, jamais une valeur. À supprimer.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const nom = "GOOGLE_CLIENT_ID";
  const env = process.env;

  return Response.json({
    statique: Boolean(process.env.GOOGLE_CLIENT_ID),
    crochets_litteral: Boolean(process.env["GOOGLE_CLIENT_ID"]),
    crochets_variable: Boolean((process.env as Record<string, string | undefined>)[nom]),
    via_alias: Boolean(env.GOOGLE_CLIENT_ID),
    via_globalThis: Boolean(
      (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
        .GOOGLE_CLIENT_ID
    ),
    present_dans_les_cles: Object.keys(process.env).includes("GOOGLE_CLIENT_ID"),
    nombre_de_cles: Object.keys(process.env).length,
    // Témoin : cette variable existait déjà au moment du build.
    temoin_smtp_statique: Boolean(process.env.SMTP_HOST),
  });
}
