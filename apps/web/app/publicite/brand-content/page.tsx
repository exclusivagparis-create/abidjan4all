import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DevisForm } from "./devis-form";

export const metadata: Metadata = {
  title: "Brand Content — interviews dirigeants et contenus de marque",
  description:
    "A4A Business Interview, A4A Inside, communiqués sponsorisés, sponsoring de newsletter et formats courts : les contenus de marque produits par la rédaction d'Abidjan4All.",
  alternates: { canonical: "/publicite/brand-content" },
};
export const dynamic = "force-dynamic";

export default async function BrandContentPage() {
  const offres = await prisma.brandOffer.findMany({
    where: { actif: true },
    orderBy: [{ ordre: "asc" }, { title: "asc" }],
  });

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[960px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <Link href="/publicite" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-ink-3 hover:text-ink">
          ‹ Annoncer sur Abidjan4All
        </Link>
        <div className="mb-3 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="h-[5px] w-[34px] rounded-[3px] bg-[#D6282D]" />
          <h1 className="font-serif text-[27px] font-medium leading-none sm:text-[33px] lg:text-[40px]">Brand Content</h1>
        </div>
        <p className="mb-9 max-w-[68ch] font-serif text-[16px] leading-[1.55] text-ink-2">
          Faire raconter votre entreprise par une rédaction, ce n&apos;est pas de la publicité : c&apos;est du contenu
          que les gens lisent jusqu&apos;au bout. Nos équipes écrivent, filment et diffusent — vous gardez les fichiers.
        </p>

        <div className="mb-12 grid gap-5">
          {offres.map((o) => {
            const livrables = Array.isArray(o.livrables) ? (o.livrables as string[]) : [];
            return (
              <article
                key={o.id}
                className="grid gap-5 rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)] lg:grid-cols-[1fr_260px]"
              >
                <div>
                  <h2 className="mb-1.5 font-serif text-[22px] font-semibold leading-[1.2]">{o.title}</h2>
                  <p className="mb-3 max-w-[62ch] font-serif text-[15px] leading-[1.5] text-ink-2">{o.pitch}</p>
                  <p className="max-w-[68ch] text-[13.5px] leading-[1.6] text-ink-3">{o.description}</p>
                </div>
                <div className="flex flex-col justify-between gap-4 border-line-2 lg:border-l lg:pl-5">
                  <div>
                    <div className="mb-1 font-serif text-[24px] font-bold text-ink">
                      {o.prix > 0 ? formatXOF(o.prix) : "Sur devis"}
                    </div>
                    {o.prix > 0 ? <div className="mb-3 text-[12px] text-ink-3">{o.unite} · HT</div> : null}
                    {livrables.length > 0 ? (
                      <ul className="flex flex-col gap-1.5 text-[12.5px] leading-snug text-ink-2">
                        {livrables.map((l) => (
                          <li key={l} className="flex gap-1.5">
                            <span className="font-bold text-green">✓</span>
                            {l}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <a href="#devis" className="rounded-pill bg-red px-5 py-2.5 text-center text-[13px] font-bold text-white">
                    Demander une proposition
                  </a>
                </div>
              </article>
            );
          })}
          {offres.length === 0 ? (
            <p className="rounded-[14px] border border-line bg-surface-2 px-6 py-8 text-center text-[14px] text-ink-3">
              Notre catalogue de contenus de marque arrive prochainement.
            </p>
          ) : null}
        </div>

        <section className="rounded-[16px] border border-line bg-surface-2 px-6 py-7">
          <h2 id="devis" className="mb-2 scroll-mt-24 font-serif text-[24px] font-semibold">
            Parlons de votre projet
          </h2>
          <p className="mb-6 max-w-[62ch] text-[14px] leading-[1.55] text-ink-2">
            Décrivez-nous votre objectif : nous revenons vers vous avec une proposition chiffrée et un calendrier de
            production.
          </p>
          <DevisForm offres={offres.map((o) => ({ id: o.id, title: o.title }))} />
        </section>

        {/* Déontologie : la frontière information / publicité doit être dite. */}
        <p className="mt-6 max-w-[68ch] text-[12px] leading-[1.6] text-ink-3">
          Tout contenu de marque publié sur Abidjan4All est <b>signalé comme tel</b> à nos lecteurs. La rédaction
          conserve la maîtrise éditoriale de la forme et se réserve le droit de refuser un sujet contraire à sa charte.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
