import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";
import { SCOPES } from "@/lib/api-auth";
import { formatDateFull } from "@/lib/format";
import { CreerJeton, LigneJeton } from "@/components/admin/api-tokens";

export const metadata: Metadata = { title: "Accès API · Studio" };
export const dynamic = "force-dynamic";

export default async function AdminApiPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");

  const jetons = await prisma.apiToken.findMany({
    orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
      user: { select: { name: true } },
      oauthClient: { select: { name: true } },
    },
  });

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://abidjan4all.info";

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">Accès API</h1>
      <p className="mb-6 max-w-[80ch] text-[12.5px] leading-[1.6] text-ink-3">
        Un jeton d&apos;accès permet à un outil extérieur — l&apos;application Claude, un script de la
        rédaction — de consulter le site et d&apos;y déposer des brouillons, au nom du compte qui a créé le
        jeton, et sans jamais lui communiquer de mot de passe. Aucun jeton ne publie&nbsp;: la mise en ligne
        reste un geste humain, dans le Studio.
      </p>

      <CreerJeton scopes={SCOPES.map((s) => ({ ...s }))} />

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">
          Jetons délivrés ({jetons.length})
        </h2>
        {jetons.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-line bg-surface-2 p-6 text-center text-[13px] text-ink-3">
            Aucun jeton pour l&apos;instant.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[14px] border border-line bg-surface">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-3">
                  <th className="px-4 py-2.5">Nom</th>
                  <th className="px-4 py-2.5">Début du jeton</th>
                  <th className="px-4 py-2.5">Portées</th>
                  <th className="px-4 py-2.5">Dernier usage</th>
                  <th className="px-4 py-2.5">État</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {jetons.map((j) => (
                  <LigneJeton
                    key={j.id}
                    jeton={{
                      id: j.id,
                      name: j.name,
                      prefix: j.prefix,
                      scopes: j.scopes,
                      proprietaire: j.user.name,
                      viaOauth: j.oauthClient?.name ?? null,
                      dernierUsage: j.lastUsedAt ? formatDateFull(j.lastUsedAt) : null,
                      expire: j.expiresAt ? formatDateFull(j.expiresAt) : null,
                      perime: !!j.expiresAt && j.expiresAt.getTime() < Date.now(),
                      revoque: !!j.revokedAt,
                      cree: formatDateFull(j.createdAt),
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[14px] border border-line bg-surface p-6">
        <h2 className="mb-3 font-serif text-[19px] font-semibold">Brancher l&apos;application Claude</h2>
        <ol className="mb-5 grid list-decimal gap-2 pl-5 text-[13.5px] leading-[1.6] text-ink-2">
          <li>Créez ci-dessus un jeton nommé, par exemple, «&nbsp;Claude Desktop&nbsp;», et copiez-le.</li>
          <li>
            Dans l&apos;application Claude, ouvrez <b>Réglages ▸ Connecteurs ▸ Ajouter un connecteur
            personnalisé</b>.
          </li>
          <li>
            Adresse du connecteur&nbsp;: <code className="rounded bg-surface-2 px-1.5 py-0.5">{base}/api/mcp</code>
          </li>
          <li>
            En-tête d&apos;authentification&nbsp;:{" "}
            <code className="rounded bg-surface-2 px-1.5 py-0.5">Authorization: Bearer &lt;votre jeton&gt;</code>
          </li>
          <li>
            Claude dispose alors des outils&nbsp;: rechercher un article, le lire, lister les rubriques,
            créer et modifier un brouillon, consulter les statistiques.
          </li>
        </ol>

        <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Vérifier en ligne de commande</h3>
        <pre className="overflow-x-auto rounded-[10px] bg-navy p-4 text-[12px] leading-[1.6] text-[#D8DEE9]">
{`curl -s ${base}/api/mcp \\
  -H "Authorization: Bearer <votre jeton>" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
        </pre>

        <p className="mt-4 text-[12.5px] leading-[1.6] text-ink-3">
          Un jeton perdu ne se retrouve pas&nbsp;: révoquez-le et créez-en un autre. Si un jeton n&apos;a plus
          servi depuis longtemps, la colonne «&nbsp;dernier usage&nbsp;» vous le signale — mieux vaut le
          révoquer que le laisser traîner.
        </p>
      </section>
    </div>
  );
}
