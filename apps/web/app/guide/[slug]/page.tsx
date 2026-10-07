import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SITE_URL, jsonLdScript } from "@/lib/seo";
import { identiteDe, sectionsDe } from "@/lib/guide";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function getFiche(slug: string) {
  return prisma.guideFiche.findFirst({ where: { slug, published: true } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const fiche = await getFiche(slug);
  if (!fiche) return {};
  return {
    title: `${fiche.title} — Guide de l'Afrique`,
    description: fiche.summary.slice(0, 300),
    alternates: { canonical: `/guide/${fiche.slug}` },
    openGraph: {
      type: "article",
      title: `${fiche.title} — Guide de l'Afrique`,
      description: fiche.summary.slice(0, 300),
      images: fiche.coverUrl ? [{ url: `${SITE_URL}${fiche.coverUrl}` }] : undefined,
    },
  };
}

export default async function FichePage({ params }: Props) {
  const { slug } = await params;
  const fiche = await getFiche(slug);
  if (!fiche) notFound();

  const identite = identiteDe(fiche);
  const sections = sectionsDe(fiche);

  // Fiches voisines, dans l'ordre du sommaire : une encyclopédie se parcourt
  // de proche en proche, pas seulement par la recherche.
  const voisines = await prisma.guideFiche.findMany({
    where: { published: true, slug: { not: fiche.slug }, ...(fiche.region ? { region: fiche.region } : {}) },
    orderBy: [{ order: "asc" }, { title: "asc" }],
    take: 6,
    select: { slug: true, title: true },
  });

  /**
   * Balisage Schema.org : `Article` conviendrait mal — une fiche n'a pas
   * d'auteur signataire ni de date de parution qui compte. `WebPage` avec sa
   * date de mise à jour décrit ce qu'elle est : une page de référence, revue
   * de temps en temps.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: fiche.title,
    description: fiche.summary,
    url: `${SITE_URL}/guide/${fiche.slug}`,
    dateModified: fiche.updatedAt.toISOString(),
    isPartOf: { "@type": "WebSite", name: "Abidjan4All", url: SITE_URL },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Guide de l'Afrique", item: `${SITE_URL}/guide` },
        { "@type": "ListItem", position: 2, name: fiche.title, item: `${SITE_URL}/guide/${fiche.slug}` },
      ],
    },
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />

      <main className="mx-auto max-w-[820px] px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <nav className="mb-4 text-[12.5px] text-ink-3">
          <Link href="/guide" className="hover:text-ink">Guide de l&apos;Afrique</Link>
          {fiche.region ? <><span className="px-1.5">›</span><span>{fiche.region}</span></> : null}
          <span className="px-1.5">›</span>
          <span className="text-ink-2">{fiche.title}</span>
        </nav>

        <h1 className="mb-4 border-b-2 border-ink pb-5 font-serif text-[clamp(28px,5vw,42px)] font-medium leading-tight">
          {fiche.title}
        </h1>

        <p className="mb-6 font-serif text-[17px] leading-[1.7] text-ink-2">{fiche.summary}</p>

        {fiche.coverUrl ? (
          <img src={fiche.coverUrl} alt="" className="mb-6 w-full rounded-[12px] object-cover" />
        ) : null}

        {/* Encadré d'identité : les mêmes lignes d'une fiche à l'autre, donc
            comparables. Les lignes non renseignées disparaissent. */}
        {identite.length ? (
          <aside className="mb-8 rounded-[14px] border border-line bg-surface-2 p-5">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Repères</h2>
            <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {identite.map((ligne) => (
                <div key={ligne.label} className="flex gap-2 border-b border-line-2 pb-2 last:border-b-0">
                  <dt className="min-w-[96px] flex-none text-[12.5px] font-bold text-ink-3">{ligne.label}</dt>
                  <dd className="text-[13.5px] text-ink">{ligne.valeur}</dd>
                </div>
              ))}
            </dl>
          </aside>
        ) : null}

        {/* Sommaire interne : une fiche se consulte par morceaux. */}
        {sections.length > 1 ? (
          <nav className="mb-8 flex flex-wrap gap-2">
            {sections.map((s) => (
              <a key={s.cle} href={`#${s.cle}`} className="rounded-pill border border-line bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-2 hover:border-ink-3">
                {s.label}
              </a>
            ))}
          </nav>
        ) : null}

        {sections.map((s) => (
          <section key={s.cle} id={s.cle} className="mb-8 scroll-mt-24">
            <h2 className="mb-3 border-b border-line pb-2 font-serif text-[23px] font-bold">{s.label}</h2>
            <div
              className="font-serif text-[16.5px] leading-[1.78] text-ink [&_a]:text-blue [&_a]:underline [&_h3]:mt-6 [&_h3]:font-serif [&_h3]:text-[19px] [&_h3]:font-bold [&_h4]:mt-4 [&_h4]:text-[17px] [&_h4]:font-semibold [&_li]:mb-1.5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:border [&_th]:border-line [&_th]:bg-surface-2 [&_th]:px-2.5 [&_th]:py-1.5 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
              dangerouslySetInnerHTML={{ __html: s.html }}
            />
          </section>
        ))}

        {sections.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-line bg-surface-2 px-5 py-8 text-center font-serif text-ink-3">
            Cette fiche est en cours de rédaction.
          </p>
        ) : null}

        <p className="mb-8 text-[12.5px] text-ink-3">Mise à jour le {formatDate(fiche.updatedAt)}.</p>

        {voisines.length ? (
          <section className="rounded-[14px] border border-line bg-surface-2 p-5">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
              {fiche.region ? `Autres fiches — ${fiche.region}` : "Autres fiches"}
            </h2>
            <div className="flex flex-wrap gap-2">
              {voisines.map((v) => (
                <Link key={v.slug} href={`/guide/${v.slug}`} className="rounded-pill border border-line bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-2 hover:border-ink-3">
                  {v.title}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
