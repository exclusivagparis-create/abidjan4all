import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import {
  deleteEditionAction,
  sendEditionAction,
  setRecipientsAction,
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
  searchParams: Promise<{ ok?: string; erreur?: string; envoye?: string; dest?: string }>;
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

  // Destinataires : sélection figée de l'édition, sinon tous les inscrits.
  const inscrits = await prisma.newsletterSubscription.findMany({
    where: { newsletterId: edition.newsletterId, confirmed: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, createdAt: true, user: { select: { name: true } } },
  });
  const choisis = Array.isArray(edition.recipientEmails) ? (edition.recipientEmails as string[]) : [];
  const selectionPartielle = choisis.length > 0;
  const estChoisi = (email: string) => !selectionPartielle || choisis.includes(email);
  const recipients = selectionPartielle
    ? inscrits.filter((s) => estChoisi(s.email)).length
    : inscrits.length;

  const previewHtml = buildEditionHtml({
    newsletterName: edition.newsletter.name,
    subject: edition.subject,
    introHtml: edition.introHtml,
    articles: orderedArticles,
    unsubscribeUrl: "#",
    sponsor: edition.sponsorName
      ? {
          name: edition.sponsorName,
          baseline: edition.sponsorBaseline,
          logoUrl: edition.sponsorLogoUrl,
          linkUrl: edition.sponsorLinkUrl,
        }
      : null,
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
              {/* Sponsor exclusif de l'envoi (Brand Content, 600 000 F l'envoi). */}
              <fieldset className="grid gap-2.5 rounded-[10px] border border-dashed border-line bg-surface-2 p-4">
                <legend className="px-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                  Sponsor de l&apos;envoi (optionnel)
                </legend>
                <p className="text-[11.5px] text-ink-3">
                  Laissez le nom vide pour un envoi sans sponsor. L&apos;encart est annoncé « Cet envoi vous est offert
                  par » — la mention est obligatoire.
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <label className="grid gap-1 text-[11px] font-semibold text-ink-3">
                    Nom du sponsor
                    <input name="sponsorName" defaultValue={edition.sponsorName ?? ""} maxLength={80} className="rounded-[8px] border border-line bg-bg px-3 py-2 text-[13px]" />
                  </label>
                  <label className="grid gap-1 text-[11px] font-semibold text-ink-3">
                    Lien (https)
                    <input name="sponsorLinkUrl" type="url" defaultValue={edition.sponsorLinkUrl ?? ""} className="rounded-[8px] border border-line bg-bg px-3 py-2 text-[13px]" />
                  </label>
                  <label className="grid gap-1 text-[11px] font-semibold text-ink-3">
                    Accroche
                    <input name="sponsorBaseline" defaultValue={edition.sponsorBaseline ?? ""} maxLength={160} className="rounded-[8px] border border-line bg-bg px-3 py-2 text-[13px]" />
                  </label>
                  <label className="grid gap-1 text-[11px] font-semibold text-ink-3">
                    Logo (adresse depuis la médiathèque)
                    <input name="sponsorLogoUrl" defaultValue={edition.sponsorLogoUrl ?? ""} placeholder="/uploads/…" className="rounded-[8px] border border-line bg-bg px-3 py-2 text-[13px]" />
                  </label>
                </div>
              </fieldset>

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

          {/* Choix des destinataires */}
          {!sent ? (
            <form action={setRecipientsAction.bind(null, edition.id)} className="mt-4 rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
              <div className="mb-1 text-sm font-bold">Destinataires</div>
              <p className="mb-3 text-[12.5px] text-ink-3">
                {selectionPartielle ? (
                  <>
                    Sélection figée : <b>{recipients}</b> adresse(s) sur {inscrits.length}. Tout cocher rétablit
                    l&apos;envoi à tous les inscrits, y compris ceux à venir.
                  </>
                ) : (
                  <>
                    Tous les inscrits — <b>{inscrits.length}</b> adresse(s), y compris celles inscrites d&apos;ici
                    l&apos;envoi. Décochez pour restreindre.
                  </>
                )}
              </p>

              {inscrits.length === 0 ? (
                <p className="text-[12.5px] text-ink-3">Aucun inscrit pour l&apos;instant.</p>
              ) : (
                <>
                  <div className="max-h-[220px] overflow-y-auto rounded-[10px] border border-line-2">
                    {inscrits.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2.5 border-b border-line-2 px-3 py-2 last:border-b-0 hover:bg-surface-2/60"
                      >
                        <input
                          type="checkbox"
                          name="recipients"
                          value={s.email}
                          defaultChecked={estChoisi(s.email)}
                        />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{s.email}</span>
                        {s.user ? <span className="truncate text-[11.5px] text-ink-3">{s.user.name}</span> : null}
                        <span className="flex-none text-[11px] text-ink-3">{formatDate(s.createdAt)}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="mt-3 rounded-pill border border-line bg-surface-2 px-4 py-2 text-xs font-bold text-ink"
                  >
                    Enregistrer les destinataires
                  </button>
                  {sp.dest ? (
                    <span className="ml-3 text-[12px] font-semibold text-green">
                      {sp.dest} destinataire(s) retenu(s).
                    </span>
                  ) : null}
                </>
              )}
            </form>
          ) : null}

          {/* Envoi */}
          {!sent ? (
            <form action={sendEditionAction.bind(null, edition.id)} className="mt-4 rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
              <div className="mb-2 text-sm font-bold">Envoyer maintenant</div>
              <p className="mb-3 text-[12.5px] text-ink-3">
                L&apos;édition partira à <b>{recipients}</b> abonné(s) confirmé(s) de « {edition.newsletter.name} »
                {selectionPartielle ? " (sélection restreinte ci-dessus)" : ""}.
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
