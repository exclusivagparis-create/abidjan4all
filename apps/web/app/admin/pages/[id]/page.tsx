import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { deletePageAction, updatePageAction } from "@/lib/actions/page-actions";
import { PageBodyEditor } from "@/components/admin/page-body-editor";

export const metadata: Metadata = { title: "Modifier la page · Studio" };
export const dynamic = "force-dynamic";

export default async function EditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const [{ id }, { ok, erreur }, session] = await Promise.all([params, searchParams, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const page = await prisma.page.findUnique({ where: { id } });
  if (!page) notFound();

  return (
    <div>
      <Link href="/admin/pages" className="mb-4 inline-flex text-[13px] font-semibold text-ink-3 hover:text-ink">‹ Pages</Link>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-bold">Modifier « {page.title} »</h1>
        <Link href={`/${page.slug}`} target="_blank" className="text-[12.5px] font-semibold text-blue">Voir la page ↗</Link>
      </div>

      {ok ? <p className="mb-4 rounded-md bg-[rgba(14,138,95,0.1)] px-4 py-2.5 text-[13px] font-semibold text-green">Page enregistrée.</p> : null}
      {erreur ? <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">Titre requis.</p> : null}

      <form action={updatePageAction.bind(null, page.id)} className="grid gap-4 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
        <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
          Titre
          <input name="title" defaultValue={page.title} required maxLength={120} className="rounded-[8px] border border-line bg-bg px-3 py-2.5 text-[14px]" />
        </label>
        <div className="text-[12px] text-ink-3">Adresse : <code>/{page.slug}</code> (non modifiable — préserve les liens et le SEO)</div>
        <div>
          <div className="mb-1.5 text-xs font-semibold text-ink-2">Contenu</div>
          <PageBodyEditor initial={page.body} />
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-2"><input type="checkbox" name="published" defaultChecked={page.published} /> Publiée</label>
          <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-2"><input type="checkbox" name="inFooter" defaultChecked={page.inFooter} /> Afficher dans le pied de page</label>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">Enregistrer</button>
          <button type="submit" formAction={deletePageAction.bind(null, page.id)} className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-4 py-2.5 text-xs font-semibold text-red">Supprimer</button>
        </div>
      </form>
    </div>
  );
}
