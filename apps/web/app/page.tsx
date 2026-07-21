import Link from "next/link";
import { prisma } from "@a4a/db";
import { RubriqueBadge } from "@a4a/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Ticker } from "@/components/ticker";
import { PlaceholderMedia } from "@/components/placeholder-media";
import { RichTitle, plainTitle } from "@/components/rich-title";
import { ShareButtons } from "@/components/share-buttons";
import { VideoWindow } from "@/components/video-window";
import { NewsletterSignup } from "@/components/newsletter-signup";
import { ServicesBand } from "@/components/services-band";
import { DiasporaStrip } from "@/components/diaspora-strip";
import { RubriqueExplorer } from "@/components/rubrique-explorer";
import { AdSlot } from "@/components/ad-slot";
import { articleListSelect } from "@/lib/api";
import { formatDate } from "@/lib/format";

// SSR à chaque requête : le build (Docker/CI) n'a pas besoin de la base.
// À l'échelle : cache CDN (Cloudflare) devant, cf. README infra.
export const dynamic = "force-dynamic";

const MARCHES = [
  { label: "Cacao Londres", value: "4 015 $", delta: "▲2,4%", tone: "text-green" },
  { label: "Cacao NY", value: "8 720 $", delta: "▲1,1%", tone: "text-green" },
  { label: "BRVM Composite", value: "242,1", delta: "▲1,8%", tone: "text-green" },
  { label: "Pétrole Brent", value: "78,4 $", delta: "▼0,3%", tone: "text-red" },
  { label: "EUR / FCFA", value: "655,96", delta: "=", tone: "text-ink-3" },
];

const PUBLIC_ARTICLE = { status: "published" as const, hidden: false };

type ArticleCarte = Awaited<ReturnType<typeof chargerArticles>>[number];

function chargerArticles() {
  return prisma.article.findMany({
    where: PUBLIC_ARTICLE,
    select: articleListSelect,
    orderBy: { publishedAt: "desc" },
    take: 40,
  });
}

const url = (a: { slug: string; rubrique: { slug: string } }) => `/${a.rubrique.slug}/${a.slug}`;

export default async function HomePage() {
  const [featured, articles, liveUpdates, plusLus, videos, lettre, rubriques] = await Promise.all([
    // « À la Une » piloté depuis le Studio (positions 1 à 5).
    prisma.article.findMany({
      where: { ...PUBLIC_ARTICLE, featuredRank: { not: null } },
      select: articleListSelect,
      orderBy: { featuredRank: "asc" },
      take: 5,
    }),
    chargerArticles(),
    prisma.liveUpdate.findMany({
      where: { liveBlog: { status: "live" } },
      orderBy: { time: "desc" },
      take: 4,
      select: { title: true, body: true, liveBlog: { select: { title: true } } },
    }),
    prisma.article.findMany({
      where: PUBLIC_ARTICLE,
      select: { slug: true, title: true, rubrique: { select: { slug: true } } },
      orderBy: { views: "desc" },
      take: 3,
    }),
    // Fenêtre vidéo du rail : le direct d'abord, puis les plus récentes.
    // On charge tout l'historique (plafond large) ; la liste défile dans le rail.
    prisma.video.findMany({
      where: { published: true },
      select: { id: true, title: true, provider: true, providerRef: true, live: true },
      orderBy: [{ live: "desc" }, { publishedAt: "desc" }],
      take: 60,
    }),
    // Newsletter mise en avant sur l'accueil (CRM DF-03).
    prisma.newsletter
      .findUnique({ where: { slug: "essentiel-du-matin" }, select: { name: true, description: true } })
      .then((n) => n ?? prisma.newsletter.findFirst({ orderBy: { slug: "asc" }, select: { name: true, description: true } })),
    // Rubriques et leur nombre d'articles publiés — pour la bande d'exploration.
    prisma.rubrique.findMany({
      orderBy: { order: "asc" },
      select: {
        slug: true,
        name: true,
        color: true,
        _count: { select: { articles: { where: PUBLIC_ARTICLE } } },
      },
    }),
  ]);

  // À la Une = positions choisies ; à défaut, les plus récents. Le n°1 fait la tête d'affiche.
  const aLaUne = featured.length > 0 ? featured : articles.slice(0, 5);
  const lead = aLaUne[0];
  const rail = aLaUne.slice(1, 3);
  const grilleUne = aLaUne.slice(1, 5);

  // Dédoublonnage : un même article ne paraît qu'une fois sur l'accueil. On
  // consomme le stock section par section, en marquant les articles déjà vus.
  const dejaVu = new Set<string>(aLaUne.slice(0, 5).map((a) => a.id));

  // Sections par rubrique — comme les grands médias. On n'en crée une que si la
  // rubrique a AU MOINS 2 articles encore disponibles : jamais de bloc vide.
  const parRubrique = new Map<string, { name: string; color: string; slug: string; articles: ArticleCarte[] }>();
  for (const a of articles) {
    if (dejaVu.has(a.id)) continue;
    const g = parRubrique.get(a.rubrique.slug) ?? {
      name: a.rubrique.name,
      color: a.rubrique.color,
      slug: a.rubrique.slug,
      articles: [],
    };
    g.articles.push(a);
    parRubrique.set(a.rubrique.slug, g);
  }
  const sectionsRubriques = [...parRubrique.values()]
    .filter((g) => g.articles.length >= 2)
    .sort((a, b) => b.articles.length - a.articles.length)
    .map((g) => ({ ...g, articles: g.articles.slice(0, 4) }));
  sectionsRubriques.forEach((s) => s.articles.forEach((a) => dejaVu.add(a.id)));

  // Derniers articles = tout ce qui n'a pas encore trouvé sa place.
  const derniers = articles.filter((a) => !dejaVu.has(a.id)).slice(0, 6);

  const rubriquesExplorer = rubriques.filter((r) => r._count.articles > 0);
  const tickerItems = liveUpdates.map((u) => u.title ?? u.liveBlog.title);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <Ticker items={tickerItems} />

      {/* RUBAN MARCHÉS (statique — flux de cotation à brancher en DF-05) */}
      <section className="mx-auto max-w-[1200px] px-4 pt-[22px] sm:px-6 lg:px-8">
        <div className="flex overflow-hidden rounded-md border border-line bg-surface shadow-[var(--shadow-sm)]">
          <div className="flex flex-none items-center bg-navy px-3 text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-white sm:px-5 sm:text-[11.5px]">
            Marchés
          </div>
          <div className="flex flex-1 overflow-x-auto [scrollbar-width:none] sm:grid sm:grid-cols-5 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
            {MARCHES.map((m, i) => (
              <div
                key={m.label}
                className={`flex-none px-4 py-2.5 sm:px-5 sm:py-3 ${i < MARCHES.length - 1 ? "border-r border-line-2" : ""}`}
              >
                <div className="whitespace-nowrap text-[10.5px] text-ink-3 sm:text-[11px]">{m.label}</div>
                <div className="whitespace-nowrap text-[13.5px] font-bold sm:text-[15px]">
                  {m.value} <span className={m.tone}>{m.delta}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Emplacement pub — bandeau haut d'accueil + interstitiel mobile. */}
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <AdSlot placementId="home_leaderboard" />
      </div>
      <AdSlot placementId="home_interstitial" />

      {/* HERO */}
      {lead ? (
        <section className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-9 border-b-2 border-ink pb-8 lg:grid-cols-[1.6fr_1fr]">
            <article className="flex flex-col">
              <Link href={url(lead)} className="group flex min-h-0 flex-1 flex-col">
                <div className="relative mb-4 h-[210px] flex-none overflow-hidden rounded-[14px] sm:h-[320px] md:h-[420px] lg:mb-5 lg:h-auto lg:min-h-[420px] lg:flex-1">
                  <PlaceholderMedia url={lead.coverAsset?.url} alt={lead.coverAsset?.alt} className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]" />
                  <span
                    className="absolute left-3 top-3 rounded-[5px] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.09em] text-white sm:left-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-[11.5px]"
                    style={{ background: lead.rubrique.color }}
                  >
                    {lead.rubrique.name}
                  </span>
                </div>
                <h1 className="mb-3 font-serif text-[28px] font-extrabold leading-[1.08] tracking-tight group-hover:underline sm:text-[36px] lg:mb-3.5 lg:text-[46px] lg:leading-[1.04]">
                  <RichTitle text={lead.title} />
                </h1>
              </Link>
              <p className="mb-4 max-w-[60ch] font-serif text-xl leading-[1.5] text-ink-2">{lead.dek}</p>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-3 text-[13px] text-ink-3">
                <span className="font-bold text-ink">{lead.author.name}</span>
                <span>
                  · {formatDate(lead.publishedAt)} · {lead.readingTime} min
                </span>
                {lead.premium ? <PremiumChip /> : null}
                <span className="ml-auto">
                  <ShareButtons path={url(lead)} title={plainTitle(lead.title)} />
                </span>
              </div>
            </article>

            <aside className="flex flex-col">
              {rail.map((a) => (
                <div key={a.slug} className="mb-4 border-b border-line-2 pb-4">
                  <RubriqueBadge slug={a.rubrique.slug} label={a.rubrique.name} color={a.rubrique.color} />
                  <Link href={url(a)}>
                    <h2 className="mb-1.5 mt-[7px] font-serif text-2xl font-semibold leading-[1.14] hover:underline">
                      <RichTitle text={a.title} />
                    </h2>
                  </Link>
                  <div className="text-xs text-ink-3">
                    {a.author.name} · {a.readingTime} min
                  </div>
                </div>
              ))}
              <VideoWindow videos={videos} />

              <div className="mt-auto rounded-md border border-line bg-surface-2 px-5 py-4">
                <div className="mb-1 border-b border-line pb-2.5 text-[11px] font-bold uppercase tracking-[0.1em]">
                  Les plus lus
                </div>
                {plusLus.map((a, i) => (
                  <div
                    key={a.slug}
                    className="flex items-baseline gap-3 border-b border-line-2 py-[9px] last:border-b-0"
                  >
                    <span className="font-serif text-xl font-medium text-orange">{i + 1}</span>
                    <Link href={url(a)}>
                      <h4 className="font-serif text-[15px] font-semibold leading-[1.2] hover:underline">
                        <RichTitle text={a.title} />
                      </h4>
                    </Link>
                  </div>
                ))}
              </div>

              {/* Emplacement pub — pavé 300×250 en colonne. */}
              <AdSlot placementId="home_mpu" />
            </aside>
          </div>
        </section>
      ) : null}

      {/* BANDE SERVICES + FILTRES DIASPORA (identité CI) */}
      <div className="mt-12">
        <ServicesBand />
      </div>
      <DiasporaStrip />

      {/* 4 ARTICLES À LA UNE (positions choisies dans le Studio) */}
      {grilleUne.length > 0 ? (
        <section className="mx-auto max-w-[1200px] px-4 pt-12 sm:px-6 lg:px-8">
          <SectionHeader name="À la une" color="var(--orange)" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {grilleUne.map((a) => (
              <CarteArticle key={a.slug} a={a} />
            ))}
          </div>
        </section>
      ) : null}

      {/* SECTIONS PAR RUBRIQUE — densifient l'accueil avec le contenu existant */}
      {sectionsRubriques.map((s) => (
        <RubriqueSection key={s.slug} section={s} />
      ))}

      {/* Emplacement pub — encart natif in-feed. */}
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <AdSlot placementId="home_native" />
      </div>

      {lettre ? <NewsletterSignup nom={lettre.name} description={lettre.description} /> : null}

      {/* DERNIERS ARTICLES */}
      {derniers.length > 0 ? (
        <section className="mx-auto max-w-[1200px] px-4 pt-12 sm:px-6 lg:px-8">
          <SectionHeader name="Derniers articles" color="var(--ink-3)" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {derniers.map((a) => (
              <CarteArticle key={a.slug} a={a} />
            ))}
          </div>
        </section>
      ) : null}

      {/* EXPLORER LES RUBRIQUES — bande de navigation, remplit le bas de page */}
      {rubriquesExplorer.length > 0 ? (
        <section className="mx-auto max-w-[1200px] px-4 pt-12 sm:px-6 lg:px-8">
          <SectionHeader name="Explorer par rubrique" color="var(--navy)" />
          <RubriqueExplorer rubriques={rubriquesExplorer} />
        </section>
      ) : null}

      <SiteFooter />
    </div>
  );
}

/** Section d'une rubrique : un article en vedette (avec image) + une liste. */
function RubriqueSection({
  section,
}: {
  section: { name: string; color: string; slug: string; articles: ArticleCarte[] };
}) {
  const [tete, ...reste] = section.articles;
  if (!tete) return null;
  return (
    <section className="mx-auto max-w-[1200px] px-4 pt-12 sm:px-6 lg:px-8">
      <SectionHeader name={section.name} color={section.color} href={`/${section.slug}`} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <article className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
          <Link href={url(tete)} className="group block">
            <PlaceholderMedia
              url={tete.coverAsset?.url}
              alt={tete.coverAsset?.alt}
              className="h-[240px] w-full transition-transform duration-500 group-hover:scale-[1.03] sm:h-[300px]"
            />
          </Link>
          <div className="px-[26px] pb-[26px] pt-[22px]">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: section.color }}>
              {tete.kicker ?? section.name}
            </span>
            <Link href={url(tete)}>
              <h3 className="my-2 font-serif text-[27px] font-semibold leading-[1.14] hover:underline">
                <RichTitle text={tete.title} />
              </h3>
            </Link>
            {tete.dek ? (
              <p className="mb-3 max-w-[56ch] font-serif text-base leading-[1.5] text-ink-2">{tete.dek}</p>
            ) : null}
            <div className="text-[12.5px] text-ink-3">
              {tete.author.name} · {tete.readingTime} min {tete.premium ? <PremiumChip /> : null}
            </div>
          </div>
        </article>

        {reste.length > 0 ? (
          <div className="flex flex-col gap-4">
            {reste.map((a) => (
              <div key={a.slug} className="rounded-md border border-line bg-surface px-[18px] py-4 shadow-[var(--shadow-sm)]">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: section.color }}>
                  {a.kicker ?? section.name}
                </span>
                <Link href={url(a)}>
                  <h4 className="my-1.5 font-serif text-[19px] font-semibold leading-[1.18] hover:underline">
                    <RichTitle text={a.title} />
                  </h4>
                </Link>
                <div className="text-[11.5px] text-ink-3">
                  {a.author.name} · {a.readingTime} min
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Carte d'article standard (grilles « À la une » et « Derniers articles »). */
function CarteArticle({ a }: { a: ArticleCarte }) {
  return (
    <article>
      <Link href={url(a)} className="group block overflow-hidden rounded-[10px]">
        <PlaceholderMedia
          url={a.coverAsset?.url}
          alt={a.coverAsset?.alt}
          className="mb-3 h-[170px] w-full rounded-[10px] transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <RubriqueBadge slug={a.rubrique.slug} label={a.rubrique.name} color={a.rubrique.color} />
        <h4 className="mt-[7px] font-serif text-[19px] font-semibold leading-[1.22] group-hover:underline">
          <RichTitle text={a.title} />
        </h4>
      </Link>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-3">
        {a.author.name} · {a.readingTime} min {a.premium ? <PremiumChip /> : null}
      </div>
    </article>
  );
}

function SectionHeader({ name, color, href }: { name: string; color: string; href?: string }) {
  return (
    <div className="mb-[22px] flex items-center gap-3.5">
      <span className="h-[5px] w-[34px] rounded-[3px]" style={{ background: color }} />
      <h2 className="font-serif text-[28px] font-semibold">{name}</h2>
      <span className="h-px flex-1 bg-line" />
      {href ? (
        <Link href={href} className="whitespace-nowrap text-[13px] font-semibold" style={{ color }}>
          Tout voir ›
        </Link>
      ) : null}
    </div>
  );
}

function PremiumChip() {
  return (
    <span className="rounded-pill bg-[linear-gradient(135deg,#F5C24B,#E8641A)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#16181D]">
      A4A+
    </span>
  );
}
