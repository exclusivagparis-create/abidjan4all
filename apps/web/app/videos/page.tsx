import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { RubriqueBadge } from "@a4a/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PlaceholderMedia } from "@/components/placeholder-media";
import { VideoPlayer } from "@/components/video-player";
import { thumbnailUrl } from "@/lib/video";
import { articleListSelect } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Vidéos" };
export const dynamic = "force-dynamic";

/**
 * Cette route statique masque `/[rubrique]` pour le slug « videos » : la
 * rubrique Vidéos est désormais alimentée par le module vidéo du Studio.
 * Les articles éventuellement publiés dans cette rubrique restent affichés
 * plus bas — sans quoi ils deviendraient inaccessibles en silence.
 */
export default async function VideosPage() {
  const [videos, rubrique] = await Promise.all([
    prisma.video.findMany({ where: { published: true }, orderBy: [{ live: "desc" }, { publishedAt: "desc" }], take: 30 }),
    prisma.rubrique.findUnique({ where: { slug: "videos" } }),
  ]);
  const articles = rubrique
    ? await prisma.article.findMany({
        where: { status: "published", hidden: false, rubriqueId: rubrique.id },
        select: articleListSelect,
        orderBy: { publishedAt: "desc" },
        take: 12,
      })
    : [];

  const [une, ...autres] = videos;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-8 pt-10">
        <div className="mb-8 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="h-[5px] w-[34px] rounded-[3px]" style={{ background: rubrique?.color ?? "#D6282D" }} />
          <h1 className="font-serif text-[40px] font-medium leading-none">Vidéos</h1>
          {une?.live ? (
            <span className="mt-1 flex items-center gap-1.5 rounded-pill bg-red px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-white">
              <span className="h-1.5 w-1.5 rounded-pill bg-white" />
              En direct
            </span>
          ) : null}
        </div>

        {une ? (
          <section className="mb-10 grid grid-cols-1 gap-7 lg:grid-cols-[1.6fr_1fr]">
            <div>
              <VideoPlayer
                provider={une.provider}
                providerRef={une.providerRef}
                title={une.title}
                className="aspect-video w-full rounded-[14px]"
              />
              <h2 className="mt-4 font-serif text-[28px] font-semibold leading-[1.12]">{une.title}</h2>
              {une.description ? (
                <p className="mt-2 max-w-[65ch] font-serif text-[16px] leading-[1.5] text-ink-2">{une.description}</p>
              ) : null}
              <div className="mt-2 text-[12.5px] text-ink-3">{formatDate(une.publishedAt)}</div>
            </div>

            {autres.length > 0 ? (
              <aside>
                <div className="mb-3 border-b border-line pb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
                  Historique vidéo
                </div>
                <div className="flex flex-col">
                  {autres.slice(0, 4).map((v) => {
                    const vignette = thumbnailUrl(v.provider, v.providerRef);
                    return (
                      <a
                        key={v.id}
                        href={v.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 border-b border-line-2 py-2.5 last:border-b-0 hover:opacity-80"
                      >
                        {vignette ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={vignette} alt="" className="h-[48px] w-[85px] flex-none rounded-[6px] object-cover" />
                        ) : (
                          <span className="flex h-[48px] w-[85px] flex-none items-center justify-center rounded-[6px] bg-surface-2 text-ink-3">
                            ▶
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 font-serif text-[14px] font-semibold leading-[1.22]">{v.title}</span>
                          <span className="mt-0.5 block text-[11px] text-ink-3">{formatDate(v.publishedAt)}</span>
                        </span>
                      </a>
                    );
                  })}
                </div>
              </aside>
            ) : null}
          </section>
        ) : (
          <p className="py-16 text-center font-serif text-lg text-ink-3">
            Aucune vidéo publiée pour l&apos;instant.
          </p>
        )}

        {autres.length > 4 ? (
          <section className="mb-10">
            <div className="mb-[22px] flex items-center gap-3.5">
              <span className="h-[5px] w-[34px] rounded-[3px] bg-[var(--ink-3)]" />
              <h2 className="font-serif text-[28px] font-semibold">Toutes les vidéos</h2>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {autres.slice(4).map((v) => {
                const vignette = thumbnailUrl(v.provider, v.providerRef);
                return (
                  <a key={v.id} href={v.sourceUrl} target="_blank" rel="noreferrer" className="group block">
                    {vignette ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={vignette} alt="" className="mb-3 h-[130px] w-full rounded-[10px] object-cover" />
                    ) : (
                      <span className="mb-3 flex h-[130px] w-full items-center justify-center rounded-[10px] bg-surface-2 text-2xl text-ink-3">
                        ▶
                      </span>
                    )}
                    <h4 className="font-serif text-[17px] font-semibold leading-[1.2] group-hover:underline">{v.title}</h4>
                    <div className="mt-1 text-[11.5px] text-ink-3">{formatDate(v.publishedAt)}</div>
                  </a>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Articles publiés dans la rubrique Vidéos : cette page masque la
            route de rubrique, ils seraient autrement introuvables. */}
        {articles.length > 0 ? (
          <section className="mb-10 border-t border-line pt-8">
            <div className="mb-[22px] flex items-center gap-3.5">
              <span className="h-[5px] w-[34px] rounded-[3px]" style={{ background: rubrique?.color ?? "#D6282D" }} />
              <h2 className="font-serif text-[28px] font-semibold">Articles vidéo</h2>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => (
                <article key={a.slug}>
                  <Link href={`/videos/${a.slug}`} className="group block">
                    <PlaceholderMedia
                      url={a.coverAsset?.url}
                      alt={a.coverAsset?.alt}
                      className="mb-3 h-[170px] w-full rounded-[10px]"
                    />
                    <RubriqueBadge slug={a.rubrique.slug} label={a.rubrique.name} color={a.rubrique.color} />
                    <h4 className="mt-[7px] font-serif text-[19px] font-semibold leading-[1.22] group-hover:underline">
                      {a.title}
                    </h4>
                  </Link>
                  <div className="mt-1.5 text-xs text-ink-3">
                    {a.author.name} · {a.readingTime} min
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
