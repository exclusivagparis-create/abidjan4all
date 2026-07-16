import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "En Direct" };
export const dynamic = "force-dynamic";

export default async function EnDirectPage() {
  const liveblogs = await prisma.liveBlog.findMany({
    orderBy: [{ status: "desc" }, { startedAt: "desc" }],
    take: 30,
    include: { rubrique: { select: { name: true, color: true } } },
  });
  const lives = liveblogs.filter((l) => l.status === "live");
  const ended = liveblogs.filter((l) => l.status !== "live");

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[1080px] px-4 sm:px-6 lg:px-8 pb-16 pt-10">
        <div className="mb-8 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-red px-[13px] py-1.5 text-xs font-extrabold uppercase tracking-[0.06em] text-white">
            <span className="h-2 w-2 rounded-pill bg-white [animation:a4a-pulse_1.4s_infinite]" />
            En Direct
          </span>
          <h1 className="font-serif text-[27px] sm:text-[33px] lg:text-[40px] font-medium leading-none">Nos directs</h1>
        </div>

        {lives.length === 0 ? (
          <p className="mb-10 rounded-md border border-line bg-surface-2 px-5 py-4 font-serif text-[15px] text-ink-2">
            Aucun direct en cours — retrouvez ci-dessous les derniers événements couverts.
          </p>
        ) : (
          <div className="mb-10 flex flex-col gap-4">
            {lives.map((l) => (
              <Link
                key={l.id}
                href={`/en-direct/${l.id}`}
                className="group rounded-[14px] border border-line bg-surface px-6 py-5 shadow-[var(--shadow-sm)]"
              >
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-red px-2.5 py-1 text-[10px] font-extrabold uppercase text-white">
                    <span className="h-1.5 w-1.5 rounded-pill bg-white [animation:a4a-pulse_1.4s_infinite]" />
                    Live
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: l.rubrique.color }}>
                    {l.rubrique.name}
                  </span>
                  <span className="text-xs font-bold text-green">{l.updatesCount} mises à jour</span>
                </div>
                <h2 className="font-serif text-[26px] font-medium leading-[1.1] group-hover:underline">{l.title}</h2>
                {l.dek ? <p className="mt-1.5 font-serif text-[15.5px] text-ink-2">{l.dek}</p> : null}
              </Link>
            ))}
          </div>
        )}

        {ended.length > 0 ? (
          <>
            <div className="mb-5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Directs terminés</div>
            <div className="flex flex-col">
              {ended.map((l) => (
                <Link key={l.id} href={`/en-direct/${l.id}`} className="group border-t border-line-2 py-4 last:border-b last:border-line-2">
                  <div className="mb-1 flex items-center gap-2.5 text-xs text-ink-3">
                    <span className="font-bold uppercase tracking-[0.12em]" style={{ color: l.rubrique.color }}>
                      {l.rubrique.name}
                    </span>
                    <span>· {formatDate(l.startedAt)} · {l.updatesCount} mises à jour</span>
                  </div>
                  <h3 className="font-serif text-xl font-semibold leading-[1.2] group-hover:underline">{l.title}</h3>
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
