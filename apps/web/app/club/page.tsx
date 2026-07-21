import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { startWhatsappCheckoutAction } from "@/lib/actions/order-actions";
import { TARIFS_WHATSAPP } from "@/lib/tarifs";
import { formatDateFull } from "@/lib/format";

export const metadata: Metadata = {
  title: "WhatsApp Club — l'actu A4A en direct sur WhatsApp",
  description: "Rejoignez le groupe WhatsApp privé d'Abidjan4All : alertes, coulisses et échanges avec la rédaction. Adhésion par Mobile Money, carte ou PayPal.",
  alternates: { canonical: "/club" },
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

const AVANTAGES = [
  "Alertes info prioritaires avant tout le monde",
  "Coulisses de la rédaction et exclusivités",
  "Échanges directs avec les journalistes A4A",
  "Sondages et rendez-vous communautaires",
];

export default async function ClubPage({ searchParams }: { searchParams: Promise<{ ok?: string; echec?: string; indisponible?: string }> }) {
  const [{ ok, echec, indisponible }, session] = await Promise.all([searchParams, auth()]);

  const membership = session?.user
    ? await prisma.whatsappMembership.findUnique({ where: { userId: session.user.id } })
    : null;
  const actif = membership ? membership.expiresAt > new Date() : false;
  const inviteUrl = process.env.WHATSAPP_CLUB_INVITE_URL ?? "";

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[860px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <div className="mb-3 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="h-[5px] w-[34px] rounded-[3px] bg-[#25D366]" />
          <h1 className="font-serif text-[27px] font-medium leading-none sm:text-[33px] lg:text-[40px]">WhatsApp Club</h1>
        </div>
        <p className="mb-8 max-w-[68ch] font-serif text-[16px] leading-[1.55] text-ink-2">
          L&apos;actualité d&apos;Abidjan4All en direct sur WhatsApp, dans un groupe privé réservé aux membres du Club.
        </p>

        {ok ? (
          <div className="mb-6 rounded-[12px] border border-[#25D366] bg-[rgba(37,211,102,0.08)] px-5 py-4 text-[14px] font-semibold text-ink">
            ✓ Adhésion confirmée — bienvenue au Club !
          </div>
        ) : null}
        {echec ? (
          <div className="mb-6 rounded-[12px] border border-line bg-surface-2 px-5 py-3 text-[13.5px] font-semibold text-ink-2">
            Paiement non abouti. Vous pouvez réessayer ci-dessous.
          </div>
        ) : null}
        {indisponible ? (
          <div className="mb-6 rounded-[12px] border border-line bg-surface-2 px-5 py-3 text-[13.5px] font-semibold text-ink-2">
            Ce moyen de paiement est momentanément indisponible — essayez-en un autre.
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          {/* Avantages */}
          <section>
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Ce que vous obtenez</h2>
            <ul className="flex flex-col gap-2.5">
              {AVANTAGES.map((a) => (
                <li key={a} className="flex items-start gap-2.5 text-[14.5px] text-ink-2">
                  <span className="mt-0.5 text-[#25D366]">✓</span>
                  {a}
                </li>
              ))}
            </ul>
          </section>

          {/* Adhésion ou accès */}
          <section>
            {!session?.user ? (
              <div className="rounded-[14px] border border-line bg-surface p-6 text-center shadow-[var(--shadow-sm)]">
                <p className="mb-3 font-serif text-[15px] text-ink-2">Connectez-vous pour rejoindre le Club.</p>
                <Link href="/login?next=/club" className="inline-block rounded-pill bg-red px-5 py-2.5 text-[13px] font-bold text-white">
                  Se connecter
                </Link>
              </div>
            ) : actif ? (
              <div className="rounded-[14px] border border-[#25D366] bg-surface p-6 shadow-[var(--shadow-sm)]">
                <div className="mb-1 text-[13px] font-bold text-[#1EA952]">✓ Membre actif</div>
                <p className="mb-4 text-[13px] text-ink-3">
                  Accès jusqu&apos;au {formatDateFull(membership!.expiresAt)}.
                </p>
                {inviteUrl ? (
                  <a href={inviteUrl} target="_blank" rel="noreferrer" className="mb-4 block rounded-pill bg-[#25D366] px-5 py-3 text-center text-[14px] font-bold text-white">
                    Rejoindre le groupe WhatsApp →
                  </a>
                ) : (
                  <p className="mb-4 rounded-[8px] bg-surface-2 px-4 py-3 text-[12.5px] text-ink-3">
                    Le lien du groupe vous sera communiqué très prochainement.
                  </p>
                )}
                <details className="text-[13px] text-ink-2">
                  <summary className="cursor-pointer font-semibold">Prolonger mon adhésion</summary>
                  <div className="mt-3">
                    <AdhesionForm />
                  </div>
                </details>
              </div>
            ) : (
              <div className="rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
                <h2 className="mb-4 font-serif text-[18px] font-semibold">Choisissez votre formule</h2>
                <AdhesionForm />
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/** Formulaire d'adhésion : palier + moyen de paiement (rendu serveur, sans JS). */
function AdhesionForm() {
  return (
    <form action={startWhatsappCheckoutAction} className="grid gap-3">
      <fieldset className="grid gap-2">
        {TARIFS_WHATSAPP.map((p, i) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-line px-4 py-2.5 has-[:checked]:border-[#25D366] has-[:checked]:bg-[rgba(37,211,102,0.06)]"
          >
            <input type="radio" name="tier" value={p.id} defaultChecked={i === 0} className="h-4 w-4" />
            <span className="flex-1">
              <span className="text-[14px] font-bold">{p.label}</span>
              <span className="block text-[12px] text-ink-3">{p.description}</span>
            </span>
            <span className="font-serif text-[16px] font-bold text-ink">{formatXOF(p.prix)}</span>
          </label>
        ))}
      </fieldset>
      <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
        Moyen de paiement
        <select name="method" className="w-full rounded-[8px] border border-line bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:border-ink-3">
          {METHODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <button type="submit" className="justify-self-start rounded-pill bg-red px-6 py-2.5 text-[13px] font-bold text-white">
        Adhérer et payer
      </button>
    </form>
  );
}
