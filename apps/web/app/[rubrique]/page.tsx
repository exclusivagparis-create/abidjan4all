import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AdSlot } from "@/components/ad-slot";
import { PlaceholderMedia } from "@/components/placeholder-media";
import { articleListSelect } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const revalidate = 60;

type Props = { params: Promise<{ rubrique: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { rubrique: slug } = await params;
  const rubrique = await prisma.rubrique.findUnique({ where: { slug } });
  return rubrique ? { title: rubrique.name } : {};
}

export default async function RubriquePage({ params }: Props) {
  const { rubrique: slug } = await params;
  const rubrique = await prisma.rubrique.findUnique({ where: { slug } });
  if (!rubrique) notFound();

  const articles = await prisma.article.findMany({
    where: { status: "published", hidden: false, rubriqueId: rubrique.id },
    select: articleListSelect,
    orderBy: { publishedAt: "desc" },
    take: 24,
  });

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-8 pt-10">
        <nav className="mb-6 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
          <Link href="/" className="hover:text-ink">
            Accueil
          </Link>
          <span className="mx-2">›</span>
          <span style={{ color: rubrique.color }}>{rubrique.name}</span>
        </nav>

        <div className="mb-8 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="h-[5px] w-[34px] rounded-[3px]" style={{ background: rubrique.color }} />
          <h1 className="font-serif text-[40px] font-medium leading-none">{rubrique.name}</h1>
          <span className="mt-1 text-[13px] text-ink-3">
            {articles.length} article{articles.length > 1 ? "s" : ""}
          </span>
        </div>

        <AdSlot rubrique={rubrique.slug} />

        {articles.length === 0 ? (
          <p className="py-16 text-center font-serif text-lg text-ink-3">
            Aucun article publié dans cette rubrique pour l&apos;instant.
          </p>
        ) : (
          <div className="flex flex-col gap-7">
            {articles.map((a) => (
              <article key={a.slug} className="grid grid-cols-1 gap-6 border-b border-line-2 pb-7 sm:grid-cols-[260px_1fr]">
                <Link href={`/${rubrique.slug}/${a.slug}`}>
                  <PlaceholderMedia url={a.coverAsset?.url} alt={a.coverAsset?.alt} className="h-[150px] w-full rounded-[10px]" />
                </Link>
                <div>
                  {a.kicker ? (
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: rubrique.color }}>
                      {a.kicker}
                    </span>
                  ) : null}
                  <Link href={`/${rubrique.slug}/${a.slug}`}>
                    <h2 className="mb-1.5 mt-1 font-serif text-2xl font-semibold leading-[1.16] hover:underline">
                      {a.title}
                    </h2>
                  </Link>
                  <p className="mb-2.5 max-w-[70ch] font-serif text-[15.5px] leading-normal text-ink-2">{a.dek}</p>
                  <div className="flex items-center gap-2 text-xs text-ink-3">
                    <span className="font-bold text-ink">{a.author.name}</span>
                    <span>
                      · {formatDate(a.publishedAt)} · {a.readingTime} min
                    </span>
                    {a.premium ? (
                      <span className="rounded-pill bg-[linear-gradient(135deg,#F5C24B,#E8641A)] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#16181D]">
                        A4A+
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
