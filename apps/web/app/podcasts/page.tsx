import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PlaceholderMedia } from "@/components/placeholder-media";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Podcasts" };
export const dynamic = "force-dynamic";

function fmtDuration(sec: number): string {
  return `${Math.round(sec / 60)} min`;
}

export default async function PodcastsPage() {
  const podcasts = await prisma.podcast.findMany({
    orderBy: { title: "asc" },
    include: { episodes: { orderBy: { number: "desc" }, take: 10 } },
  });

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[1080px] px-4 sm:px-6 lg:px-8 pb-16 pt-10">
        <div className="mb-8 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="h-[5px] w-[34px] rounded-[3px] bg-[var(--rub-videos)]" />
          <h1 className="font-serif text-[27px] sm:text-[33px] lg:text-[40px] font-medium leading-none">Podcasts</h1>
        </div>

        {podcasts.map((pod) => (
          <section key={pod.id} className="mb-10">
            <div className="mb-4 flex items-center gap-4">
              <PlaceholderMedia url={pod.coverUrl} alt={pod.title} className="h-16 w-16 flex-none rounded-[12px]" />
              <div>
                <h2 className="font-serif text-[26px] font-semibold leading-tight">{pod.title}</h2>
                <div className="text-xs uppercase tracking-[0.1em] text-ink-3">
                  {pod.category} · {pod.cadence}
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
              {pod.episodes.map((ep) => (
                <div key={ep.id} className="flex flex-wrap items-center gap-4 border-b border-line-2 px-6 py-4 last:border-b-0">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-pill bg-navy font-serif text-sm font-semibold text-white">
                    {ep.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-[17px] font-semibold leading-snug">{ep.title}</div>
                    <div className="text-xs text-ink-3">
                      {formatDate(ep.publishedAt)} · {fmtDuration(ep.durationSec)} · {ep.description}
                    </div>
                  </div>
                  {ep.audioUrl.startsWith("placeholder://") ? (
                    <span className="rounded-pill border border-line bg-surface-2 px-3.5 py-2 text-[11px] font-semibold text-ink-3">
                      Audio à venir
                    </span>
                  ) : (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <audio controls preload="none" src={ep.audioUrl} className="h-9" />
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
        {podcasts.length === 0 ? (
          <p className="py-16 text-center font-serif text-lg text-ink-3">Les premiers épisodes arrivent bientôt.</p>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
