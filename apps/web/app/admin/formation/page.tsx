import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { auth, PUBLISH_ROLES } from "@/auth";
import { createCourseAction, deleteCourseAction } from "@/lib/actions/admin-content-actions";

export const metadata: Metadata = { title: "A4A Formation · Studio" };
export const dynamic = "force-dynamic";

const LEVELS = ["débutant", "intermédiaire", "avancé"];
const ERREURS: Record<string, string> = {
  "1": "Cours invalide — titre requis.",
  doublon: "Un cours avec ce titre existe déjà.",
  inscrits: "Ce cours a des inscrits — impossible de le supprimer.",
};

export default async function AdminFormation({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const courses = await prisma.course.findMany({
    orderBy: { title: "asc" },
    include: { _count: { select: { lessons: true, enrollments: true } } },
  });

  const inp = "rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]";

  return (
    <div>
      <h1 className="mb-6 text-lg font-bold">A4A Formation</h1>

      {erreur && ERREURS[erreur] ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">{ERREURS[erreur]}</p>
      ) : null}

      <section className="mb-6 rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Nouveau cours</div>
        <form action={createCourseAction} className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Titre<input name="title" required maxLength={120} placeholder="Investir dans la filière cacao" className={inp} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Catégorie<input name="category" placeholder="Économie" className={inp} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Niveau
            <select name="level" className={inp}>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Prix (XOF)<input name="price" type="number" min={0} defaultValue={0} className="w-28 rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]" /></label>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-2"><input name="isPremium" type="checkbox" /> A4A+</label>
          <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">Créer</button>
        </form>
      </section>

      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        {courses.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 border-b border-line-2 px-5 py-3.5 last:border-b-0">
            <div className="min-w-0 flex-1">
              <div className="font-bold">{c.title} {c.isPremium ? <span className="ml-1 rounded bg-[linear-gradient(135deg,#F5C24B,#E8641A)] px-1.5 py-0.5 text-[9px] font-bold text-[#16181D]">A4A+</span> : null}</div>
              <div className="text-[11.5px] text-ink-3">{c.category} · {c.level} · {c.price > 0 ? formatXOF(c.price) : "gratuit"} · {c._count.lessons} leçon(s) · {c._count.enrollments} inscrit(s)</div>
            </div>
            <Link href={`/admin/formation/${c.id}`} className="rounded-pill border border-line bg-surface-2 px-3.5 py-1.5 text-[11.5px] font-semibold text-ink-2">Gérer / leçons</Link>
            <form action={deleteCourseAction.bind(null, c.id)}>
              <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3.5 py-1.5 text-[11.5px] font-semibold text-red">Supprimer</button>
            </form>
          </div>
        ))}
        {courses.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-ink-3">Aucun cours.</p> : null}
      </div>
    </div>
  );
}
