import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { createPageAction } from "@/lib/actions/page-actions";
import { PageBodyEditor } from "@/components/admin/page-body-editor";

export const metadata: Metadata = { title: "Pages · Studio" };
export const dynamic = "force-dynamic";

const ERREURS: Record<string, string> = {
  "1": "Page invalide — titre requis.",
  slug: "Cette adresse (slug) est déjà utilisée par une rubrique ou une autre page.",
};

export default async function AdminPages({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const pages = await prisma.page.findMany({ orderBy: { order: "asc" } });
  const inp = "rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]";

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">Pages statiques</h1>
      <p className="mb-6 max-w-[70ch] text-[12.5px] text-ink-3">
        Pages éditoriales et légales (À propos, Mentions légales, Contact, CGU, Confidentialité). Elles sont servies à
        l&apos;adresse <code>/slug</code> et peuvent apparaître dans le pied de page.
      </p>

      {erreur && ERREURS[erreur] ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">{ERREURS[erreur]}</p>
      ) : null}

      <section className="mb-6 rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Nouvelle page</div>
        <form action={createPageAction} className="grid gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="grid flex-1 gap-1.5 text-xs font-semibold text-ink-2">Titre<input name="title" required maxLength={120} placeholder="Mentions légales" className={inp} /></label>
            <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Adresse (slug, optionnel)<input name="slug" placeholder="mentions-legales" className={inp} /></label>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold text-ink-2">Contenu</div>
            <PageBodyEditor />
          </div>
          <button type="submit" className="justify-self-start rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">Créer</button>
        </form>
      </section>

      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        {pages.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-line-2 px-5 py-3.5 last:border-b-0">
            <div className="min-w-0 flex-1">
              <div className="font-bold">{p.title}</div>
              <div className="font-mono text-[11.5px] text-ink-3">/{p.slug} · {p.published ? "publiée" : "masquée"}{p.inFooter ? " · pied de page" : ""}</div>
            </div>
            <Link href={`/${p.slug}`} target="_blank" className="rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-[11.5px] font-semibold text-ink-2">Voir</Link>
            <Link href={`/admin/pages/${p.id}`} className="rounded-pill border border-line bg-surface-2 px-3.5 py-1.5 text-[11.5px] font-semibold text-ink-2">Modifier</Link>
          </div>
        ))}
        {pages.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-ink-3">Aucune page — créez au moins les pages légales.</p> : null}
      </div>
    </div>
  );
}
