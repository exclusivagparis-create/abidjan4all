import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { startRecruteurCheckoutAction } from "@/lib/actions/order-actions";
import { accesRecruteurActif } from "@/lib/recruteur";
import { TARIFS_RECRUTEUR, TARIFS_EMPLOI } from "@/lib/tarifs";
import { formatDateFull } from "@/lib/format";

export const metadata: Metadata = {
  title: "Recruter avec Abidjan4All — accès CVthèque et offres d'emploi",
  description:
    "Accédez aux coordonnées des candidats de la CVthèque Abidjan4All (Côte d'Ivoire et diaspora) et diffusez vos offres d'emploi auprès de notre audience.",
  alternates: { canonical: "/recruteur" },
};
export const dynamic = "force-dynamic";

const METHODES: Array<[string, string]> = [
  ["momo", "MTN MoMo"],
  ["orange", "Orange Money"],
  ["wave", "Wave"],
  ["moov", "Moov Money"],
  ["djamo", "Djamo"],
  ["card", "Carte bancaire"],
  ["paypal", "PayPal"],
];

export default async function RecruteurPage({
  searchParams,
}: {
  searchParams: Promise<{ echec?: string; indisponible?: string }>;
}) {
  const [{ echec, indisponible }, session] = await Promise.all([searchParams, auth()]);
  const acces = await accesRecruteurActif(session?.user?.id);
  const nbCv = await prisma.cvProfile.count({ where: { isPublic: true } });

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <div className="mb-3 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="h-[5px] w-[34px] rounded-[3px] bg-[#0E5A8A]" />
          <h1 className="font-serif text-[27px] font-medium leading-none sm:text-[33px] lg:text-[40px]">Recruter</h1>
        </div>
        <p className="mb-8 max-w-[68ch] font-serif text-[16px] leading-[1.55] text-ink-2">
          Abidjan4All réunit des profils qualifiés en Côte d&apos;Ivoire et dans la diaspora — des gens qui suivent
          l&apos;actualité économique du pays et qui veulent y travailler. Deux façons de les atteindre.
        </p>

        {echec ? (
          <p className="mb-6 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
            Paiement non abouti — vous pouvez réessayer ci-dessous.
          </p>
        ) : null}
        {indisponible ? (
          <p className="mb-6 rounded-md bg-[rgba(232,100,26,0.1)] px-4 py-2.5 text-[13px] font-semibold text-orange">
            Ce moyen de paiement est momentanément indisponible — essayez-en un autre.
          </p>
        ) : null}

        {acces ? (
          <div className="mb-9 rounded-[14px] border border-[#1A6B3C] bg-[rgba(26,107,60,0.06)] px-6 py-5">
            <p className="text-[14px] font-semibold text-[#1A6B3C]">
              ✓ Votre accès recruteur est actif jusqu&apos;au {formatDateFull(acces.expiresAt)}.
            </p>
            <p className="mt-1 text-[12.5px] text-ink-2">
              Les coordonnées des candidats vous sont visibles dans toute la CVthèque.
            </p>
            <Link href="/cv" className="mt-3 inline-block rounded-pill bg-[#1A6B3C] px-5 py-2.5 text-[13px] font-bold text-white">
              Parcourir la CVthèque →
            </Link>
          </div>
        ) : null}

        {/* Accès CVthèque */}
        <section className="mb-10">
          <h2 className="mb-2 font-serif text-[24px] font-semibold">Accès à la CVthèque</h2>
          <p className="mb-5 max-w-[64ch] text-[14px] leading-[1.55] text-ink-2">
            Les {nbCv} profils publiés sont consultables librement. L&apos;accès recruteur débloque leurs{" "}
            <b>coordonnées</b> — e-mail et téléphone — pour les contacter directement, sans intermédiaire.
          </p>

          {!acces ? (
            session?.user ? (
              <form action={startRecruteurCheckoutAction} className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  {TARIFS_RECRUTEUR.map((t, i) => (
                    <label
                      key={t.id}
                      className="flex cursor-pointer flex-col rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)] has-[:checked]:border-[#0E5A8A] has-[:checked]:ring-2 has-[:checked]:ring-[#0E5A8A]"
                    >
                      <input type="radio" name="tier" value={t.id} defaultChecked={i === 1} className="sr-only" />
                      <span className="font-serif text-[18px] font-semibold">{t.label}</span>
                      <span className="mt-1 font-serif text-[24px] font-bold text-[#0E5A8A]">{formatXOF(t.prix)}</span>
                      <span className="mt-2 text-[12.5px] leading-snug text-ink-2">{t.description}</span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="grid gap-1.5 text-xs font-semibold text-ink-2 sm:min-w-[220px]">
                    Moyen de paiement
                    <select
                      name="method"
                      className="rounded-[8px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-ink-3"
                    >
                      {METHODES.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="rounded-pill bg-[#0E5A8A] px-7 py-3 text-[14px] font-bold text-white">
                    Activer mon accès
                  </button>
                </div>
              </form>
            ) : (
              <Link
                href="/login?next=/recruteur"
                className="inline-block rounded-pill bg-[#0E5A8A] px-6 py-2.5 text-[13px] font-bold text-white"
              >
                Se connecter pour souscrire
              </Link>
            )
          ) : null}
        </section>

        {/* Diffusion d'offres */}
        <section className="rounded-[16px] border border-line bg-surface-2 px-6 py-6">
          <h2 className="mb-2 font-serif text-[24px] font-semibold">Diffuser une offre d&apos;emploi</h2>
          <p className="mb-5 max-w-[64ch] text-[14px] leading-[1.55] text-ink-2">
            Publiez votre annonce dans notre bourse d&apos;emploi, vue par une audience ivoirienne et diasporique.
          </p>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {TARIFS_EMPLOI.map((t) => (
              <div key={t.id} className="rounded-[12px] border border-line bg-surface px-4 py-4">
                <div className="font-serif text-[16px] font-semibold">{t.label}</div>
                <div className="mt-0.5 font-serif text-[20px] font-bold text-ink">{formatXOF(t.prix)}</div>
                <div className="mt-1.5 text-[12px] leading-snug text-ink-3">{t.description}</div>
              </div>
            ))}
          </div>
          <Link href="/annonces" className="inline-block rounded-pill bg-red px-6 py-2.5 text-[13px] font-bold text-white">
            Déposer une offre
          </Link>
        </section>

        <p className="mt-6 max-w-[68ch] text-[12px] leading-[1.6] text-ink-3">
          Les candidats maîtrisent la visibilité de leur CV et peuvent le retirer à tout moment. L&apos;accès recruteur
          sert à les contacter dans le cadre d&apos;un recrutement — tout autre usage entraîne sa résiliation.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
