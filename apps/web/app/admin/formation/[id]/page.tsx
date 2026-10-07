import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { auth, PUBLISH_ROLES } from "@/auth";
import { exigerRole } from "@/lib/garde-role";
import {
  createLessonAction,
  deleteLessonAction,
  updateCourseAction,
} from "@/lib/actions/admin-content-actions";
import { addLessonResourceAction, removeLessonResourceAction } from "@/lib/actions/formation-fichiers-actions";
import { formatTaille, ressourcesDe } from "@/lib/formation-ressources";

export const metadata: Metadata = { title: "Cours · Studio" };
export const dynamic = "force-dynamic";

const LEVELS = ["débutant", "intermédiaire", "avancé"];

export default async function AdminCourse({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, auth()]);
  if (!(await exigerRole(PUBLISH_ROLES))) redirect("/admin");

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
        {course.lessons.map((l) => {
          const fichiers = ressourcesDe(l.resources);
          return (
            <div key={l.id} className="border-b border-line-2 px-5 py-3 last:border-b-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-navy text-[12px] font-bold text-white">{l.order}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{l.title}</div>
                  <div className="text-[11.5px] text-ink-3">
                    {l.module} · {Math.round(l.durationSec / 60)} min · {l.videoUrl ? "vidéo" : "sans vidéo"}
                    {fichiers.length > 0 ? ` · ${fichiers.length} fichier${fichiers.length > 1 ? "s" : ""}` : ""}
                  </div>
                </div>
                <form action={deleteLessonAction.bind(null, l.id, course.id)}>
                  <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3 py-1 text-[11px] font-semibold text-red">Suppr.</button>
                </form>
              </div>

              {/* Documents de la leçon : support de cours, modèle, exercice.
                  Ils ne sortent que par la route qui vérifie l'inscription —
                  leur adresse n'est donc jamais partageable telle quelle. */}
              <div className="mt-2.5 pl-11">
                {fichiers.length > 0 ? (
                  <ul className="mb-2 grid gap-1.5">
                    {fichiers.map((f) => (
                      <li key={f.url} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-ink-3">{f.label}</span>
                        <span className="font-semibold">{f.nom}</span>
                        <span className="text-ink-3">{formatTaille(f.taille)}</span>
                        <form action={removeLessonResourceAction.bind(null, l.id, course.id, f.url)}>
                          <button type="submit" className="text-[11.5px] font-semibold text-red hover:underline">retirer</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <form action={addLessonResourceAction.bind(null, l.id, course.id)} className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    name="fichier"
                    required
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.zip"
                    className="text-[12px] text-ink-2 file:mr-2 file:rounded-pill file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-[11.5px] file:font-semibold file:text-ink"
                  />
                  <input name="nom" maxLength={120} placeholder="Nom affiché (optionnel)" className="rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[12px]" />
                  <button type="submit" className="rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-[11.5px] font-bold text-ink">
                    Joindre
                  </button>
                </form>
              </div>
            </div>
          );
        })}
        {course.lessons.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-ink-3">Aucune leçon.</p> : null}
      </div>
    </div>
  );
}
