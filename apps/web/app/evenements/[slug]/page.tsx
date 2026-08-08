import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PlaceholderMedia } from "@/components/placeholder-media";
import { inscrireEventAction } from "@/lib/actions/event-actions";
import { placesRestantes, placesRestantesTicket, EVENT_KIND_LABEL } from "@/lib/events";
import { formatDateFull } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const METHODES: Array<[string, string]> = [
  ["momo", "MTN MoMo"],
  ["orange", "Orange Money"],
  ["wave", "Wave"],
  ["moov", "Moov Money"],
  ["djamo", "Djamo"],
  ["card", "Carte bancaire"],
  ["paypal", "PayPal"],
];

const ERREURS: Record<string, string> = {
  deja: "Vous êtes déjà inscrit à cet événement.",
  complet: "Toutes les places sont prises.",
  ferme: "Les inscriptions sont fermées.",
  passe: "Cet événement a déjà eu lieu.",
  saisie: "Choisissez un moyen de paiement.",
};

async function getEvent(slug: string) {
  return prisma.event.findUnique({
    where: { slug },
    include: {
      tickets: { orderBy: { ordre: "asc" } },
      sponsors: { orderBy: { ordre: "asc" } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ev = await getEvent(slug);
  if (!ev || ev.status !== "published") return {};
  return {
    title: `${ev.title} — Événement Abidjan4All`,
    description: ev.pitch,
    alternates: { canonical: `/evenements/${ev.slug}` },
    openGraph: { title: ev.title, description: ev.pitch, type: "website" },
  };
}

export default async function EventPage({
  params,
  searchParams,
}: Props & { searchParams: Promise<{ inscrit?: string; echec?: string; indisponible?: string }> }) {
  const [{ slug }, { inscrit, echec, indisponible }, session] = await Promise.all([params, searchParams, auth()]);
  const ev = await getEvent(slug);
  if (!ev) notFound();

  // Un événement non publié reste visible de la rédaction (relecture).
  const enApercu = ev.status !== "published";
  if (enApercu && !["editor", "admin"].includes(session?.user?.role ?? "")) notFound();

  const [restantes, monInscription] = await Promise.all([
    placesRestantes(ev.id, ev.capacite),
    session?.user
      ? prisma.eventRegistration.findUnique({
          where: { eventId_userId: { eventId: ev.id, userId: session.user.id } },
          include: { ticket: true },
        })
      : null,
  ]);

  const inscritActif = monInscription && monInscription.status !== "cancelled";
  const passe = ev.startAt < new Date();
  const billets = await Promise.all(
    ev.tickets
      .filter((t) => t.actif)
      .map(async (t) => ({ ...t, restantes: await placesRestantesTicket(t.id, t.quota) }))
  );

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      {enApercu ? (
        <div className="bg-[#B7791F] px-4 py-2.5 text-center text-[12.5px] font-bold text-white">
          Aperçu — événement non publié. Seule la rédaction voit cette page.
        </div>
      ) : null}

      <main className="mx-auto max-w-[860px] px-4 sm:px-6 lg:px-8 pb-24 pt-11">
        <Link href="/evenements" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-ink-3 hover:text-ink">
          ‹ Tous les événements
        </Link>

        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <span className="rounded-[3px] bg-[#8A5A2B] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white">
            {EVENT_KIND_LABEL[ev.kind]}
          </span>
          {ev.status === "cancelled" ? (
            <span className="rounded-[3px] bg-red px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white">
              Annulé
            </span>
          ) : null}
        </div>

        <h1 className="mb-4 font-serif text-[clamp(27px,4.6vw,40px)] font-extrabold leading-[1.14] tracking-tight">
          {ev.title}
        </h1>
        <p className="mb-6 border-l-4 border-[#8A5A2B] pl-4 font-serif text-[17px] italic leading-[1.55] text-ink-2">
          {ev.pitch}
        </p>

        {ev.coverUrl ? (
          <PlaceholderMedia url={ev.coverUrl} alt={ev.title} className="mb-7 h-[320px] w-full rounded-[10px]" />
        ) : null}

        {/* Informations pratiques */}
        <div className="mb-8 grid gap-3 rounded-[14px] border border-line bg-surface-2 px-5 py-4 sm:grid-cols-3">
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">Date</div>
            <div className="mt-0.5 text-[14px] font-semibold">{formatDateFull(ev.startAt)}</div>
            {ev.endAt ? <div className="text-[12px] text-ink-3">jusqu&apos;au {formatDateFull(ev.endAt)}</div> : null}
          </div>
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">Lieu</div>
            <div className="mt-0.5 text-[14px] font-semibold">
              {ev.enLigne ? "En ligne" : ev.lieu || "À préciser"}
            </div>
            {!ev.enLigne && ev.ville ? <div className="text-[12px] text-ink-3">{ev.ville}</div> : null}
          </div>
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">Places</div>
            <div className="mt-0.5 text-[14px] font-semibold">
              {restantes === null ? "Sans limite" : restantes > 0 ? `${restantes} restantes` : "Complet"}
            </div>
          </div>
        </div>

        {inscrit ? (
          <p className="mb-6 rounded-md bg-[rgba(14,138,95,0.12)] px-4 py-3 text-[13.5px] font-semibold text-green">
            ✓ Inscription confirmée — votre code d&apos;entrée est ci-dessous et dans votre espace membre.
          </p>
        ) : null}
        {echec ? (
          <p className="mb-6 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
            {ERREURS[echec] ?? "Une erreur est survenue."}
          </p>
        ) : null}
        {indisponible ? (
          <p className="mb-6 rounded-md bg-[rgba(232,100,26,0.1)] px-4 py-2.5 text-[13px] font-semibold text-orange">
            Ce moyen de paiement est momentanément indisponible — essayez-en un autre.
          </p>
        ) : null}

        {/* Mon inscription */}
        {inscritActif ? (
          <section className="mb-8 rounded-[14px] border border-[#1A6B3C] bg-[rgba(26,107,60,0.06)] px-6 py-5">
            <h2 className="mb-1 text-[14px] font-bold text-[#1A6B3C]">
              {monInscription!.status === "confirmed" ? "✓ Votre place est confirmée" : "Inscription en attente de paiement"}
            </h2>
            <p className="mb-3 text-[13px] text-ink-2">
              Billet <b>{monInscription!.ticket.label}</b>
              {monInscription!.status === "confirmed" ? (
                <>
                  {" "}
                  · code d&apos;entrée <b className="font-mono tracking-wider">{monInscription!.code}</b>
                </>
              ) : null}
            </p>
            {monInscription!.status === "confirmed" && ev.enLigne && ev.accessUrl ? (
              <a
                href={ev.accessUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded-pill bg-[#1A6B3C] px-5 py-2.5 text-[13px] font-bold text-white"
              >
                Rejoindre l&apos;événement en ligne →
              </a>
            ) : null}
          </section>
        ) : null}

        {/* Billetterie */}
        {!inscritActif && !passe && ev.status === "published" ? (
          <section className="mb-8">
            <h2 className="mb-4 border-b-2 border-orange pb-3 font-serif text-2xl font-semibold">S&apos;inscrire</h2>
            {billets.length === 0 ? (
              <p className="rounded-[14px] border border-line bg-surface-2 px-5 py-6 text-center text-[13.5px] text-ink-3">
                La billetterie ouvre prochainement.
              </p>
            ) : (
              <div className="grid gap-4">
                {billets.map((t) => {
                  const complet = t.restantes === 0 || restantes === 0;
                  return (
                    <div key={t.id} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
                      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-serif text-[18px] font-semibold">{t.label}</span>
                        <span className="font-serif text-[20px] font-bold text-[#8A5A2B]">
                          {t.prix > 0 ? formatXOF(t.prix) : "Gratuit"}
                        </span>
                      </div>
                      {t.description ? <p className="mb-3 text-[13.5px] leading-[1.5] text-ink-2">{t.description}</p> : null}
                      {t.restantes !== null ? (
                        <p className="mb-3 text-[12px] text-ink-3">{t.restantes} place(s) dans cette catégorie</p>
                      ) : null}

                      {complet ? (
                        <p className="text-[13px] font-bold text-red">Complet</p>
                      ) : !session?.user ? (
                        <Link
                          href={`/login?next=/evenements/${ev.slug}`}
                          className="inline-block rounded-pill bg-[#8A5A2B] px-6 py-2.5 text-[13px] font-bold text-white"
                        >
                          Se connecter pour s&apos;inscrire
                        </Link>
                      ) : (
                        <form action={inscrireEventAction.bind(null, t.id)} className="flex flex-wrap items-end gap-3">
                          {t.prix > 0 ? (
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
                          ) : null}
                          <button type="submit" className="rounded-pill bg-[#8A5A2B] px-6 py-2.5 text-[13px] font-bold text-white">
                            {t.prix > 0 ? "Réserver et payer" : "Je m'inscris"}
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {/* Programme / description */}
        {ev.description ? (
          <section className="mb-8">
            <h2 className="mb-3 border-b-2 border-orange pb-3 font-serif text-2xl font-semibold">Au programme</h2>
            <div className="whitespace-pre-line font-serif text-[16px] leading-[1.65] text-ink-2">{ev.description}</div>
          </section>
        ) : null}

        {/* Sponsors */}
        {ev.sponsors.length > 0 ? (
          <section>
            <h2 className="mb-4 border-b-2 border-orange pb-3 font-serif text-2xl font-semibold">Avec nos partenaires</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {ev.sponsors.map((s) => {
                const contenu = (
                  <>
                    {s.logoUrl ? (
                      <img src={s.logoUrl} alt={s.name} className="mx-auto mb-2 h-12 object-contain" />
                    ) : (
                      <div className="mb-2 font-serif text-[15px] font-bold">{s.name}</div>
                    )}
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">{s.niveau}</div>
                  </>
                );
                return (
                  <div key={s.id} className="rounded-[10px] border border-line bg-surface px-4 py-4 text-center">
                    {s.linkUrl ? (
                      <a href={s.linkUrl} target="_blank" rel="noreferrer nofollow sponsored">
                        {contenu}
                      </a>
                    ) : (
                      contenu
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
