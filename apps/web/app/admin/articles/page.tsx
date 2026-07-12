import Link from "next/link";
import type { Metadata } from "next";
import { prisma, type ArticleStatus } from "@a4a/db";
import { StatusChip } from "@/components/admin/status-chip";
import { formatDate, initials } from "@/lib/format";

export const metadata: Metadata = { title: "Articles · Studio" };
export const dynamic = "force-dynamic";

const FILTERS: { key: string; label: string; status?: ArticleStatus }[] = [
  { key: "tout", label: "Tout" },
  { key: "published", label: "Publié", status: "published" },
  { key: "scheduled", label: "Programmé", status: "scheduled" },
  { key: "review", label: "Révision", status: "review" },
  { key: "draft", label: "Brouillon", status: "draft" },
];

export default async function AdminArticles({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; q?: string; rubrique?: string }>;
}) {
  const { statut = "tout", q = "", rubrique = "" } = await searchParams;
  const filter = FILTERS.find((f) => f.key === statut) ?? FILTERS[0]!;
  const query = q.trim();

  const where = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(rubrique ? { rubrique: { slug: rubrique } } : {}),
    ...(query ? { title: { contains: query, mode: "insensitive" as const } } : {}),
  };

  const [byStatus, rubriques, articles] = await Promise.all([
    prisma.article.groupBy({ by: ["status"], _count: true }),
    prisma.rubrique.findMany({ orderBy: { order: "asc" }, select: { slug: true, name: true } }),
    prisma.article.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        status: true,
        hidden: true,
        featuredRank: true,
        views: true,
        publishedAt: true,
        scheduledAt: true,
        updatedAt: true,
        rubrique: { select: { name: true, color: true } },
        author: { select: { name: true } },
      },
    }),
  ]);

  const total = byStatus.reduce((sum, b) => sum + b._count, 0);
  const countOf = (s?: ArticleStatus) => (s ? (byStatus.find((b) => b.status === s)?._count ?? 0) : total);

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { statut: filter.key, q: query, rubrique, ...over };
    for (const [k, v] of Object.entries(merged)) if (v && v !== "tout") p.set(k, v);
    const s = p.toString();
    return s ? `/admin/articles?${s}` : "/admin/articles";
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-bold">Articles</h1>
        <Link
          href="/admin/articles/new"
          className="inline-flex items-center gap-[7px] rounded-pill bg-red px-[18px] py-2.5 text-[13px] font-bold text-white"
        >
          <span className="text-[15px] leading-none">＋</span>Nouvel article
        </Link>
      </div>

      {/* recherche + filtre rubrique */}
      <form method="get" className="mb-3 flex flex-wrap items-center gap-2">
        {filter.key !== "tout" ? <input type="hidden" name="statut" value={filter.key} /> : null}
        <input
          name="q"
          defaultValue={query}
          placeholder="Rechercher un titre…"
          className="min-w-[220px] flex-1 rounded-pill border border-line bg-surface px-4 py-2 text-[13px] outline-none"
        />
        <select name="rubrique" defaultValue={rubrique} className="rounded-pill border border-line bg-surface px-3 py-2 text-[13px]">
          <option value="">Toutes rubriques</option>
          {rubriques.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-pill bg-navy px-4 py-2 text-[13px] font-semibold text-white">
          Rechercher
        </button>
        {query || rubrique ? (
          <Link href={qs({ q: "", rubrique: "" })} className="text-[12.5px] font-semibold text-ink-3">
            Réinitialiser
          </Link>
        ) : null}
      </form>

      {/* filtres par statut */}
      <div className="mb-[18px] flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter.key;
          return (
            <Link
              key={f.key}
              href={qs({ statut: f.key })}
              className={`rounded-pill px-[15px] py-2 text-[13px] font-semibold ${
                active ? "bg-navy text-white" : "border border-line bg-surface text-ink-2"
              }`}
            >
              {f.label} <span className={active ? "opacity-60" : "text-ink-3"}>{countOf(f.status)}</span>
            </Link>
          );
        })}
      </div>

      {/* table (Back-office CMS.dc.html) */}
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        <div className="grid grid-cols-[1fr_130px_150px_110px_110px_70px] gap-4 border-b border-line bg-surface-2 px-[22px] py-[13px] text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
          <span>Titre</span>
          <span>Rubrique</span>
          <span>Auteur</span>
          <span>Statut</span>
          <span>Date</span>
          <span className="text-right">Vues</span>
        </div>
        {articles.map((a) => (
          <Link
            key={a.id}
            href={`/admin/articles/${a.id}`}
            className="grid grid-cols-[1fr_130px_150px_110px_110px_70px] items-center gap-4 border-b border-line-2 px-[22px] py-[15px] last:border-b-0 hover:bg-surface-2/60"
          >
            <span className="font-serif text-base font-semibold leading-[1.2]">
              {a.featuredRank ? <span className="mr-1.5 rounded bg-orange px-1.5 py-0.5 align-middle text-[9px] font-bold text-white">UNE {a.featuredRank}</span> : null}
              {a.hidden ? <span className="mr-1.5 rounded bg-ink-3 px-1.5 py-0.5 align-middle text-[9px] font-bold text-white">MASQUÉ</span> : null}
              {a.title}
            </span>
            <span
              className="justify-self-start rounded-pill px-[9px] py-[3px] text-[10.5px] font-bold uppercase"
              style={{ color: a.rubrique.color, background: `color-mix(in srgb, ${a.rubrique.color} 12%, transparent)` }}
            >
              {a.rubrique.name.split(" ")[0]}
            </span>
            <span className="flex items-center gap-2">
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-pill bg-[linear-gradient(135deg,#E8641A,#D6282D)] text-[11px] font-bold text-white">
                {initials(a.author.name)}
              </span>
              <span className="text-[12.5px] text-ink-2">{a.author.name}</span>
            </span>
            <StatusChip status={a.status} />
            <span className="text-[12.5px] text-ink-3">
              {a.status === "scheduled"
                ? formatDate(a.scheduledAt)
                : formatDate(a.publishedAt ?? a.updatedAt)}
            </span>
            <span className="text-right text-[12.5px] font-bold text-ink-2">
              {a.status === "published" ? a.views.toLocaleString("fr-FR") : "—"}
            </span>
          </Link>
        ))}
        {articles.length === 0 ? (
          <p className="px-[22px] py-8 text-center text-[13px] text-ink-3">Aucun article dans ce statut.</p>
        ) : null}
      </div>
    </div>
  );
}
