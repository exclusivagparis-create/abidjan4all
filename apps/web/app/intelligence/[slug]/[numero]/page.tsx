import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArticleBody } from "@/components/article-body";
import { peutLireEditions, KIND_LABEL } from "@/lib/intelligence";
import { formatDateFull } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; numero: string }> };

async function getEdition(slug: string, numero: string) {
  const serie = await prisma.briefSerie.findUnique({ where: { slug } });
  if (!serie) return null;
  const edition = await prisma.briefEdition.findUnique({
    where: { serieId_numero: { serieId: serie.id, numero: decodeURIComponent(numero) } },
  });
  return edition ? { serie, edition } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, numero } = await params;
  const found = await getEdition(slug, numero);
  if (!found) return {};
  const { serie, edition } = found;
  // Le corps est réservé aux abonnés : on n'indexe que le résumé.
  return {
    title: `${edition.title} — ${serie.title}`,
    description: edition.resume.slice(0, 300),
    alternates: { canonical: `/intelligence/${serie.slug}/${encodeURIComponent(edition.numero)}` },
  };
}

export default async function EditionPage({ params }: Props) {
  const [{ slug, numero }, session] = await Promise.all([params, auth()]);
  const found = await getEdition(slug, numero);
  if (!found) notFound();
  const { serie, edition } = found;

  // Édition non encore publiée : visible de la seule rédaction (relecture).
  const enApercu = !edition.publishedAt || edition.publishedAt > new Date();
  const acces = await peutLireEditions(session?.user, serie.id);
  if (enApercu && !["editor", "admin"].includes(session?.user?.role ?? "")) notFound();

  const blocks = Array.isArray(edition.body) ? edition.body : [];

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      {enApercu ? (
        <div className="bg-[#B7791F] px-4 py-2.5 text-center text-[12.5px] font-bold text-white">
          Aperçu — édition non publiée. Seule la rédaction voit cette page.
        </div>
      ) : null}

      <main className="mx-auto max-w-[760px] px-4 sm:px-6 lg:px-8 pb-24 pt-11">
        <nav className="mb-5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
          <Link href="/intelligence" className="hover:text-ink">
            A4A Intelligence
          </Link>
          <span className="mx-2">›</span>
          <Link href={`/intelligence/${serie.slug}`} className="hover:underline" style={{ color: "#0E5A8A" }}>
            {serie.title}
          </Link>
        </nav>

        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <span className="rounded-[3px] bg-[#0E5A8A] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white">
            {KIND_LABEL[serie.kind]}
          </span>
          <span className="rounded-[3px] border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-ink-2">
            {edition.numero}
          </span>
        </div>

        <h1 className="mb-4 font-serif text-[clamp(26px,4.4vw,38px)] font-extrabold leading-[1.15] tracking-tight">
          {edition.title}
        </h1>
        <p className="mb-6 border-l-4 border-[#0E5A8A] pl-4 font-serif text-[17px] italic leading-[1.55] text-ink-2">
          {edition.resume}
        </p>
        <div className="mb-8 border-b-2 border-ink pb-5 text-[12.5px] text-ink-3">
          {formatDateFull(edition.publishedAt)} · Rédaction Abidjan4All
        </div>

        {acces ? (
          <>
            {edition.fileUrl ? (
              <a
                href={`/intelligence/${serie.slug}/${encodeURIComponent(edition.numero)}/pdf`}
                className="mb-8 flex items-center justify-between gap-4 rounded-[12px] border border-[#0E5A8A] bg-[rgba(14,90,138,0.06)] px-5 py-4"
              >
                <span>
                  <span className="block text-[14px] font-bold text-ink">⭳ Télécharger l&apos;édition en PDF</span>
                  <span className="text-[12px] text-ink-3">Version imprimable, à partager au sein de votre équipe.</span>
                </span>
                <span className="flex-none rounded-pill bg-[#0E5A8A] px-4 py-2 text-[12.5px] font-bold text-white">PDF</span>
              </a>
            ) : null}
            {blocks.length > 0 ? (
              <ArticleBody blocks={blocks} />
            ) : (
              <p className="text-[14px] text-ink-3">
                Cette édition est diffusée sous forme de document téléchargeable.
              </p>
            )}
          </>
        ) : (
          /* Paywall B2B — le résumé reste public, le corps est réservé. */
          <div className="rounded-[14px] border border-line bg-surface px-7 py-8 text-center shadow-[var(--shadow-sm)]">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-pill bg-[#0E5A8A] px-3.5 py-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-white">
              Réservé aux abonnés
            </span>
            <h2 className="mb-2.5 font-serif text-[24px] font-medium leading-[1.2]">
              L&apos;intégralité de cette édition est réservée aux abonnés
            </h2>
            <p className="mx-auto mb-6 max-w-[52ch] font-serif text-[15px] leading-[1.55] text-ink-2">
              Abonnez-vous à <b>{serie.title}</b> pour accéder à cette édition, à toutes les précédentes et à celles à
              venir pendant {serie.dureeMois} mois — PDF téléchargeables compris.
            </p>
            <Link
              href={`/intelligence/${serie.slug}`}
              className="inline-block rounded-pill bg-[#0E5A8A] px-7 py-3 text-[14px] font-bold text-white"
            >
              S&apos;abonner — {formatXOF(serie.prixAnnuel)}
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
