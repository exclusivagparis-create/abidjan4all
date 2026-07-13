import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { auth, PUBLISH_ROLES } from "@/auth";
import {
  createLessonAction,
  deleteLessonAction,
  updateCourseAction,
} from "@/lib/actions/admin-content-actions";

export const metadata: Metadata = { title: "Cours · Studio" };
export const dynamic = "force-dynamic";

const LEVELS = ["débutant", "intermédiaire", "avancé"];

export default async function AdminCourse({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const course = await prisma.course.findUnique({
    where: { id },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  if (!course) notFound();

  const inp = "rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]";

  return (
    <div>
      <Link href="/admin/formation" className="mb-4 inline-flex text-[13px] font-semibold text-ink-3 hover:text-ink">‹ Formation</Link>
      <h1 className="mb-5 text-lg font-bold">{course.title}</h1>

      <section className="mb-6 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.06em] text-ink-3">Réglages du cours</h2>
        <form action={updateCourseAction.bind(null, course.id)} className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Titre<input name="title" defaultValue={course.title} className={inp} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Catégorie<input name="category" defaultValue={course.category} className={inp} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Niveau
            <select name="level" defaultValue={course.level} className={inp}>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Prix (XOF)<input name="price" type="number" min={0} defaultValue={course.price} className="w-28 rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]" /></label>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-2"><input name="isPremium" type="checkbox" defaultChecked={course.isPremium} /> A4A+</label>
          <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">Enregistrer</button>
        </form>
        <p className="mt-3 text-[11.5px] text-ink-3">Prix actuel : {course.price > 0 ? formatXOF(course.price) : "gratuit"}</p>
      </section>

      <section className="mb-6 rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Nouvelle leçon</div>
        <form action={createLessonAction.bind(null, course.id)} className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Titre<input name="title" required maxLength={160} className={inp} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Module<input name="module" placeholder="Module 1" className={inp} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Durée (min)<input name="durationMin" type="number" min={1} defaultValue={8} className="w-24 rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]" /></label>
          <label className="grid min-w-[220px] flex-1 gap-1.5 text-xs font-semibold text-ink-2">Vidéo (URL, optionnel)<input name="videoUrl" placeholder="https://…" className={inp} /></label>
          <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">Ajouter</button>
        </form>
      </section>

      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        {course.lessons.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-3 border-b border-line-2 px-5 py-3 last:border-b-0">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-navy text-[12px] font-bold text-white">{l.order}</span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{l.title}</div>
              <div className="text-[11.5px] text-ink-3">{l.module} · {Math.round(l.durationSec / 60)} min · {l.videoUrl ? "vidéo" : "sans vidéo"}</div>
            </div>
            <form action={deleteLessonAction.bind(null, l.id, course.id)}>
              <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3 py-1 text-[11px] font-semibold text-red">Suppr.</button>
            </form>
          </div>
        ))}
        {course.lessons.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-ink-3">Aucune leçon.</p> : null}
      </div>
    </div>
  );
}
