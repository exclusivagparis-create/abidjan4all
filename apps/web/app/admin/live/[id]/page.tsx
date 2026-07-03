import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { LiveComposer } from "@/components/admin/live-composer";
import { setLiveBlogStatus } from "@/lib/actions/live-actions";

export const metadata: Metadata = { title: "Direct · Studio" };
export const dynamic = "force-dynamic";

export default async function AdminLiveDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const blog = await prisma.liveBlog.findUnique({
    where: { id },
    include: { rubrique: { select: { name: true, color: true } } },
  });
  if (!blog) notFound();

  const updates = await prisma.liveUpdate.findMany({
    where: { liveBlogId: id },
    orderBy: { time: "desc" },
    take: 50,
  });

  const isLive = blog.status === "live";
  const toggleStatus = async () => {
    "use server";
    await setLiveBlogStatus(id, isLive ? "ended" : "live");
  };

  return (
    <div>
      <Link href="/admin/live" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-ink-3 hover:text-ink">
        ‹ Retour aux directs
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-[26px] font-medium leading-tight">{blog.title}</h1>
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-red px-2.5 py-1 text-[10px] font-extrabold uppercase text-white">
            <span className="h-1.5 w-1.5 rounded-pill bg-white [animation:a4a-pulse_1.4s_infinite]" />
            Live
          </span>
        ) : (
          <span className="rounded-pill bg-surface-3 px-2.5 py-1 text-[10px] font-extrabold uppercase text-ink-3">
            Terminé
          </span>
        )}
        <span className="text-xs text-ink-3">{blog.updatesCount} mises à jour</span>
        <span className="flex-1" />
        <Link
          href={`/en-direct/${blog.id}`}
          className="rounded-pill border border-line bg-surface px-4 py-2 text-xs font-semibold"
        >
          Voir côté public ↗
        </Link>
        <form action={toggleStatus}>
          <button
            type="submit"
            className={`rounded-pill px-4 py-2 text-xs font-bold ${
              isLive ? "bg-navy text-white" : "bg-green text-white"
            }`}
          >
            {isLive ? "Clôturer le direct" : "Rouvrir le direct"}
          </button>
        </form>
      </div>

      <LiveComposer liveBlogId={blog.id} disabled={!isLive} />

      <div className="mt-6 rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <div className="mb-3 text-sm font-bold">Fil ({updates.length} dernières)</div>
        {updates.map((u) => (
          <div key={u.id} className="border-b border-line-2 py-3 last:border-b-0">
            <div className="mb-1 flex items-center gap-2 text-[11px] text-ink-3">
              <span className="font-extrabold">
                {u.time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} GMT
              </span>
              <span className="rounded-pill bg-surface-2 px-2 py-0.5 font-bold uppercase">{u.type}</span>
              {u.pinned ? <span>📌</span> : null}
            </div>
            {u.title ? <div className="font-serif text-[15px] font-semibold">{u.title}</div> : null}
            <div className="font-serif text-[14px] text-ink-2">{u.body}</div>
          </div>
        ))}
        {updates.length === 0 ? <p className="py-3 text-[13px] text-ink-3">Aucune mise à jour.</p> : null}
      </div>
    </div>
  );
}
