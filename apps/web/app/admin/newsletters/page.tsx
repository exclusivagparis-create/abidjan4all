import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { createEditionAction } from "@/lib/actions/newsletter-actions";
import { PageBodyEditor } from "@/components/admin/page-body-editor";
import { emailConfigured } from "@/lib/email";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Newsletters · Studio" };
export const dynamic = "force-dynamic";

export default async function AdminNewsletters({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
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

  const inp = "rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]";

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">Newsletters</h1>
      {!emailConfigured ? (
        <p className="mb-4 rounded-md bg-[rgba(232,100,26,0.1)] px-4 py-2.5 text-[13px] font-semibold text-orange">
          SMTP non configuré — vous pouvez composer des éditions, mais l&apos;envoi est désactivé.
        </p>
      ) : null}
      {erreur === "1" ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">Édition invalide — objet requis.</p>
      ) : null}

      {/* Abonnés par newsletter */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {newsletters.map((nl) => (
          <div key={nl.id} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
            <div className="font-serif text-[26px] font-medium">{nl._count.subscriptions}</div>
            <div className="mt-0.5 text-[12px] text-ink-3">{nl.name} · {nl.cadence}</div>
          </div>
        ))}
      </div>

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
