import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { createEditionAction } from "@/lib/actions/newsletter-actions";
import {
  createNewsletterAction,
  updateNewsletterAction,
  deleteNewsletterAction,
  ajouterInscritAction,
  retirerInscritAction,
} from "@/lib/actions/newsletter-admin-actions";
import { PageBodyEditor } from "@/components/admin/page-body-editor";
import { SEGMENTS } from "@/lib/newsletter-segments";
import { emailConfigured } from "@/lib/email";
import { formatDate } from "@/lib/format";

const MESSAGES: Record<string, string> = {
  lettre: "Newsletter invalide — le nom doit faire au moins deux caractères.",
  inscrits: "Cette newsletter a des inscrits : retirez-les d'abord, ou gardez-la.",
  email: "Adresse e-mail invalide.",
  "1": "Édition invalide — objet requis.",
};
const SUCCES: Record<string, string> = {
  creee: "Newsletter créée.",
  modifiee: "Newsletter modifiée.",
  supprimee: "Newsletter supprimée.",
};

export const metadata: Metadata = { title: "Newsletters · Studio" };
export const dynamic = "force-dynamic";

export default async function AdminNewsletters({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; lettre?: string; inscrit?: string }>;
}) {
  const [{ erreur, lettre }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const [newsletters, editions, articles] = await Promise.all([
    prisma.newsletter.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { subscriptions: { where: { confirmed: true } } } } },
    }),
    prisma.newsletterEdition.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { newsletter: { select: { name: true } } },
    }),
    prisma.article.findMany({
      where: { status: "published", hidden: false },
      orderBy: { publishedAt: "desc" },
      take: 15,
      select: { id: true, title: true, rubrique: { select: { name: true } } },
    }),
  ]);

  // Suivi des inscriptions : qui s'est inscrit, quand, à quelle lettre.
  const inscrits = await prisma.newsletterSubscription.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      email: true,
      confirmed: true,
      createdAt: true,
      newsletter: { select: { name: true } },
      user: { select: { id: true, name: true } },
    },
  });

  const inp = "rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]";

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">Newsletters</h1>
      {!emailConfigured ? (
        <p className="mb-4 rounded-md bg-[rgba(232,100,26,0.1)] px-4 py-2.5 text-[13px] font-semibold text-orange">
          SMTP non configuré — vous pouvez composer des éditions, mais l&apos;envoi est désactivé.
        </p>
      ) : null}
      {erreur ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
          {MESSAGES[erreur] ?? "Une erreur est survenue."}
        </p>
      ) : null}
      {lettre && SUCCES[lettre] ? (
        <p className="mb-4 rounded-md bg-[rgba(14,138,95,0.1)] px-4 py-2.5 text-[13px] font-semibold text-green">
          {SUCCES[lettre]}
        </p>
      ) : null}

      {/* Catalogue : les lettres auxquelles on peut s'abonner */}
      <section className="mb-6">
        <h2 className="mb-1 text-sm font-bold">Les newsletters</h2>
        <p className="mb-4 max-w-[72ch] text-[12.5px] text-ink-3">
          Chaque newsletter a sa propre liste d&apos;inscrits. Les membres choisissent celles qu&apos;ils reçoivent
          depuis leur espace membre ; vous pouvez aussi y ajouter une adresse à la main.
        </p>

        <div className="grid gap-3">
          {newsletters.map((nl) => (
            <div key={nl.id} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="font-serif text-[17px] font-bold">{nl.name}</span>
                <span className="rounded-pill border border-line bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-ink-2">
                  {nl.cadence}
                </span>
                <span className="text-[12.5px] text-ink-3">
                  <b className="text-ink">{nl._count.subscriptions}</b> inscrit(s) confirmé(s)
                </span>
                <code className="ml-auto text-[11px] text-ink-3">/{nl.slug}</code>
              </div>

              <form action={updateNewsletterAction.bind(null, nl.id)} className="grid gap-2.5 sm:grid-cols-12">
                <label className="grid gap-1 text-[11px] font-semibold text-ink-3 sm:col-span-4">
                  Nom
                  <input name="name" defaultValue={nl.name} required maxLength={100} className={inp} />
                </label>
                <label className="grid gap-1 text-[11px] font-semibold text-ink-3 sm:col-span-3">
                  Cadence
                  <input name="cadence" defaultValue={nl.cadence} maxLength={40} className={inp} />
                </label>
                <label className="grid gap-1 text-[11px] font-semibold text-ink-3 sm:col-span-5">
                  Description (visible des membres)
                  <input name="description" defaultValue={nl.description} maxLength={400} className={inp} />
                </label>
                <div className="flex flex-wrap items-center gap-2 sm:col-span-12">
                  <button type="submit" className="rounded-pill bg-ink px-4 py-1.5 text-[11.5px] font-bold text-bg">
                    Enregistrer
                  </button>
                </div>
              </form>

              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line-2 pt-3">
                <form action={ajouterInscritAction.bind(null, nl.id)} className="flex flex-1 flex-wrap items-end gap-2">
                  <label className="grid min-w-[220px] flex-1 gap-1 text-[11px] font-semibold text-ink-3">
                    Ajouter un inscrit (adresse e-mail)
                    <input name="email" type="email" required placeholder="lecteur@exemple.com" className={inp} />
                  </label>
                  <button type="submit" className="rounded-pill border border-ink px-4 py-2 text-[11.5px] font-bold text-ink">
                    Ajouter
                  </button>
                </form>
                <form action={deleteNewsletterAction.bind(null, nl.id)}>
                  <button
                    type="submit"
                    className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3 py-2 text-[11.5px] font-semibold text-red"
                  >
                    Supprimer
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-[14px] border border-dashed border-line bg-surface-2 px-5 py-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Nouvelle newsletter</div>
          <form action={createNewsletterAction} className="grid gap-2.5 sm:grid-cols-12">
            <label className="grid gap-1 text-[11px] font-semibold text-ink-3 sm:col-span-4">
              Nom
              <input name="name" required maxLength={100} placeholder="La Matinale" className={inp} />
            </label>
            <label className="grid gap-1 text-[11px] font-semibold text-ink-3 sm:col-span-3">
              Cadence
              <input name="cadence" maxLength={40} placeholder="quotidienne" className={inp} />
            </label>
            <label className="grid gap-1 text-[11px] font-semibold text-ink-3 sm:col-span-5">
              Description
              <input name="description" maxLength={400} placeholder="5 infos essentielles, chaque matin." className={inp} />
            </label>
            <div className="sm:col-span-12">
              <button type="submit" className="rounded-pill bg-red px-5 py-2 text-[12.5px] font-bold text-white">
                Créer la newsletter
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Suivi des inscriptions (CRM) */}
      <section className="mb-6 overflow-x-auto rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-5 py-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
            Inscriptions ({inscrits.length}{inscrits.length === 200 ? " dernières" : ""})
          </span>
          <span className="text-[11px] text-ink-3">Depuis le site, l&apos;espace membre ou l&apos;accueil</span>
        </div>
        {inscrits.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-ink-3">
            Aucune inscription pour l&apos;instant. Le formulaire est en bas de la page d&apos;accueil.
          </p>
        ) : (
          <>
            <div className="grid min-w-[700px] grid-cols-[1fr_180px_120px_110px_80px] gap-3 border-b border-line px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
              <span>Adresse</span><span>Newsletter</span><span>Compte</span><span>Inscrit le</span><span />
            </div>
            {inscrits.map((s) => (
              <div key={s.id} className="grid min-w-[700px] grid-cols-[1fr_180px_120px_110px_80px] items-center gap-3 border-b border-line-2 px-5 py-2.5 last:border-b-0">
                <span className="truncate text-[12.5px] font-semibold">
                  {s.email}
                  {!s.confirmed ? (
                    <span className="ml-2 rounded-pill border border-line px-1.5 py-px text-[9.5px] font-bold uppercase text-ink-3">
                      non confirmé
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-[12px] text-ink-2">{s.newsletter.name}</span>
                <span className="truncate text-[12px] text-ink-3">
                  {s.user ? (
                    <Link href={`/membre/${s.user.id}`} className="text-blue hover:underline">{s.user.name}</Link>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="text-[12px] text-ink-3">{formatDate(s.createdAt)}</span>
                <form action={retirerInscritAction.bind(null, s.id)}>
                  <button
                    type="submit"
                    title="Retirer cette inscription"
                    className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-2.5 py-1 text-[11px] font-semibold text-red"
                  >
                    Retirer
                  </button>
                </form>
              </div>
            ))}
          </>
        )}
      </section>

      {/* Composer une édition */}
      <section className="mb-6 rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Composer une édition</div>
        <form action={createEditionAction} className="grid gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Newsletter
              <select name="newsletterId" required className={inp}>
                {newsletters.map((nl) => <option key={nl.id} value={nl.id}>{nl.name} ({nl._count.subscriptions} abonnés)</option>)}
              </select>
            </label>
            <label className="grid flex-1 gap-1.5 text-xs font-semibold text-ink-2">Objet de l&apos;e-mail
              <input name="subject" required maxLength={160} placeholder="L'essentiel de la semaine" className={inp} />
            </label>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold text-ink-2">Introduction (optionnel)</div>
            <PageBodyEditor />
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold text-ink-2">Articles à inclure (jusqu&apos;à 12)</div>
            <div className="grid max-h-[220px] gap-1.5 overflow-y-auto rounded border border-line bg-surface p-3">
              {articles.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-[12.5px]">
                  <input type="checkbox" name="articleIds" value={a.id} />
                  <span className="text-ink-3">[{a.rubrique.name}]</span> {a.title}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="justify-self-start rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">Créer le brouillon</button>
        </form>
      </section>

      {/* Historique des éditions */}
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        {editions.map((e) => (
          <Link key={e.id} href={`/admin/newsletters/${e.id}`} className="flex flex-wrap items-center gap-3 border-b border-line-2 px-5 py-3.5 last:border-b-0 hover:bg-surface-2/60">
            <div className="min-w-0 flex-1">
              <div className="font-bold">{e.subject}</div>
              <div className="text-[11.5px] text-ink-3">{e.newsletter.name} · {formatDate(e.createdAt)}</div>
            </div>
            {e.status === "sent" ? (
              <span className="rounded-pill bg-[rgba(14,138,95,0.12)] px-3 py-1 text-[11px] font-bold text-green">Envoyée · {e.recipientCount}</span>
            ) : (
              <span className="rounded-pill bg-surface-2 px-3 py-1 text-[11px] font-bold text-ink-3">Brouillon</span>
            )}
          </Link>
        ))}
        {editions.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-ink-3">Aucune édition — composez la première ci-dessus.</p> : null}
      </div>
    </div>
  );
}
