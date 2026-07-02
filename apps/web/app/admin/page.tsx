import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { StatusChip } from "@/components/admin/status-chip";

export const metadata: Metadata = { title: "Tableau de bord · Studio" };
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [byStatus, abonnes, pendingComments, topArticles, aValider] = await Promise.all([
    prisma.article.groupBy({ by: ["status"], _count: true }),
    prisma.subscription.count({ where: { status: "active", plan: { not: "free" } } }),
    prisma.comment.count({ where: { status: "pending" } }),
    prisma.article.findMany({
      where: { status: "published" },
      orderBy: { views: "desc" },
      take: 5,
      select: { id: true, title: true, views: true, rubrique: { select: { name: true, color: true } } },
    }),
    prisma.article.findMany({
      where: { status: { in: ["review", "draft"] } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, author: { select: { name: true } } },
    }),
  ]);

  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;

  const kpis = [
    { label: "Articles publiés", value: count("published"), note: "au total" },
    { label: "En révision", value: count("review"), note: "à valider" },
    { label: "Abonnés A4A+", value: abonnes, note: "actifs" },
    { label: "Commentaires en attente", value: pendingComments, note: "à modérer" },
  ];

  return (
    <div>
      <h1 className="mb-6 text-lg font-bold">Tableau de bord</h1>

      {/* KPIs */}
      <div className="mb-[22px] grid grid-cols-2 gap-[18px] xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-[14px] border border-line bg-surface px-[22px] py-5 shadow-[var(--shadow-sm)]">
            <div className="mb-2.5 text-xs font-semibold text-ink-3">{k.label}</div>
            <div className="text-[30px] font-extrabold tracking-tight">{k.value}</div>
            <div className="mt-1.5 text-xs font-medium text-ink-3">{k.note}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-[1.7fr_1fr]">
        {/* Articles les plus lus */}
        <div className="rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
          <div className="mb-3.5 text-sm font-bold">Articles les plus lus</div>
          {topArticles.map((a, i) => (
            <div key={a.id} className="flex items-center gap-4 border-b border-line-2 py-2.5 last:border-b-0">
              <span className="w-6 font-serif text-xl font-semibold text-orange">{i + 1}</span>
              <Link href={`/admin/articles/${a.id}`} className="flex-1 font-serif text-base font-semibold hover:underline">
                {a.title}
              </Link>
              <span
                className="rounded-pill px-[9px] py-[3px] text-[10px] font-bold uppercase"
                style={{ color: a.rubrique.color, background: `color-mix(in srgb, ${a.rubrique.color} 12%, transparent)` }}
              >
                {a.rubrique.name}
              </span>
              <span className="w-20 text-right text-[13px] font-bold text-ink-2">
                {a.views.toLocaleString("fr-FR")}
              </span>
            </div>
          ))}
        </div>

        {/* File éditoriale */}
        <div className="rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-bold">File éditoriale</div>
            <span className="rounded-pill bg-orange px-[9px] py-0.5 text-[11px] font-bold text-white">
              {aValider.length}
            </span>
          </div>
          {aValider.length === 0 ? (
            <p className="py-4 text-[13px] text-ink-3">Rien à valider — tout est publié.</p>
          ) : (
            aValider.map((a) => (
              <div key={a.id} className="border-b border-line-2 py-3 last:border-b-0">
                <Link href={`/admin/articles/${a.id}`} className="mb-1 block font-serif text-[15px] font-semibold leading-[1.2] hover:underline">
                  {a.title}
                </Link>
                <div className="flex items-center gap-2 text-[11px] text-ink-3">
                  {a.author.name} <StatusChip status={a.status} />
                </div>
              </div>
            ))
          )}
          <Link
            href="/admin/articles"
            className="mt-3.5 block w-full rounded-pill border border-line bg-surface-2 py-2.5 text-center text-[12.5px] font-semibold"
          >
            Voir la file éditoriale
          </Link>
        </div>
      </div>
    </div>
  );
}
