import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma, Prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { auth } from "@/auth";
import { AudienceMoisBloc } from "@/components/admin/audience-mois";
import { audienceDuMois, moisDisponibles } from "@/lib/stats-audience";

export const metadata: Metadata = { title: "Statistiques · Studio" };
export const dynamic = "force-dynamic";

/** Mois en cours, au format AAAA-MM (UTC, comme les enregistrements). */
function moisCourant(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const nf = new Intl.NumberFormat("fr-FR");

/** Revenus encaissés par mois (paiements succeeded), 12 derniers mois. */
async function revenusParMois(): Promise<Array<{ mois: string; total: number }>> {
  const rows = await prisma.$queryRaw<Array<{ mois: Date; total: bigint }>>(Prisma.sql`
    SELECT date_trunc('month', "createdAt") AS mois, SUM(amount)::bigint AS total
    FROM "Payment"
    WHERE status = 'succeeded'
      AND "createdAt" >= (now() at time zone 'utc') - interval '12 months'
    GROUP BY 1 ORDER BY 1
  `);
  return rows.map((r) => ({
    mois: r.mois.toLocaleDateString("fr-FR", { month: "short", year: "numeric" }),
    total: Number(r.total),
  }));
}

export default async function AdminStats({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const [{ mois: moisDemande }, session] = await Promise.all([searchParams, auth()]);
  // Chiffres d'audience et de revenus : administration uniquement.
  if (session?.user?.role !== "admin") redirect("/admin");

  // Le mois en cours par défaut ; on n'accepte que le format AAAA-MM.
  const mois = /^\d{4}-\d{2}$/.test(moisDemande ?? "") ? moisDemande! : moisCourant();
  const [listeMois, audience] = await Promise.all([moisDisponibles(), audienceDuMois(mois)]);
  // Le mois en cours doit toujours être proposé, même sans aucune visite.
  const moisProposes = listeMois.includes(mois) ? listeMois : [mois, ...listeMois];

  const [vues, publies, commentaires, abonnes, topArticles, parRubrique, revenus] = await Promise.all([
    prisma.article.aggregate({ _sum: { views: true }, where: { status: "published" } }),
    prisma.article.count({ where: { status: "published" } }),
    prisma.comment.count({ where: { status: "approved" } }),
    prisma.subscription.count({ where: { status: "active", plan: { not: "free" } } }),
    prisma.article.findMany({
      where: { status: "published" },
      orderBy: { views: "desc" },
      take: 10,
      select: {
        title: true,
        slug: true,
        views: true,
        premium: true,
        rubrique: { select: { slug: true, name: true, color: true } },
      },
    }),
    prisma.rubrique.findMany({
      orderBy: { order: "asc" },
      select: {
        name: true,
        color: true,
        articles: { where: { status: "published" }, select: { views: true } },
      },
    }),
    revenusParMois(),
  ]);

  const totalVues = vues._sum.views ?? 0;
  const rubriqueVues = parRubrique
    .map((r) => ({ name: r.name, color: r.color, vues: r.articles.reduce((s, a) => s + a.views, 0) }))
    .filter((r) => r.vues > 0)
    .sort((a, b) => b.vues - a.vues);
  const maxRubrique = Math.max(1, ...rubriqueVues.map((r) => r.vues));
  const maxRevenu = Math.max(1, ...revenus.map((r) => r.total));

  const kpis: Array<[string, string]> = [
    [nf.format(totalVues), "Vues d'articles"],
    [nf.format(publies), "Articles publiés"],
    [nf.format(commentaires), "Commentaires approuvés"],
    [nf.format(abonnes), "Abonnés A4A+ actifs"],
  ];

  return (
    <div>
      <h1 className="mb-6 text-lg font-bold">Statistiques</h1>

      {/* Audience du mois — mesure maison, sans cookie ni service tiers. */}
      <AudienceMoisBloc data={audience} mois={moisProposes} choisi={mois} />

      <h2 className="mb-4 text-[15px] font-bold">Depuis le lancement</h2>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(([value, label]) => (
          <div key={label} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
            <div className="font-serif text-[28px] font-medium">{value}</div>
            <div className="mt-0.5 text-[12px] text-ink-3">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top articles */}
        <section className="rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
          <h2 className="mb-3 text-sm font-bold">Articles les plus lus</h2>
          {topArticles.map((a, i) => (
            <div key={a.slug} className="flex items-center gap-3 border-b border-line-2 py-2.5 last:border-b-0">
              <span className="w-5 flex-none text-right font-serif text-[15px] font-semibold text-ink-3">
                {i + 1}
              </span>
              <span className="h-3 w-[3px] flex-none rounded" style={{ background: a.rubrique.color }} />
              <Link
                href={`/${a.rubrique.slug}/${a.slug}`}
                className="min-w-0 flex-1 truncate text-[13px] font-semibold hover:underline"
              >
                {a.title}
              </Link>
              {a.premium ? <span className="text-[10px] font-bold text-orange">A4A+</span> : null}
              <span className="flex-none text-[12.5px] font-bold">{nf.format(a.views)}</span>
            </div>
          ))}
        </section>

        {/* Vues par rubrique */}
        <section className="rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
          <h2 className="mb-3 text-sm font-bold">Vues par rubrique</h2>
          {rubriqueVues.map((r) => (
            <div key={r.name} className="mb-2.5">
              <div className="mb-1 flex justify-between text-[12px]">
                <span className="font-semibold">{r.name}</span>
                <span className="text-ink-3">{nf.format(r.vues)}</span>
              </div>
              <div className="h-[7px] overflow-hidden rounded-pill bg-surface-2">
                <div
                  className="h-full rounded-pill"
                  style={{ width: `${Math.round((r.vues / maxRubrique) * 100)}%`, background: r.color }}
                />
              </div>
            </div>
          ))}
          {rubriqueVues.length === 0 ? <p className="text-[13px] text-ink-3">Pas encore de vues.</p> : null}
        </section>
      </div>

      {/* Revenus */}
      <section className="mt-6 rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-3 text-sm font-bold">Revenus encaissés par mois</h2>
        {revenus.length === 0 ? (
          <p className="text-[13px] text-ink-3">Aucun paiement encaissé pour l&apos;instant.</p>
        ) : (
          <div className="flex items-end gap-4" style={{ height: 140 }}>
            {revenus.map((r) => (
              <div key={r.mois} className="flex flex-1 flex-col items-center justify-end gap-1.5 self-stretch">
                <span className="text-[11px] font-bold">{formatXOF(r.total)}</span>
                <div
                  className="w-full max-w-[54px] rounded-t-[6px] bg-[linear-gradient(180deg,#0E8A5F,#0a6b4a)]"
                  style={{ height: `${Math.max(6, Math.round((r.total / maxRevenu) * 100))}%` }}
                />
                <span className="text-[10.5px] text-ink-3">{r.mois}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="mt-4 text-[11.5px] text-ink-3">
        Sources : compteurs internes (vues serveur, paiements encaissés). L&apos;audience fine (sessions, acquisition)
        viendra de GA4 une fois <code>NEXT_PUBLIC_GA4_ID</code> renseigné.
      </p>
    </div>
  );
}
