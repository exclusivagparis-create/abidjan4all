import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type RubriqueKind } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { updateRubriqueAction } from "@/lib/actions/rubrique-actions";

export const metadata: Metadata = { title: "Rubriques · Studio" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<RubriqueKind, string> = {
  gratuit: "Gratuit",
  premium: "Premium",
  freemium: "Freemium",
  affiliation: "Affiliation",
};
const KINDS = Object.keys(KIND_LABEL) as RubriqueKind[];

export default async function AdminRubriques() {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    redirect("/admin");
  }

  const rubriques = await prisma.rubrique.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { articles: { where: { status: "published" } } } } },
  });

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">Rubriques</h1>
      <p className="mb-6 max-w-[70ch] text-[12.5px] text-ink-3">
        Nom, couleur, type et ordre sont modifiables. Le <b>slug</b> (l&apos;adresse) ne l&apos;est pas :
        il porte les URLs publiques, le sitemap et les redirections 301 de l&apos;ancien site.
      </p>

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
                <RubriqueRow rubrique={r} count={r._count.articles} />
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
}: {
  rubrique: { id: string; slug: string; name: string; color: string; kind: RubriqueKind; order: number };
  count: number;
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
        <form id={formId} action={updateRubriqueAction.bind(null, r.id)}>
          <button type="submit" className="rounded-pill bg-brand-fill px-3.5 py-1.5 text-[11.5px] font-bold text-brand-on">
            Enregistrer
          </button>
        </form>
      </td>
    </>
  );
}
