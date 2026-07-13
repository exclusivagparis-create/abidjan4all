import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import {
  deleteEditionAction,
  sendEditionAction,
  updateEditionAction,
} from "@/lib/actions/newsletter-actions";
import { PageBodyEditor } from "@/components/admin/page-body-editor";
import { buildEditionHtml } from "@/lib/newsletter";
import { emailConfigured } from "@/lib/email";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Édition newsletter · Studio" };
export const dynamic = "force-dynamic";

export default async function EditionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string; envoye?: string }>;
}) {
  const [{ id }, sp, session] = await Promise.all([params, searchParams, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const edition = await prisma.newsletterEdition.findUnique({
    where: { id },
    include: { newsletter: { include: { _count: { select: { subscriptions: { where: { confirmed: true } } } } } } },
  });
  if (!edition) notFound();

  const ids = Array.isArray(edition.articleIds) ? (edition.articleIds as string[]) : [];
  const [selected, recent] = await Promise.all([
    ids.length
      ? prisma.article.findMany({
          where: { id: { in: ids } },
          select: { id: true, slug: true, title: true, dek: true, rubrique: { select: { slug: true, name: true, color: true } } },
        })
      : Promise.resolve([]),
    prisma.article.findMany({
      where: { status: "published", hidden: false },
      orderBy: { publishedAt: "desc" },
      take: 15,
      select: { id: true, title: true, rubrique: { select: { name: true } } },
    }),
  ]);
  const orderedArticles = ids.map((aid) => selected.find((a) => a.id === aid)).filter(Boolean) as typeof selected;
  const sent = edition.status === "sent";
  const recipients = edition.newsletter._count.subscriptions;

  const previewHtml = buildEditionHtml({
    newsletterName: edition.newsletter.name,
    subject: edition.subject,
    introHtml: edition.introHtml,
    articles: orderedArticles,
    unsubscribeUrl: "#",
  });

  return (
    <div>
      <Link href="/admin/newsletters" className="mb-4 inline-flex text-[13px] font-semibold text-ink-3 hover:text-ink">‹ Newsletters</Link>
      <h1 className="mb-1 text-lg font-bold">{edition.subject}</h1>
      <p className="mb-5 text-[12.5px] text-ink-3">
        {edition.newsletter.name} · {sent ? `envoyée le ${formatDate(edition.sentAt!)} à ${edition.recipientCount} abonnés` : `brouillon · ${recipients} abonnés confirmés`}
      </p>

      {sp.ok ? <p className="mb-4 rounded-md bg-[rgba(14,138,95,0.1)] px-4 py-2.5 text-[13px] font-semibold text-green">Édition enregistrée.</p> : null}
      {sp.envoye ? <p className="mb-4 rounded-md bg-[rgba(14,138,95,0.1)] px-4 py-2.5 text-[13px] font-semibold text-green">✓ Édition envoyée à {sp.envoye} abonné(s).</p> : null}
      {sp.erreur === "smtp" ? <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">Envoi impossible : SMTP non configuré.</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Édition (verrouillée si envoyée) */}
        <div>
          {sent ? (
            <div className="rounded-[14px] border border-line bg-surface p-6 text-[13px] text-ink-3 shadow-[var(--shadow-sm)]">
              Cette édition a été envoyée — elle n&apos;est plus modifiable. Composez une nouvelle édition pour un
              prochain envoi.
            </div>
          ) : (
            <form action={updateEditionAction.bind(null, edition.id)} className="grid gap-4 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
              <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Objet
                <input name="subject" defaultValue={edition.subject} required maxLength={160} className="rounded-[8px] border border-line bg-bg px-3 py-2.5 text-[14px]" />
              </label>
              <div>
                <div className="mb-1.5 text-xs font-semibold text-ink-2">Introduction</div>
                <PageBodyEditor initial={edition.introHtml} />
              </div>
              <div>
                <div className="mb-1.5 text-xs font-semibold text-ink-2">Articles inclus</div>
                <div className="grid max-h-[220px] gap-1.5 overflow-y-auto rounded border border-line bg-bg p-3">
                  {recent.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 text-[12.5px]">
                      <input type="checkbox" name="articleIds" value={a.id} defaultChecked={ids.includes(a.id)} />
                      <span className="text-ink-3">[{a.rubrique.name}]</span> {a.title}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">Enregistrer</button>
                <button type="submit" formAction={deleteEditionAction.bind(null, edition.id)} className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-4 py-2.5 text-xs font-semibold text-red">Supprimer</button>
              </div>
            </form>
          )}

          {/* Envoi */}
          {!sent ? (
            <form action={sendEditionAction.bind(null, edition.id)} className="mt-4 rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
              <div className="mb-2 text-sm font-bold">Envoyer maintenant</div>
              <p className="mb-3 text-[12.5px] text-ink-3">
                L&apos;édition partira aux <b>{recipients}</b> abonné(s) confirmé(s) de « {edition.newsletter.name} ».
                Chaque e-mail contient un lien de désabonnement. Action irréversible.
              </p>
              <button
                type="submit"
                disabled={!emailConfigured || recipients === 0}
                className="rounded-pill bg-red px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {emailConfigured ? `Envoyer à ${recipients} abonné(s)` : "SMTP non configuré"}
              </button>
            </form>
          ) : null}
        </div>

        {/* Aperçu e-mail */}
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Aperçu</div>
          <iframe title="Aperçu de la newsletter" srcDoc={previewHtml} className="h-[560px] w-full rounded-[10px] border border-line bg-white" />
        </div>
      </div>
    </div>
  );
}
