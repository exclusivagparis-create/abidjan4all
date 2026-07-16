import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PlaceholderMedia } from "@/components/placeholder-media";
import { formatDate } from "@/lib/format";
import { answerFromSources } from "@a4a/ai";
import {
  PERIOD_LABELS,
  searchArticles,
  type SearchPeriod,
  type SearchSort,
} from "@/lib/search";

export const metadata: Metadata = { title: "Recherche" };
export const dynamic = "force-dynamic";

const SUGGESTIONS = ["prix du cacao", "diaspora Montréal", "BRVM", "CAN 2027"];
const LIMIT = 10;

type Params = {
  q?: string;
  rubrique?: string;
  period?: string;
  sort?: string;
  page?: string;
  ia?: string;
};

/** URL /recherche en conservant les autres filtres. */
function buildUrl(params: Params, overrides: Partial<Params>): string {
  const merged: Record<string, string | undefined> = { ...params, page: undefined, ...overrides };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
  return `/recherche?${sp.toString()}`;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const period = (["24h", "7j", "30j", "annee"] as const).find((p) => p === params.period);
  const sort: SearchSort = params.sort === "recent" ? "recent" : "pertinence";

  const { results, total, facets, tookMs } = await searchArticles({
    q,
    rubrique: params.rubrique,
    period,
    sort,
    page,
    limit: LIMIT,
  });

  // Réponse A4A (contrat GET /ai/search) — générée à la demande (?ia=1)
  const aiAnswer =
    q && params.ia === "1" && results.length > 0
      ? await answerFromSources(
          q,
          results.slice(0, 4).map((r) => ({
            title: r.title,
            url: `/${r.rubriqueSlug}/${r.slug}`,
            snippet: r.snippet.replace(/<\/?mark>/g, ""),
          }))
        ).catch(() => null)
      : null;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8 pb-16 pt-9">
        {/* barre de recherche (Recherche.dc.html) */}
        <form
          action="/recherche"
          className="mb-3.5 flex items-center gap-3 rounded-[14px] border border-line bg-surface py-2 pl-5 pr-2 shadow-[var(--shadow-sm)]"
        >
          <span className="text-lg text-ink-3">⌕</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Rechercher un article, un sujet, une rubrique…"
            className="flex-1 bg-transparent font-serif text-xl text-ink outline-none placeholder:text-ink-3"
          />
          <button
            type="submit"
            className="rounded-[9px] bg-navy px-[22px] py-[11px] text-[13.5px] font-bold text-white"
          >
            Rechercher
          </button>
        </form>
        <div className="mb-6 flex flex-wrap items-center gap-2.5 text-[12.5px] text-ink-3">
          <span>Suggestions :</span>
          {SUGGESTIONS.map((s, i) => (
            <span key={s} className="flex items-center gap-2.5">
              {i > 0 ? <span>·</span> : null}
              <Link href={`/recherche?q=${encodeURIComponent(s)}`} className="text-navy-2 hover:underline">
                {s}
              </Link>
            </span>
          ))}
        </div>

        {q ? (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[220px_1fr]">
            {/* facettes */}
            <aside className="lg:sticky lg:top-[86px]">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Filtrer</div>

              <FacetBox title="Rubrique">
                <FacetLink href={buildUrl(params, { rubrique: undefined })} active={!params.rubrique}>
                  Toutes
                </FacetLink>
                {facets.rubriques.map((f) => (
                  <FacetLink
                    key={f.slug}
                    href={buildUrl(params, { rubrique: f.slug })}
                    active={params.rubrique === f.slug}
                  >
                    {f.name} <Count n={f.count} />
                  </FacetLink>
                ))}
              </FacetBox>

              <FacetBox title="Période">
                <FacetLink href={buildUrl(params, { period: undefined })} active={!period}>
                  Toujours
                </FacetLink>
                {(Object.keys(PERIOD_LABELS) as SearchPeriod[]).map((p) => (
                  <FacetLink key={p} href={buildUrl(params, { period: p })} active={period === p}>
                    {PERIOD_LABELS[p]}
                  </FacetLink>
                ))}
              </FacetBox>

              <FacetBox title="Type">
                <div className="flex flex-wrap gap-[7px]">
                  <span className="rounded-pill bg-navy px-[11px] py-[5px] text-[11.5px] font-semibold text-white">
                    Articles
                  </span>
                  {["Vidéos", "Podcasts"].map((t) => (
                    <span
                      key={t}
                      title="À venir (DF-05)"
                      className="cursor-not-allowed rounded-pill border border-line bg-surface-2 px-[11px] py-[5px] text-[11.5px] font-semibold text-ink-3"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </FacetBox>
            </aside>

            {/* résultats */}
            <div>
              {/* Réponse A4A · synthèse IA (Recherche.dc.html) */}
              {aiAnswer?.answer ? (
                <div className="mb-7 rounded-[16px] border border-[var(--accent)] bg-[linear-gradient(180deg,rgba(232,100,26,0.08),transparent)] px-6 py-[22px]">
                  <div className="mb-3.5 flex items-center gap-[9px]">
                    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] bg-accent text-[13px] text-white">✦</span>
                    <span className="text-[12.5px] font-bold tracking-[0.04em] text-accent">Réponse A4A · synthèse IA</span>
                    <span className="rounded-pill border border-line bg-surface px-[9px] py-0.5 text-[10.5px] font-semibold text-ink-3">
                      {aiAnswer.engine === "claude" ? "Bêta" : "Mode démo"}
                    </span>
                  </div>
                  <p className="mb-3.5 font-serif text-lg leading-[1.65]">{aiAnswer.answer}</p>
                  <div className="flex flex-wrap items-center gap-2 border-t border-line-2 pt-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">Sources</span>
                    {aiAnswer.sources.map((s, i) => (
                      <Link
                        key={s.url}
                        href={s.url}
                        className="rounded-pill border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink-2 hover:text-ink"
                      >
                        {i + 1} · {s.title.slice(0, 40)}
                        {s.title.length > 40 ? "…" : ""}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : q && results.length > 0 ? (
                <div className="mb-6">
                  <Link
                    href={buildUrl(params, { ia: "1" })}
                    className="inline-flex items-center gap-2 rounded-pill border border-[var(--accent)] px-4 py-2 text-[12.5px] font-bold text-accent"
                  >
                    ✦ Générer la synthèse IA de ces résultats
                  </Link>
                </div>
              ) : null}

              <div className="mb-4 flex items-center justify-between text-[12.5px] text-ink-3">
                <span>
                  <b className="text-ink">
                    {total} résultat{total > 1 ? "s" : ""}
                  </b>{" "}
                  · {(tookMs / 1000).toFixed(2)} s
                </span>
                <span>
                  Trier :{" "}
                  <Link
                    href={buildUrl(params, { sort: undefined })}
                    className={sort === "pertinence" ? "font-semibold text-ink" : "hover:underline"}
                  >
                    Pertinence
                  </Link>
                  {" · "}
                  <Link
                    href={buildUrl(params, { sort: "recent" })}
                    className={sort === "recent" ? "font-semibold text-ink" : "hover:underline"}
                  >
                    Plus récents
                  </Link>
                </span>
              </div>

              {results.length === 0 ? (
                <p className="border-t border-line-2 py-14 text-center font-serif text-lg text-ink-3">
                  Aucun résultat pour « {q} » — essayez d&apos;autres mots-clés.
                </p>
              ) : (
                <div className="flex flex-col">
                  {results.map((r) => (
                    <article key={r.id} className="flex gap-[18px] border-t border-line-2 py-[18px] last:border-b last:border-line-2">
                      <Link href={`/${r.rubriqueSlug}/${r.slug}`} className="flex-none">
                        <PlaceholderMedia url={r.coverUrl} alt={r.coverAlt} className="h-[100px] w-[150px] rounded-[10px]" />
                      </Link>
                      <div className="min-w-0">
                        <span
                          className="text-[10.5px] font-bold uppercase tracking-[0.1em]"
                          style={{ color: r.rubriqueColor }}
                        >
                          {r.rubriqueName} · {formatDate(r.publishedAt)}
                        </span>
                        <Link href={`/${r.rubriqueSlug}/${r.slug}`}>
                          <h3 className="my-1.5 font-serif text-[21px] font-semibold leading-[1.2] hover:underline">
                            {r.title}
                          </h3>
                        </Link>
                        <p
                          className="font-serif text-[15px] leading-[1.5] text-ink-2 [&_mark]:rounded-[3px] [&_mark]:bg-[rgba(232,100,26,0.16)] [&_mark]:px-0.5 [&_mark]:text-inherit"
                          dangerouslySetInnerHTML={{ __html: `${r.snippet}…` }}
                        />
                        <div className="mt-1.5 text-xs text-ink-3">
                          {r.authorName} · {r.readingTime} min{" "}
                          {r.premium ? (
                            <span className="ml-1 rounded-pill bg-[linear-gradient(135deg,#F5C24B,#E8641A)] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#16181D]">
                              A4A+
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {total > page * LIMIT ? (
                <div className="pt-[26px] text-center">
                  <Link
                    href={buildUrl(params, { page: String(page + 1) })}
                    className="inline-block rounded-pill border border-line bg-surface px-[26px] py-[11px] text-[13px] font-semibold"
                  >
                    Résultats suivants
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="py-16 text-center font-serif text-lg text-ink-3">
            Recherchez dans les archives d&apos;Abidjan4All — la recherche comprend le français
            (pluriels, accents).
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function FacetBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5 rounded-md border border-line bg-surface px-[18px] py-4 shadow-[var(--shadow-sm)]">
      <div className="mb-2.5 text-[12.5px] font-bold">{title}</div>
      <div className="flex flex-col gap-[7px] text-[13px] text-ink-2">{children}</div>
    </div>
  );
}

function FacetLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`flex items-center gap-2 hover:text-ink ${active ? "font-bold text-ink" : ""}`}>
      <span
        className={`flex h-[15px] w-[15px] items-center justify-center rounded-[4px] text-[10px] ${
          active ? "bg-navy text-white" : "border-[1.5px] border-line"
        }`}
      >
        {active ? "✓" : ""}
      </span>
      {children}
    </Link>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-auto text-[11px] text-ink-3">{n}</span>;
}
