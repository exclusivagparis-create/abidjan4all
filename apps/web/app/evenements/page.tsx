import Link from "next/link";
import type { Metadata } from "next";
import { formatXOF } from "@a4a/payments";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PlaceholderMedia } from "@/components/placeholder-media";
import { listEventsPublies, EVENT_KIND_LABEL } from "@/lib/events";
import { formatDateFull } from "@/lib/format";

export const metadata: Metadata = {
  title: "Événements Abidjan4All — forums, awards et webinaires",
  description:
    "Forum Diaspora, A4A Awards, webinaires et conférences : les rendez-vous d'Abidjan4All avec la communauté ivoirienne et la diaspora. Inscription en ligne.",
  alternates: { canonical: "/evenements" },
};
export const dynamic = "force-dynamic";

export default async function EvenementsPage({ searchParams }: { searchParams: Promise<{ echec?: string }> }) {
  const [{ echec }, events] = await Promise.all([searchParams, listEventsPublies()]);
  const now = new Date();
  const aVenir = events.filter((e) => e.startAt >= now);
  const passes = events.filter((e) => e.startAt < now).reverse();

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[1000px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <div className="mb-3 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="h-[5px] w-[34px] rounded-[3px] bg-[#8A5A2B]" />
          <h1 className="font-serif text-[27px] font-medium leading-none sm:text-[33px] lg:text-[40px]">Événements</h1>
        </div>
        <p className="mb-8 max-w-[68ch] font-serif text-[16px] leading-[1.55] text-ink-2">
          Les rendez-vous d&apos;Abidjan4All : forums, cérémonies, conférences et webinaires qui réunissent la
          communauté ivoirienne, la diaspora et les décideurs.
        </p>

        {echec ? (
          <p className="mb-6 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
            Paiement non abouti — votre place a été libérée. Vous pouvez réessayer depuis la page de l&apos;événement.
          </p>
        ) : null}

        {aVenir.length === 0 && passes.length === 0 ? (
          <p className="rounded-[14px] border border-line bg-surface-2 px-6 py-10 text-center text-[14px] text-ink-3">
            Aucun événement programmé pour l&apos;instant — revenez bientôt.
          </p>
        ) : null}

        {aVenir.length > 0 ? (
          <>
            <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">À venir</h2>
            <div className="mb-10 grid gap-5">
              {aVenir.map((e) => {
                // Un événement peut mélanger billets gratuits et payants (ex.
                // tarif étudiant offert). Annoncer « gratuit » sur la seule
                // base du prix le plus bas laisserait croire que tout l'est :
                // on ne le dit que si AUCUN billet n'est payant.
                const payants = e.tickets.filter((t) => t.prix > 0);
                const gratuits = e.tickets.length - payants.length;
                const prixMinPayant = payants.length ? Math.min(...payants.map((t) => t.prix)) : null;
                const toutGratuit = e.tickets.length > 0 && payants.length === 0;
                return (
                  <article
                    key={e.id}
                    className="grid gap-5 rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)] sm:grid-cols-[220px_1fr]"
                  >
                    <Link href={`/evenements/${e.slug}`}>
                      <PlaceholderMedia url={e.coverUrl} alt={e.title} className="h-[150px] w-full rounded-[10px]" />
                    </Link>
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2.5">
                        <span className="rounded-[3px] bg-[#8A5A2B] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white">
                          {EVENT_KIND_LABEL[e.kind]}
                        </span>
                        <span className="text-[12px] font-semibold text-ink-2">{formatDateFull(e.startAt)}</span>
                        <span className="text-[12px] text-ink-3">
                          {e.enLigne ? "En ligne" : [e.lieu, e.ville].filter(Boolean).join(" · ") || "Lieu à préciser"}
                        </span>
                      </div>
                      <h3 className="mb-1.5 font-serif text-[21px] font-semibold leading-[1.2]">
                        <Link href={`/evenements/${e.slug}`} className="hover:underline">
                          {e.title}
                        </Link>
                      </h3>
                      <p className="mb-3 max-w-[70ch] font-serif text-[14.5px] leading-[1.5] text-ink-2">{e.pitch}</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/evenements/${e.slug}`}
                          className="rounded-pill bg-[#8A5A2B] px-6 py-2.5 text-[13px] font-bold text-white"
                        >
                          {toutGratuit ? "S'inscrire — gratuit" : "Voir & s'inscrire"}
                        </Link>
                        {prixMinPayant !== null ? (
                          <span className="text-[13px] text-ink-3">
                            {gratuits > 0 ? "gratuit ou " : ""}à partir de {formatXOF(prixMinPayant)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : null}

        {passes.length > 0 ? (
          <>
            <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Éditions passées</h2>
            <div className="grid gap-3">
              {passes.map((e) => (
                <Link
                  key={e.id}
                  href={`/evenements/${e.slug}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-[10px] border border-line bg-surface-2 px-5 py-3 hover:bg-surface"
                >
                  <span className="font-serif text-[15.5px] font-semibold">{e.title}</span>
                  <span className="text-[12px] text-ink-3">{formatDateFull(e.startAt)}</span>
                </Link>
              ))}
            </div>
          </>
        ) : null}

        <section className="mt-10 rounded-[14px] border border-line bg-surface-2 px-6 py-6">
          <h2 className="mb-2 font-serif text-[19px] font-semibold">Associer votre marque à nos événements</h2>
          <p className="mb-4 max-w-[64ch] text-[14px] leading-[1.55] text-ink-2">
            Partenariat, sponsoring d&apos;édition, prise de parole : nos rendez-vous réunissent décideurs, entreprises
            et diaspora. Parlons de la formule adaptée à vos objectifs.
          </p>
          <Link href="/contact" className="inline-block rounded-pill border border-ink px-6 py-2.5 text-[13px] font-bold text-ink">
            Devenir partenaire
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
