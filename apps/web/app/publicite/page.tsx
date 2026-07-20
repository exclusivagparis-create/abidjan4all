import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TARIFS_PUB, COMMUNIQUE_PARTENAIRE } from "@/lib/tarifs";

export const metadata: Metadata = {
  title: "Annoncer sur Abidjan4All — tarifs & formats publicitaires",
  description:
    "Formats, CPM et audience d'Abidjan4All : bandeau, pavé, natif, interstitiel mobile et communiqués partenaires. Ciblage Côte d'Ivoire, France et zone CEDEAO.",
  alternates: { canonical: "/publicite" },
};
export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("fr-FR");

export default async function PublicitePage() {
  // Audience réelle sur 30 jours glissants (mesure interne, sans cookie).
  const depuis = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [pagesVues, visiteurs, mobile] = await Promise.all([
    prisma.pageView.count({ where: { createdAt: { gte: depuis } } }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: depuis } },
      distinct: ["visitorHash"],
      select: { visitorHash: true },
    }),
    prisma.pageView.count({ where: { createdAt: { gte: depuis }, device: "mobile" } }),
  ]);
  const partMobile = pagesVues > 0 ? Math.round((mobile / pagesVues) * 100) : 0;

  const stats: Array<[string, string]> = [
    [nf.format(pagesVues), "Pages vues / 30 j"],
    [nf.format(visiteurs.length), "Visiteurs uniques / 30 j"],
    [`${partMobile} %`, "Audience mobile"],
    ["CI · FR · CEDEAO", "Ciblage géographique"],
  ];

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[980px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        {/* En-tête */}
        <div className="mb-3 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="h-[5px] w-[34px] rounded-[3px] bg-red" />
          <h1 className="font-serif text-[27px] font-medium leading-none sm:text-[33px] lg:text-[40px]">
            Annoncer sur Abidjan4All
          </h1>
        </div>
        <p className="mb-8 max-w-[70ch] font-serif text-[16px] leading-[1.55] text-ink-2">
          Touchez la communauté ivoirienne et sa diaspora sur le média numérique de référence. Régie intégrée,
          ciblage par rubrique et par zone géographique (Côte d&apos;Ivoire, France, CEDEAO), suivi transparent des
          impressions et des clics.
        </p>

        {/* Audience */}
        <div className="mb-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={label} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
              <div className="font-serif text-[24px] font-medium leading-tight">{value}</div>
              <div className="mt-0.5 text-[12px] text-ink-3">{label}</div>
            </div>
          ))}
        </div>

        {/* Formats & CPM */}
        <section className="mb-12">
          <h2 className="mb-1 font-serif text-[26px] font-semibold">Formats & tarifs</h2>
          <p className="mb-5 text-[13px] text-ink-3">
            Tarification au CPM (coût pour 1 000 impressions). Devis sur mesure selon volume et durée.
          </p>
          <div className="overflow-x-auto rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
            <table className="w-full min-w-[640px] text-[14px]">
              <thead>
                <tr className="border-b border-line text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">
                  <th className="px-5 py-3">Format</th>
                  <th className="px-3 py-3">Dimensions</th>
                  <th className="px-3 py-3">Emplacement</th>
                  <th className="px-3 py-3 text-right">CPM</th>
                </tr>
              </thead>
              <tbody>
                {TARIFS_PUB.map((t) => (
                  <tr key={t.format} className="border-b border-line-2 last:border-b-0">
                    <td className="px-5 py-3 font-bold">{t.label}</td>
                    <td className="px-3 py-3 text-ink-2">{t.dimensions}</td>
                    <td className="px-3 py-3 text-[12.5px] text-ink-3">{t.description}</td>
                    <td className="px-3 py-3 text-right font-semibold text-ink">{formatXOF(t.cpm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Communiqué partenaire */}
        <section className="mb-12">
          <h2 className="mb-1 font-serif text-[26px] font-semibold">Communiqué partenaire</h2>
          <p className="mb-5 max-w-[70ch] text-[13px] text-ink-3">
            Article sponsorisé, rédigé à vos côtés et clairement signalé « Communiqué partenaire ».
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {COMMUNIQUE_PARTENAIRE.formules.map((f) => (
              <div key={f.id} className="rounded-[14px] border border-line bg-surface px-6 py-5 shadow-[var(--shadow-sm)]">
                <div className="flex items-baseline justify-between">
                  <div className="font-serif text-[19px] font-semibold">{f.label}</div>
                  <div className="font-serif text-[19px] font-bold text-red">{formatXOF(f.prix)}</div>
                </div>
                <p className="mt-2 text-[13.5px] leading-[1.5] text-ink-2">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact régie */}
        <section className="rounded-[16px] border border-line bg-surface-2 px-7 py-8 text-center">
          <h2 className="font-serif text-[24px] font-semibold">Parlons de votre campagne</h2>
          <p className="mx-auto mt-2 max-w-[54ch] text-[14px] text-ink-2">
            Décrivez votre objectif et votre budget : nous revenons vers vous avec une proposition et un calendrier de
            diffusion.
          </p>
          <Link
            href="/contact?sujet=publicite"
            className="mt-5 inline-block rounded-pill bg-red px-7 py-3 text-[14px] font-bold text-white"
          >
            Contacter la régie
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
