import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import {
  createMenuItemAction,
  deleteMenuItemAction,
  moveMenuItemAction,
  seedMenuAction,
  toggleMenuItemAction,
  updateMenuItemAction,
} from "@/lib/actions/menu-actions";

export const metadata: Metadata = { title: "Menu · Studio" };
export const dynamic = "force-dynamic";

const ERREURS: Record<string, string> = {
  label: "Le libellé est obligatoire.",
  href: "L'adresse est obligatoire — un chemin interne (/politique) ou une URL https.",
};

export default async function AdminMenu({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const [items, rubriques] = await Promise.all([
    prisma.menuItem.findMany({ orderBy: { order: "asc" } }),
    prisma.rubrique.findMany({ orderBy: { order: "asc" }, select: { slug: true, name: true } }),
  ]);
  const inp = "rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]";
  const btn = "rounded-pill border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-2 hover:text-ink disabled:opacity-30";

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">Menu principal</h1>
      <p className="mb-6 max-w-[75ch] text-[12.5px] text-ink-3">
        Les entrées de la barre de navigation en haut du site. Tant qu&apos;aucune entrée n&apos;est définie ici, le
        site affiche le menu par défaut — il ne peut donc jamais se retrouver sans navigation.
      </p>

      {erreur && ERREURS[erreur] ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">{ERREURS[erreur]}</p>
      ) : null}

      {items.length === 0 ? (
        <section className="mb-6 rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
          <p className="mb-3 text-[13px] text-ink-2">
            Le menu par défaut est actuellement affiché : À la une, En Direct, Vidéos, Diaspora, Business.
          </p>
          <form action={seedMenuAction}>
            <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">
              Reprendre ce menu pour le modifier
            </button>
          </form>
        </section>
      ) : null}

      <section className="mb-6 rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Nouvelle entrée</div>
        <form action={createMenuItemAction} className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
            Libellé
            <input name="label" required placeholder="Politique" className={inp} />
          </label>
          <label className="grid flex-1 gap-1.5 text-xs font-semibold text-ink-2">
            Adresse
            <input name="href" required placeholder="/politique" list="rubriques-menu" className={inp} />
          </label>
          <datalist id="rubriques-menu">
            {rubriques.map((r) => (
              <option key={r.slug} value={`/${r.slug}`}>{r.name}</option>
            ))}
          </datalist>
          <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">Ajouter</button>
        </form>
      </section>

      {items.length > 0 ? (
        <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
          <div className="grid grid-cols-[70px_1fr_1fr_210px] gap-3 border-b border-line bg-surface-2 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
            <span>Ordre</span><span>Libellé</span><span>Adresse</span><span />
          </div>
          {items.map((item, i) => (
            <div key={item.id} className="grid grid-cols-[70px_1fr_1fr_210px] items-center gap-3 border-b border-line-2 px-5 py-2.5 last:border-b-0">
              <div className="flex gap-1">
                <form action={moveMenuItemAction.bind(null, item.id, "up")}>
                  <button type="submit" className={btn} disabled={i === 0} title="Monter">↑</button>
                </form>
                <form action={moveMenuItemAction.bind(null, item.id, "down")}>
                  <button type="submit" className={btn} disabled={i === items.length - 1} title="Descendre">↓</button>
                </form>
              </div>
              <form action={updateMenuItemAction.bind(null, item.id)} className="col-span-2 grid grid-cols-2 gap-3">
                <input name="label" defaultValue={item.label} className={`${inp} ${item.visible ? "" : "opacity-50"}`} />
                <div className="flex gap-2">
                  <input name="href" defaultValue={item.href} list="rubriques-menu" className={`${inp} flex-1 font-mono text-[12px] ${item.visible ? "" : "opacity-50"}`} />
                  <button type="submit" className="rounded-pill border border-line bg-surface px-3 py-1 text-[11px] font-semibold text-ink-2 hover:text-ink">
                    Enregistrer
                  </button>
                </div>
              </form>
              <div className="flex justify-end gap-2">
                <form action={toggleMenuItemAction.bind(null, item.id)}>
                  <button type="submit" className={btn} title={item.visible ? "Masquer du site" : "Afficher sur le site"}>
                    {item.visible ? "Visible" : "Masquée"}
                  </button>
                </form>
                <form action={deleteMenuItemAction.bind(null, item.id)}>
                  <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3 py-1 text-[11px] font-semibold text-red">
                    Suppr.
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
