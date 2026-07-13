import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";
import { createGroupAction, deleteGroupAction, updateGroupAction } from "@/lib/actions/admin-content-actions";

export const metadata: Metadata = { title: "Groupes · Studio" };
export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("fr-FR");
const ERREURS: Record<string, string> = {
  "1": "Groupe invalide — nom et couleur requis.",
  doublon: "Un groupe avec ce nom existe déjà.",
  membres: "Ce groupe a des membres réels — impossible de le supprimer.",
};

export default async function AdminCommunity({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  if (session?.user?.role !== "admin") redirect("/admin");

  const groups = await prisma.group.findMany({
    orderBy: { membersCount: "desc" },
    include: { _count: { select: { members: true } } },
  });

  return (
    <div>
      <h1 className="mb-6 text-lg font-bold">Groupes de la communauté</h1>

      {erreur && ERREURS[erreur] ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">{ERREURS[erreur]}</p>
      ) : null}

      <section className="mb-6 rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Nouveau groupe</div>
        <form action={createGroupAction} className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
            Nom
            <input name="name" required maxLength={60} placeholder="Diaspora Québec" className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
            Couleur
            <input name="color" type="color" defaultValue="#2E5AAC" className="h-9 w-14 cursor-pointer rounded border border-line bg-surface" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
            Compteur affiché
            <input name="membersCount" type="number" min={0} defaultValue={0} className="w-28 rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]" />
          </label>
          <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">Créer</button>
        </form>
      </section>

      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        {groups.map((g) => (
          <form
            key={g.id}
            action={updateGroupAction.bind(null, g.id)}
            className="flex flex-wrap items-center gap-3 border-b border-line-2 px-5 py-3.5 last:border-b-0"
          >
            <input name="color" type="color" defaultValue={g.color} className="h-8 w-10 cursor-pointer rounded border border-line bg-bg" />
            <input name="name" defaultValue={g.name} maxLength={60} className="min-w-[180px] flex-1 rounded border border-line bg-bg px-2.5 py-1.5 text-[13px] font-bold" />
            <label className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
              Compteur
              <input name="membersCount" type="number" min={0} defaultValue={g.membersCount} className="w-24 rounded border border-line bg-bg px-2 py-1.5 text-[13px]" />
            </label>
            <span className="text-[11.5px] text-ink-3">{nf.format(g._count.members)} membre(s) réel(s)</span>
            <button type="submit" className="rounded-pill bg-brand-fill px-3.5 py-1.5 text-[11.5px] font-bold text-brand-on">Enregistrer</button>
            <button
              type="submit"
              formAction={deleteGroupAction.bind(null, g.id)}
              className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3.5 py-1.5 text-[11.5px] font-semibold text-red"
            >
              Supprimer
            </button>
          </form>
        ))}
        {groups.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-ink-3">Aucun groupe.</p> : null}
      </div>
    </div>
  );
}
