import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { LiveCreateForm } from "@/components/admin/live-create-form";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Live-blog · Studio" };
export const dynamic = "force-dynamic";

export default async function AdminLive() {
  const [liveblogs, rubriques] = await Promise.all([
    prisma.liveBlog.findMany({
      orderBy: [{ status: "desc" }, { startedAt: "desc" }],
      take: 50,
      include: { rubrique: { select: { name: true, color: true } } },
    }),
    prisma.rubrique.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-lg font-bold">Live-blog</h1>
      <LiveCreateForm rubriques={rubriques} />

      <div className="overflow-x-auto rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        <div className="grid grid-cols-[1fr_140px_110px_130px] min-w-[680px] gap-4 border-b border-line bg-surface-2 px-[22px] py-[13px] text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
          <span>Événement</span>
          <span>Rubrique</span>
          <span>Statut</span>
          <span>Démarré · updates</span>
        </div>
        {liveblogs.map((l) => (
          <Link
            key={l.id}
            href={`/admin/live/${l.id}`}
            className="grid grid-cols-[1fr_140px_110px_130px] min-w-[680px] items-center gap-4 border-b border-line-2 px-[22px] py-[15px] last:border-b-0 hover:bg-surface-2/60"
          >
            <span className="font-serif text-base font-semibold leading-[1.2]">{l.title}</span>
            <span
              className="justify-self-start rounded-pill px-[9px] py-[3px] text-[10.5px] font-bold uppercase"
              style={{ color: l.rubrique.color, background: `color-mix(in srgb, ${l.rubrique.color} 12%, transparent)` }}
            >
              {l.rubrique.name.split(" ")[0]}
            </span>
            {l.status === "live" ? (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-red">
                <span className="h-[7px] w-[7px] rounded-pill bg-red [animation:a4a-pulse_1.4s_infinite]" />
                Live
              </span>
            ) : (
              <span className="text-[11.5px] font-bold text-ink-3">Terminé</span>
            )}
            <span className="text-[12.5px] text-ink-3">
              {formatDate(l.startedAt)} · {l.updatesCount}
            </span>
          </Link>
        ))}
        {liveblogs.length === 0 ? (
          <p className="px-[22px] py-8 text-center text-[13px] text-ink-3">Aucun direct pour l&apos;instant.</p>
        ) : null}
      </div>
    </div>
  );
}
