import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { articleListSelect } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { updateInterestsAction } from "@/lib/actions/fil-actions";
import { classer, estPersonnalise } from "@/lib/fil-personnalise";

export const metadata: Metadata = {
  title: "Mon fil",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** Vivier dans lequel on classe : assez large pour que le classement change
 *  quelque chose, assez court pour rester une page d'actualité. */
const VIVIER = 120;
const AFFICHES = 24;

export default async function MonFilPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const [{ ok }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user) redirect("/login?next=/mon-fil");

  const [membre, rubriques] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        interests: true,
        country: true,
        favorites: { select: { id: true, rubriqueId: true } },
      },
    }),
    prisma.rubrique.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, color: true, slug: true } }),
  ]);
  if (!membre) redirect("/login?next=/mon-fil");

  const prefs = {
    interets: membre.interests,
    rubriquesDesFavoris: [...new Set(membre.favorites.map((f) => f.rubriqueId))],
    pays: membre.country,
  };

  const favorisIds = membre.favorites.map((f) => f.id);
  const candidats = await prisma.article.findMany({
    where: { status: "published", hidden: false, id: { notIn: favorisIds } },
    orderBy: { publishedAt: "desc" },
    take: VIVIER,
    select: { ...articleListSelect, rubriqueId: true },
  });

  const classes = classer(candidats, prefs).slice(0, AFFICHES);
  const personnalise = estPersonnalise(prefs);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <nav className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
          <Link href="/espace-membre" className="hover:text-ink">Espace membre</Link>
          <span className="mx-2">›</span>
          <span>Mon fil</span>
        </nav>

        <h1 className="mb-4 border-b-2 border-ink pb-5 font-serif text-[24px] font-medium sm:text-[28px] lg:text-[32px]">
          Mon fil
        </h1>

        {ok ? (
          <p className="mb-6 rounded-[8px] bg-[rgba(46,139,87,0.1)] px-4 py-3 text-[13px] font-semibold text-green">
            Vos rubriques sont enregistrées. Elles servent aussi aux alertes push.
          </p>
        ) : null}

        {/* Réglage avant contenu : un fil personnalisé qu'on ne sait pas régler
            n'est qu'un fil de plus. */}
        <form action={updateInterestsAction} className="mb-8 rounded-[14px] border border-line bg-surface-2 p-5">
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Vos rubriques</div>
          <p className="mb-3 text-[12.5px] text-ink-3">
            Cochez ce qui vous intéresse. Ces choix classent votre fil et filtrent vos alertes — rien d&apos;autre
            n&apos;est observé : nous ne conservons aucun historique de lecture.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {rubriques.map((r) => {
              const suivie = membre.interests.includes(r.id);
              return (
                <label
                  key={r.id}
                  className={`cursor-pointer rounded-pill border px-3.5 py-1.5 text-[12.5px] font-semibold ${
                    suivie ? "text-white" : "border-line bg-surface text-ink-2"
                  }`}
                  style={suivie ? { background: r.color, borderColor: r.color } : undefined}
                >
                  <input type="checkbox" name="rubriques" value={r.id} defaultChecked={suivie} className="sr-only" />
                  {r.name}
                </label>
              );
            })}
          </div>
          <button type="submit" className="rounded-pill bg-navy px-5 py-2 text-xs font-bold text-white">
            Enregistrer mes rubriques
          </button>
        </form>

        {!personnalise ? (
          <p className="mb-6 rounded-[10px] border border-dashed border-line px-4 py-3 text-[13px] text-ink-3">
            Pour l&apos;instant, ce fil est simplement l&apos;actualité la plus récente : choisissez vos rubriques
            ci-dessus pour qu&apos;il vous ressemble.
          </p>
        ) : null}

        <div className="grid gap-3">
          {classes.map(({ article, raison }) => (
            <article key={article.id} className="rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
              <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                <span
                  className="rounded px-2 py-0.5 text-[10.5px] font-bold uppercase text-white"
                  style={{ background: article.rubrique.color }}
                >
                  {article.rubrique.name}
                </span>
                {article.premium ? (
                  <span className="rounded bg-[rgba(245,194,75,0.2)] px-2 py-0.5 text-[10.5px] font-bold uppercase text-[#8A6A12]">A4A+</span>
                ) : null}
                <span className="ml-auto text-[11.5px] text-ink-3">
                  {article.publishedAt ? formatDate(article.publishedAt) : null}
                </span>
              </div>
              <h2 className="mb-1.5 font-serif text-[20px] font-semibold leading-snug">
                <Link href={`/${article.rubrique.slug}/${article.slug}`} className="hover:underline">{article.title}</Link>
              </h2>
              {article.dek ? <p className="font-serif text-[14.5px] leading-relaxed text-ink-2">{article.dek}</p> : null}
              {/* Chaque article dit pourquoi il est là : un classement opaque
                  rend suspect le média qui l'applique. */}
              {raison ? <p className="mt-3 border-t border-line-2 pt-2 text-[12px] text-ink-3">↳ {raison}</p> : null}
            </article>
          ))}
        </div>

        {classes.length === 0 ? (
          <p className="py-12 text-center font-serif text-lg text-ink-3">Aucun article à afficher pour l&apos;instant.</p>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
