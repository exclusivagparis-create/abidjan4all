import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { createRedirectAction, deleteRedirectAction } from "@/lib/actions/redirect-actions";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Redirections · Studio" };
export const dynamic = "force-dynamic";

const ERREURS: Record<string, string> = {
  from: "Adresse source invalide — une seule section, ex. /ancienne-page.html",
  to: "Destination invalide — un chemin interne (/rubrique/article) ou une URL https.",
  doublon: "Une redirection existe déjà pour cette adresse source.",
  boucle: "La source et la destination sont identiques.",
};

export default async function AdminRedirections({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const rules = await prisma.redirect.findMany({ orderBy: [{ hits: "desc" }, { createdAt: "desc" }] });
  const inp = "rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]";

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">Redirections 301</h1>
      <p className="mb-6 max-w-[75ch] text-[12.5px] text-ink-3">
        Rediriger une ancienne adresse vers une nouvelle, sans perdre le référencement. Les redirections
        structurelles de l&apos;ancien site (<code>*_rNN.html</code>, <code>syndication.rss</code>…) sont déjà
        gérées automatiquement — celles-ci s&apos;ajoutent au cas par cas.
      </p>

      {erreur && ERREURS[erreur] ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">{ERREURS[erreur]}</p>
      ) : null}

      <section className="mb-6 rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Nouvelle redirection</div>
        <form action={createRedirectAction} className="flex flex-wrap items-end gap-3">
          <label className="grid flex-1 gap-1.5 text-xs font-semibold text-ink-2">
            Ancienne adresse
            <input name="from" required placeholder="/ancien-dossier.html" className={inp} />
          </label>
          <span className="pb-2 text-ink-3">→</span>
          <label className="grid flex-1 gap-1.5 text-xs font-semibold text-ink-2">
            Nouvelle destination
            <input name="to" required placeholder="/politique/mon-article" className={inp} />
          </label>
          <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">Ajouter</button>
        </form>
      </section>

      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        <div className="grid grid-cols-[1fr_1fr_80px_110px_90px] gap-3 border-b border-line bg-surface-2 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
          <span>Source</span><span>Destination</span><span className="text-right">Visites</span><span>Créée</span><span />
        </div>
        {rules.map((r) => (
          <div key={r.id} className="grid grid-cols-[1fr_1fr_80px_110px_90px] items-center gap-3 border-b border-line-2 px-5 py-3 last:border-b-0">
            <span className="truncate font-mono text-[12.5px]">{r.from}</span>
            <span className="truncate font-mono text-[12.5px] text-ink-2">{r.to}</span>
            <span className="text-right text-[12.5px] font-bold">{r.hits}</span>
            <span className="text-[12px] text-ink-3">{formatDate(r.createdAt)}</span>
            <form action={deleteRedirectAction.bind(null, r.id)}>
              <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3 py-1 text-[11px] font-semibold text-red">Suppr.</button>
            </form>
          </div>
        ))}
        {rules.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-ink-3">Aucune redirection personnalisée.</p> : null}
      </div>
    </div>
  );
}
