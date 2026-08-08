import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { startBriefCheckoutAction } from "@/lib/actions/order-actions";
import { abonnementActif, peutLireEditions, KIND_LABEL } from "@/lib/intelligence";
// formatDateFull partout : les échéances d'abonnement et l'archive des
// éditions couvrent plusieurs années — l'année doit rester lisible.
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

async function getSerie(slug: string) {
  return prisma.briefSerie.findUnique({ where: { slug } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const serie = await getSerie(slug);
  if (!serie) return {};
  return {
    title: `${serie.title} — A4A Intelligence`,
    description: serie.pitch,
    alternates: { canonical: `/intelligence/${serie.slug}` },
  };
}

export default async function SeriePage({
  params,
  searchParams,
}: Props & { searchParams: Promise<{ indisponible?: string }> }) {
  const [{ slug }, { indisponible }, session] = await Promise.all([params, searchParams, auth()]);
  const serie = await getSerie(slug);
  if (!serie || !serie.actif) notFound();

  const [editions, abonnement, acces] = await Promise.all([
    prisma.briefEdition.findMany({
      where: { serieId: serie.id, publishedAt: { not: null, lte: new Date() } },
      orderBy: { publishedAt: "desc" },
      select: { id: true, numero: true, title: true, resume: true, publishedAt: true, fileUrl: true },
    }),
    abonnementActif(session?.user?.id, serie.id),
    peutLireEditions(session?.user, serie.id),
  ]);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[860px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <Link href="/intelligence" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-ink-3 hover:text-ink">
          ‹ A4A Intelligence
        </Link>

        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <span className="rounded-[3px] bg-[#0E5A8A] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white">
            {KIND_LABEL[serie.kind]}
          </span>
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{serie.rythme}</span>
        </div>
        <h1 className="mb-3 border-b-2 border-ink pb-5 font-serif text-[27px] font-medium leading-[1.15] sm:text-[33px]">
          {serie.title}
        </h1>
        <p className="mb-5 max-w-[68ch] font-serif text-[16.5px] leading-[1.55] text-ink-2">{serie.description}</p>
        <p className="mb-8 text-[13px] text-ink-3">
          <b className="text-ink-2">Destinataires :</b> {serie.cible}
        </p>

        {indisponible ? (
          <p className="mb-6 rounded-md bg-[rgba(232,100,26,0.1)] px-4 py-2.5 text-[13px] font-semibold text-orange">
            Ce moyen de paiement est momentanément indisponible — essayez-en un autre.
          </p>
        ) : null}

        {/* Bloc abonnement / statut */}
        {abonnement ? (
          <div className="mb-9 rounded-[14px] border border-[#1A6B3C] bg-[rgba(26,107,60,0.06)] px-6 py-5">
            <p className="text-[14px] font-semibold text-[#1A6B3C]">
              ✓ Vous êtes abonné jusqu&apos;au {formatDateFull(abonnement.expiresAt)}.
            </p>
            <p className="mt-1 text-[12.5px] text-ink-2">
              Toutes les éditions ci-dessous vous sont accessibles, PDF compris. Vous pouvez prolonger à tout moment —
              les mois restants sont conservés.
            </p>
          </div>
        ) : null}

        {!abonnement ? (
          <section className="mb-9 rounded-[14px] border border-[#0E5A8A] bg-surface px-6 py-6 shadow-[var(--shadow-sm)]">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-line-2 pb-4">
              <h2 className="font-serif text-[20px] font-semibold">S&apos;abonner</h2>
              <span className="text-[13px] text-ink-3">
                <b className="font-serif text-[24px] text-ink">{formatXOF(serie.prixAnnuel)}</b> / {serie.dureeMois} mois
              </span>
            </div>
            {session?.user ? (
              <form action={startBriefCheckoutAction.bind(null, serie.id)} className="flex flex-wrap items-end gap-3">
                <label className="grid gap-1.5 text-xs font-semibold text-ink-2 sm:min-w-[240px]">
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
                  S&apos;abonner et payer
                </button>
              </form>
            ) : (
              <div>
                <p className="mb-3 text-[14px] text-ink-2">Connectez-vous pour souscrire à cette publication.</p>
                <Link
                  href={`/login?next=/intelligence/${serie.slug}`}
                  className="inline-block rounded-pill bg-[#0E5A8A] px-6 py-2.5 text-[13px] font-bold text-white"
                >
                  Se connecter
                </Link>
              </div>
            )}
            <p className="mt-4 text-[11.5px] text-ink-3">
              Facturation en une fois pour {serie.dureeMois} mois de livraisons. Paiement par Mobile Money, carte
              bancaire ou PayPal. Une facture est émise à votre nom.
            </p>
          </section>
        ) : null}

        {/* Éditions */}
        <h2 className="mb-4 border-b-2 border-orange pb-3 font-serif text-2xl font-semibold">Les éditions</h2>
        <div className="grid gap-4">
          {editions.map((e) => (
            <article key={e.id} className="rounded-[14px] border border-line bg-surface px-5 py-4">
              <div className="mb-1 flex flex-wrap items-center gap-2.5 text-[11.5px] text-ink-3">
                <span className="rounded-[3px] border border-line bg-surface-2 px-2 py-0.5 font-bold">{e.numero}</span>
                <span>{formatDateFull(e.publishedAt)}</span>
                {e.fileUrl ? <span className="font-semibold text-[#0E5A8A]">PDF</span> : null}
              </div>
              <h3 className="mb-1.5 font-serif text-[17.5px] font-semibold leading-[1.25]">
                <Link href={`/intelligence/${serie.slug}/${encodeURIComponent(e.numero)}`} className="hover:underline">
                  {e.title}
                </Link>
              </h3>
              <p className="mb-2.5 max-w-[70ch] text-[13.5px] leading-[1.55] text-ink-2">{e.resume}</p>
              <Link
                href={`/intelligence/${serie.slug}/${encodeURIComponent(e.numero)}`}
                className="text-[12.5px] font-bold text-[#0E5A8A] hover:underline"
              >
                {acces ? "Lire l'édition →" : "Aperçu de l'édition →"}
              </Link>
            </article>
          ))}
          {editions.length === 0 ? (
            <p className="rounded-[14px] border border-line bg-surface-2 px-5 py-7 text-center text-[13.5px] text-ink-3">
              La première édition est en préparation. Les abonnés la reçoivent dès sa parution.
            </p>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
