import Link from "next/link";
import type { Metadata } from "next";
import { formatXOF } from "@a4a/payments";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { listSeriesActives, mesAbonnements, KIND_LABEL } from "@/lib/intelligence";
// formatDateFull et non formatDate : une échéance d'abonnement tombe l'année
// suivante, l'année doit être lisible (formatDate ne montre que jour + mois).
import { formatDateFull } from "@/lib/format";

export const metadata: Metadata = {
  title: "A4A Intelligence — rapports et études économiques Côte d'Ivoire",
  description:
    "Rapports cacao et café, revue des investissements en Afrique de l'Ouest, classement des entreprises ivoiriennes, études sur mesure et revue de presse corporate. L'intelligence économique par la rédaction d'Abidjan4All.",
  alternates: { canonical: "/intelligence" },
};
export const dynamic = "force-dynamic";

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ abonne?: string; echec?: string }>;
}) {
  const [{ abonne, echec }, session, series] = await Promise.all([searchParams, auth(), listSeriesActives()]);
  const abonnements = session?.user ? await mesAbonnements(session.user.id) : [];
  const abonneA = new Set(abonnements.map((a) => a.serieId));

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[1000px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <div className="mb-3 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="h-[5px] w-[34px] rounded-[3px] bg-[#0E5A8A]" />
          <h1 className="font-serif text-[27px] font-medium leading-none sm:text-[33px] lg:text-[40px]">
            A4A Intelligence
          </h1>
        </div>
        <p className="mb-8 max-w-[68ch] font-serif text-[16px] leading-[1.55] text-ink-2">
          L&apos;intelligence économique ivoirienne et ouest-africaine, produite par la rédaction d&apos;Abidjan4All :
          des publications de travail pour ceux qui décident, investissent et négocient.
        </p>

        {abonne ? (
          <p className="mb-6 rounded-md bg-[rgba(14,138,95,0.12)] px-4 py-3 text-[13.5px] font-semibold text-green">
            ✓ Abonnement confirmé — vos éditions sont accessibles ci-dessous et dans votre espace membre.
          </p>
        ) : null}
        {echec ? (
          <p className="mb-6 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
            Paiement non abouti — vous pouvez réessayer depuis la fiche de la publication.
          </p>
        ) : null}

        {abonnements.length > 0 ? (
          <section className="mb-9 rounded-[14px] border border-[#0E5A8A] bg-[rgba(14,90,138,0.05)] px-6 py-5">
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.08em] text-[#0E5A8A]">Mes abonnements</h2>
            <ul className="grid gap-2">
              {abonnements.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 text-[14px]">
                  <Link href={`/intelligence/${a.serie.slug}`} className="font-semibold hover:underline">
                    {a.serie.title}
                  </Link>
                  <span className="text-[12.5px] text-ink-3">jusqu&apos;au {formatDateFull(a.expiresAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid gap-5">
          {series.map((s) => (
            <article
              key={s.id}
              className="rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2.5">
                <span className="rounded-[3px] bg-[#0E5A8A] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white">
                  {KIND_LABEL[s.kind]}
                </span>
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{s.rythme}</span>
                {abonneA.has(s.id) ? (
                  <span className="rounded-pill border border-[#1A6B3C] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#1A6B3C]">
                    Abonné
                  </span>
                ) : null}
              </div>
              <h2 className="mb-1.5 font-serif text-[22px] font-semibold leading-[1.2]">
                <Link href={`/intelligence/${s.slug}`} className="hover:underline">
                  {s.title}
                </Link>
              </h2>
              <p className="mb-3 max-w-[70ch] font-serif text-[15px] leading-[1.5] text-ink-2">{s.pitch}</p>
              <p className="mb-4 text-[12.5px] text-ink-3">
                <b className="text-ink-2">Pour :</b> {s.cible}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-2 pt-4">
                <span className="text-[13px] text-ink-3">
                  <b className="font-serif text-[19px] text-ink">{formatXOF(s.prixAnnuel)}</b> / {s.dureeMois} mois
                </span>
                <Link
                  href={`/intelligence/${s.slug}`}
                  className="rounded-pill bg-[#0E5A8A] px-6 py-2.5 text-[13px] font-bold text-white"
                >
                  {abonneA.has(s.id) ? "Consulter les éditions" : "Découvrir & s'abonner"}
                </Link>
              </div>
            </article>
          ))}
          {series.length === 0 ? (
            <p className="rounded-[14px] border border-line bg-surface-2 px-6 py-8 text-center text-[14px] text-ink-3">
              Les publications A4A Intelligence arrivent prochainement.
            </p>
          ) : null}
        </div>

        <section className="mt-10 rounded-[14px] border border-line bg-surface-2 px-6 py-6">
          <h2 className="mb-2 font-serif text-[19px] font-semibold">Un besoin sur mesure ?</h2>
          <p className="mb-4 max-w-[64ch] text-[14px] leading-[1.55] text-ink-2">
            Étude sectorielle dédiée, veille personnalisée, accompagnement d&apos;une direction stratégie : la rédaction
            construit le périmètre avec vous et vous remet un livrable exploitable.
          </p>
          <Link href="/contact" className="inline-block rounded-pill border border-ink px-6 py-2.5 text-[13px] font-bold text-ink">
            Parler à la rédaction
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
