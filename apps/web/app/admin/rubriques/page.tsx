import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type RubriqueKind } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import {
  createRubriqueAction,
  deleteRubriqueAction,
  updateRubriqueAction,
} from "@/lib/actions/rubrique-actions";

export const metadata: Metadata = { title: "Rubriques · Studio" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<RubriqueKind, string> = {
  gratuit: "Gratuit",
  premium: "Premium",
  freemium: "Freemium",
  affiliation: "Affiliation",
};
const KINDS = Object.keys(KIND_LABEL) as RubriqueKind[];

const ERREURS: Record<string, string> = {
  invalide: "Rubrique invalide — vérifiez le nom, la couleur et le type.",
  doublon: "Une rubrique avec ce nom (slug identique) existe déjà.",
  "non-vide": "Cette rubrique contient des articles ou des live-blogs — la vider d'abord.",
};

export default async function AdminRubriques({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    redirect("/admin");
  }
  const isAdmin = session.user.role === "admin";

  const rubriques = await prisma.rubrique.findMany({
    orderBy: { order: "asc" },
    include: {
      _count: { select: { articles: { where: { status: "published" } }, liveBlogs: true } },
    },
  });

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">Rubriques</h1>
      <p className="mb-6 max-w-[70ch] text-[12.5px] text-ink-3">
        Nom, couleur, type et ordre sont modifiables. Le <b>slug</b> (l&apos;adresse) ne l&apos;est pas :
        il porte les URLs publiques, le sitemap et les redirections 301 de l&apos;ancien site.
      </p>

      {erreur && ERREURS[erreur] ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
          {ERREURS[erreur]}
        </p>
      ) : null}

      {isAdmin ? (
        <form
          action={createRubriqueAction}
          className="mb-6 flex flex-wrap items-end gap-3 rounded-[14px] border border-dashed border-line bg-surface-2 p-5"
        >
          <div className="w-full text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Nouvelle rubrique</div>
          <label className="flex min-w-[200px] flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-2">Nom (le slug en découle)</span>
            <input name="name" required maxLength={60} placeholder="Santé" className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-2">Couleur</span>
            <input name="color" type="color" defaultValue="#2E5AAC" className="h-9 w-14 cursor-pointer rounded border border-line bg-surface" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-2">Type</span>
            <select name="kind" defaultValue="gratuit" className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none">
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-[13px] font-bold text-brand-on">
            Créer
          </button>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">
              <th className="px-5 py-3">Ordre</th>
              <th className="px-3 py-3">Rubrique</th>
              <th className="px-3 py-3">Slug</th>
              <th className="px-3 py-3">Couleur</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Articles publiés</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {rubriques.map((r) => (
              <tr key={r.id} className="border-b border-line-2 last:border-b-0">
                <RubriqueRow
                  rubrique={r}
                  count={r._count.articles}
                  deletable={isAdmin && r._count.articles === 0 && r._count.liveBlogs === 0}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RubriqueRow({
  rubrique: r,
  count,
  deletable,
}: {
  rubrique: { id: string; slug: string; name: string; color: string; kind: RubriqueKind; order: number };
  count: number;
  deletable: boolean;
}) {
  const formId = `rub-${r.id}`;
  return (
    <>
      <td className="px-5 py-3">
        <input
          form={formId}
          name="order"
          type="number"
          min={1}
          max={99}
          defaultValue={r.order}
          className="w-14 rounded border border-line bg-bg px-2 py-1 text-[13px]"
        />
      </td>
      <td className="px-3 py-3">
        <input
          form={formId}
          name="name"
          defaultValue={r.name}
          maxLength={60}
          className="w-44 rounded border border-line bg-bg px-2 py-1 text-[13px] font-bold"
        />
      </td>
      <td className="px-3 py-3 font-mono text-[12px] text-ink-3">/{r.slug}</td>
      <td className="px-3 py-3">
        <span className="inline-flex items-center gap-2">
          <input form={formId} name="color" type="color" defaultValue={r.color} className="h-7 w-9 cursor-pointer rounded border border-line bg-bg" />
          <span className="font-mono text-[11px] text-ink-3">{r.color}</span>
        </span>
      </td>
      <td className="px-3 py-3">
        <select form={formId} name="kind" defaultValue={r.kind} className="rounded border border-line bg-bg px-2 py-1 text-[12.5px]">
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3 text-ink-2">{count}</td>
      <td className="px-3 py-3">
        <span className="flex items-center gap-1.5">
          <form id={formId} action={updateRubriqueAction.bind(null, r.id)}>
            <button type="submit" className="rounded-pill bg-brand-fill px-3.5 py-1.5 text-[11.5px] font-bold text-brand-on">
              Enregistrer
            </button>
          </form>
          {deletable ? (
            <form action={deleteRubriqueAction.bind(null, r.id)}>
              <button
                type="submit"
                title="Supprimer (rubrique vide uniquement)"
                className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-red"
              >
                Supprimer
              </button>
            </form>
          ) : null}
        </span>
      </td>
    </>
  );
}
