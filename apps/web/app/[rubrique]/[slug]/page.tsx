import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PlaceholderMedia } from "@/components/placeholder-media";
import { ArticleBody } from "@/components/article-body";
import { RichTitle, plainTitle } from "@/components/rich-title";
import { ShareButtons } from "@/components/share-buttons";
import { CommentsSection } from "@/components/comments-section";
import { formatDateFull, initials } from "@/lib/format";
import { auth } from "@/auth";
import { hasActiveSubscription } from "@/lib/billing";
import { absoluteUrl, breadcrumbJsonLd, newsArticleJsonLd } from "@/lib/seo";

export const revalidate = 60;

type Props = { params: Promise<{ rubrique: string; slug: string }> };

async function getArticle(rubriqueSlug: string, slug: string) {
  return prisma.article.findFirst({
    where: { slug, status: "published", rubrique: { slug: rubriqueSlug } },
    include: {
      rubrique: { select: { slug: true, name: true, color: true } },
      author: { select: { id: true, name: true, bio: true } },
      coverAsset: { select: { url: true, alt: true, credit: true } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { rubrique, slug } = await params;
  const article = await getArticle(rubrique, slug);
  if (!article) return {};
  const seo = (article.seo ?? {}) as { metaTitle?: string; metaDescription?: string };
  const path = `/${article.rubrique.slug}/${article.slug}`;
  const image =
    article.coverAsset && !article.coverAsset.url.startsWith("placeholder://")
      ? [absoluteUrl(article.coverAsset.url)]
      : undefined;

  return {
    title: seo.metaTitle ?? plainTitle(article.title),
    description: seo.metaDescription ?? article.dek ?? undefined,
    alternates: { canonical: path },
    openGraph: {
      title: article.title,
      description: article.dek ?? undefined,
      type: "article",
      url: path,
      images: image,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      authors: [article.author.name],
      section: article.rubrique.name,
      tags: article.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.dek ?? undefined,
      images: image,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { rubrique: rubriqueSlug, slug } = await params;
  const article = await getArticle(rubriqueSlug, slug);
  if (!article) notFound();

  // paywall : débloqué pour les abonnés A4A+ en cours de validité (DF-03)
  const session = await auth();
  // Article masqué : invisible au public, consultable par la rédaction (aperçu).
  if (article.hidden) {
    const viewer = session?.user
      ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
      : null;
    if (!viewer || !["editor", "admin"].includes(viewer.role)) notFound();
  }
  const unlocked = session?.user ? await hasActiveSubscription(session.user.id) : false;
  const blocks = Array.isArray(article.body) ? article.body : [];
  const gated = article.premium && !unlocked;
  const visibleBlocks = gated ? blocks.slice(0, 2) : blocks;

  const related = await prisma.article.findMany({
    where: { status: "published", id: { not: article.id } },
    select: {
      slug: true,
      title: true,
      rubrique: { select: { slug: true, name: true, color: true } },
      coverAsset: { select: { url: true, alt: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 3,
  });

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* Schema.org (DF-06) : NewsArticle avec balisage paywall + fil d'Ariane */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleJsonLd(article)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(article)) }}
      />
      <SiteHeader />

      {/* Africa in English : contenu anglophone signalé aux lecteurs d'écran et moteurs (DF-05) */}
      <main lang={article.rubrique.slug === "africa-in-english" ? "en" : undefined}>
        {/* Bloc-titre (variante « Édition classique » de Page Article.dc.html) */}
        <div className="mx-auto max-w-[760px] px-4 sm:px-6 lg:px-8 pt-11">
          <nav className="mb-5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
            <Link href="/" className="hover:text-ink">
              Accueil
            </Link>
            <span className="mx-2">›</span>
            <Link href={`/${article.rubrique.slug}`} className="hover:underline" style={{ color: article.rubrique.color }}>
              {article.rubrique.name}
            </Link>
          </nav>

          {/* Rangée de pilules (modèle : .tag-row) */}
          <div className="mb-4 flex flex-wrap gap-2">
            <span
              className="rounded-[2px] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white"
              style={{ background: article.rubrique.color }}
            >
              {article.rubrique.name}
            </span>
            {article.kicker ? (
              <span className="rounded-[2px] bg-ink px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-bg">
                {article.kicker}
              </span>
            ) : null}
            {article.premium ? (
              <span className="rounded-[2px] bg-[linear-gradient(135deg,#F5C24B,#E8641A)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#16181D]">
                ★ A4A+
              </span>
            ) : null}
          </div>

          <h1 className="mb-[18px] font-serif text-[clamp(30px,5vw,46px)] font-extrabold leading-[1.12] tracking-tight">
            <RichTitle text={article.title} />
          </h1>
          {article.dek ? (
            <p className="mb-6 border-l-4 border-[#F47920] pl-4 font-serif text-[18px] italic leading-[1.55] text-ink-2">
              {article.dek}
            </p>
          ) : null}

          {/* Byline (modèle : auteur vert, date grise, pilule temps de lecture, badge rubrique) */}
          <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-b-2 border-ink pb-5 text-[12.5px]">
            <span className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-[#006633] text-[13px] font-bold text-white">
                {initials(article.author.name)}
              </span>
              <Link href={`/membre/${article.author.id}`} className="font-bold text-[#0E8A5F] hover:underline">
                {article.author.name}
              </Link>
            </span>
            <span className="text-ink-3">{formatDateFull(article.publishedAt)}</span>
            <span className="rounded-pill border border-line bg-surface-2 px-3 py-1 text-[11.5px] font-semibold text-ink-2">
              ⏱ {article.readingTime} min de lecture
            </span>
            <span
              className="rounded-pill px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-white"
              style={{ background: article.rubrique.color }}
            >
              {article.rubrique.name}
            </span>
            <span className="ml-auto">
              <ShareButtons path={`/${article.rubrique.slug}/${article.slug}`} title={plainTitle(article.title)} />
            </span>
          </div>
        </div>

        {article.coverAsset ? (
          <div className="mx-auto max-w-[980px] px-4 sm:px-6 lg:px-8">
            <PlaceholderMedia url={article.coverAsset.url} alt={article.coverAsset.alt} className="h-[440px] w-full rounded-[3px]" />
            {/* Légende du modèle : « 📷 Illustration : … © crédit » */}
            {article.coverAsset.alt || article.coverAsset.credit ? (
              <div className="mt-2 px-0.5 text-[11.5px] leading-normal text-ink-3">
                {article.coverAsset.alt ? (
                  <>
                    <strong className="text-ink-2">📷 Illustration :</strong> {article.coverAsset.alt}
                  </>
                ) : null}
                {article.coverAsset.credit ? <em> © {article.coverAsset.credit}</em> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Points clés (Article.aiSummary — GET /ai/summary/:id) */}
        {(() => {
          const summary = article.aiSummary as { keyPoints?: string[] } | null;
          if (!summary?.keyPoints?.length) return null;
          return (
            <div className="mx-auto max-w-[760px] px-4 sm:px-6 lg:px-8 pt-8">
              <div className="rounded-md border border-line bg-surface-2 px-5 py-4">
                <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-accent">
                  ✦ Les points clés
                </div>
                <ul className="flex flex-col gap-1.5">
                  {summary.keyPoints.map((point) => (
                    <li key={point} className="flex gap-2 font-serif text-[15px] leading-normal text-ink-2">
                      <span className="font-bold text-accent">·</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })()}

        <article className="paywalled relative mx-auto max-w-[760px] px-4 sm:px-6 lg:px-8 pt-10">
          <ArticleBody blocks={visibleBlocks} />
          {gated ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px] bg-[linear-gradient(to_bottom,transparent,var(--bg))]" />
          ) : null}
        </article>

        {/* Signature (modèle : avatar vert + rôle) puis tags de pied d'article */}
        {!gated ? (
          <div className="mx-auto max-w-[760px] px-4 sm:px-6 lg:px-8">
            <div className="mt-10 flex items-start gap-4 border-t-2 border-ink pt-5">
              <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-pill bg-[#006633] font-serif text-[19px] font-bold text-white">
                {initials(article.author.name)}
              </span>
              <span className="text-[12.5px] leading-snug text-ink-3">
                <Link href={`/membre/${article.author.id}`} className="block text-[14.5px] font-bold text-ink hover:underline">
                  {article.author.name} — Rédaction Abidjan4All
                </Link>
                <span className="font-semibold text-[#0E8A5F]">
                  {article.author.bio?.split("—")[1]?.trim() ?? `Journaliste · ${article.rubrique.name}`}
                </span>
              </span>
            </div>
            {article.tags.length > 0 ? (
              <div className="mt-7 flex flex-wrap gap-2 border-t border-line-2 pt-5">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-[3px] border border-line bg-surface-2 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* PAYWALL A4A+ (Page Article.dc.html §1a) */}
        {gated ? (
          <div className="px-8 pb-2 pt-2">
            <div className="mx-auto max-w-[560px] rounded-lg border border-line bg-surface px-10 py-9 text-center shadow-[var(--shadow-sm)]">
              <span className="mb-[18px] inline-flex items-center gap-1.5 rounded-pill bg-[linear-gradient(135deg,#F5C24B,#E8641A)] px-[13px] py-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#16181D]">
                ★ Réservé aux abonnés A4A+
              </span>
              <h3 className="mb-2.5 font-serif text-[28px] font-medium leading-[1.15]">
                La suite de cet article est réservée aux membres
              </h3>
              <p className="mb-[22px] font-serif text-base leading-[1.5] text-ink-2">
                Accédez à l&apos;intégralité des enquêtes, aux archives et aux rapports Business — sans
                publicité, dès 2 000 FCFA/mois.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/abonnement" className="rounded-pill bg-red px-[26px] py-[13px] text-sm font-bold text-white">
                  S&apos;abonner à A4A+
                </Link>
                <Link
                  href={`/login?next=/${article.rubrique.slug}/${article.slug}`}
                  className="rounded-pill border border-line bg-surface px-6 py-[13px] text-sm font-semibold text-ink"
                >
                  J&apos;ai déjà un compte
                </Link>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-ink-3">
                <span className="mr-0.5">Paiement sécurisé</span>
                <span className="rounded border border-[#E3DFD4] bg-white px-2 py-[3px] text-[10px] font-extrabold text-[#1A1F71]">VISA</span>
                <span className="rounded border border-[#E3DFD4] bg-white px-2 py-[3px] text-[10px] font-extrabold text-[#003087]">PayPal</span>
                <span className="rounded bg-[#FFCC00] px-2 py-[3px] text-[10px] font-extrabold text-[#111]">MTN MoMo</span>
                <span className="rounded bg-[#F16E00] px-2 py-[3px] text-[10px] font-extrabold text-white">Orange Money</span>
              </div>
            </div>
          </div>
        ) : null}

        <CommentsSection articleId={article.id} />

        {/* À LIRE AUSSI */}
        <div className="mx-auto max-w-[840px] px-4 sm:px-6 lg:px-8 pb-6 pt-8">
          <div className="mb-5 border-b-2 border-orange pb-3.5 font-serif text-2xl font-semibold">À lire aussi</div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {related.map((a) => (
              <Link key={a.slug} href={`/${a.rubrique.slug}/${a.slug}`} className="group">
                <PlaceholderMedia url={a.coverAsset?.url} alt={a.coverAsset?.alt} className="mb-3 h-[130px] w-full rounded-[10px]" />
                <span className="text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: a.rubrique.color }}>
                  {a.rubrique.name}
                </span>
                <h4 className="mt-[7px] font-serif text-[17px] font-semibold leading-[1.22] group-hover:underline">
                  {a.title}
                </h4>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
