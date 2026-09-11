import type { Metadata } from "next";
import { METHODS, formatXOF } from "@a4a/payments";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { subscribeAction } from "@/lib/actions/billing-actions";
import { offresPubliques } from "@/lib/offres";

export const metadata: Metadata = { title: "S'abonner à A4A+" };
export const dynamic = "force-dynamic";

export default async function AbonnementPage({
  searchParams,
}: {
  searchParams: Promise<{ echec?: string; indisponible?: string }>;
}) {
  const [{ echec, indisponible }, session, offres] = await Promise.all([
    searchParams,
    auth(),
    offresPubliques(),
  ]);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[1080px] px-4 sm:px-6 lg:px-8 pb-20 pt-12">
        <div className="mb-10 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-[linear-gradient(135deg,#F5C24B,#E8641A)] px-[13px] py-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#16181D]">
            ★ A4A+
          </span>
          <h1 className="mx-auto mt-4 max-w-[22ch] font-serif text-[28px] sm:text-[36px] lg:text-[44px] font-medium leading-[1.05] tracking-tight">
            Le journalisme ivoirien de référence, sans limite.
          </h1>
          <p className="mx-auto mt-3 max-w-[52ch] font-serif text-lg text-ink-2">
            Enquêtes premium, archives, rapports Business — soutenez une rédaction indépendante.
          </p>
          {echec ? (
            <p className="mx-auto mt-4 max-w-[420px] rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
              Le paiement n&apos;a pas abouti — aucun montant n&apos;a été débité. Vous pouvez réessayer.
            </p>
          ) : null}
          {indisponible ? (
            <p className="mx-auto mt-4 max-w-[440px] rounded-md bg-[rgba(232,100,26,0.1)] px-4 py-2.5 text-[13px] font-semibold text-orange">
              Ce moyen de paiement est momentanément indisponible — aucun montant n&apos;a été débité.
              Choisissez-en un autre ou réessayez plus tard.
            </p>
          ) : null}
        </div>

        {/* Le nombre d'offres n'est plus figé : la rédaction peut en ouvrir une
            cinquième. La grille s'adapte pour qu'aucune carte ne reste seule
            sur sa ligne, ce que faisaient 3 colonnes avec 4 offres. */}
        <div
          className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${
            offres.length % 3 === 0 ? "xl:grid-cols-3" : "xl:grid-cols-4"
          }`}
        >
          {offres.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col rounded-[16px] border bg-surface p-7 ${
                plan.highlight
                  ? "border-transparent shadow-[var(--shadow-lg)] ring-2 ring-[var(--red)]"
                  : "border-line shadow-[var(--shadow-sm)]"
              }`}
            >
              {plan.highlight ? (
                <span className="mb-3 self-start rounded-pill bg-red px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.05em] text-white">
                  Le plus choisi
                </span>
              ) : null}
              <h2 className="font-serif text-[26px] font-semibold">{plan.name}</h2>
              <div className="mt-1 text-[28px] font-extrabold tracking-tight">
                {plan.prix ? (
                  <>
                    {plan.remise ? (
                      <span className="mr-2 align-middle text-[17px] font-semibold text-ink-3 line-through">
                        {formatXOF(plan.prixCatalogue)}
                      </span>
                    ) : null}
                    {formatXOF(plan.prix)}
                    <span className="text-sm font-semibold text-ink-3"> / mois</span>
                  </>
                ) : (
                  <span className="text-[22px]">Sur devis</span>
                )}
              </div>
              {plan.remise ? (
                <p className="mt-1.5 inline-flex self-start rounded-pill bg-[rgba(0,102,51,0.1)] px-2.5 py-1 text-[11.5px] font-bold text-green">
                  {plan.remiseLabel ?? `Économisez ${formatXOF(plan.economie)}`}
                </p>
              ) : null}
              <p className="mt-1 font-serif text-[15px] text-ink-2">{plan.tagline}</p>
              <ul className="mb-6 mt-4 flex flex-col gap-2 text-[13.5px] text-ink-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="font-bold text-green">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {plan.prix ? (
                <form action={subscribeAction} className="mt-auto flex flex-col gap-2.5">
                  <input type="hidden" name="plan" value={plan.id} />
                  <select
                    name="method"
                    defaultValue="momo"
                    className="rounded-[8px] border border-line bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none"
                    aria-label="Moyen de paiement"
                  >
                    {METHODS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className={`rounded-pill py-3 text-sm font-bold ${
                      plan.highlight ? "bg-red text-white" : "bg-brand-fill text-brand-on"
                    }`}
                  >
                    {session?.user ? `S'abonner à ${plan.name}` : "Se connecter et s'abonner"}
                  </button>
                </form>
              ) : (
                <a
                  href="mailto:commercial@exclusivag.net?subject=Offre%20Corporate%20A4A%2B"
                  className="mt-auto rounded-pill border border-line bg-surface-2 py-3 text-center text-sm font-semibold"
                >
                  Contacter la régie
                </a>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-ink-3">
          <span className="mr-0.5">Paiement sécurisé</span>
          <span className="rounded border border-[#E3DFD4] bg-white px-2 py-[3px] text-[10px] font-extrabold text-[#1A1F71]">VISA</span>
          <span className="rounded border border-[#E3DFD4] bg-white px-2 py-[3px] text-[10px] font-extrabold text-[#003087]">PayPal</span>
          <span className="rounded bg-[#FFCC00] px-2 py-[3px] text-[10px] font-extrabold text-[#111]">MTN MoMo</span>
          <span className="rounded bg-[#F16E00] px-2 py-[3px] text-[10px] font-extrabold text-white">Orange Money</span>
          <span className="rounded bg-[#1DC8FF] px-2 py-[3px] text-[10px] font-extrabold text-[#111]">Wave</span>
          <span className="rounded bg-[#0057B8] px-2 py-[3px] text-[10px] font-extrabold text-white">Moov Money</span>
          <span className="rounded bg-[#1B1B3A] px-2 py-[3px] text-[10px] font-extrabold text-white">Djamo</span>
          <span className="ml-2">· Résiliable à tout moment depuis l&apos;espace membre.</span>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
