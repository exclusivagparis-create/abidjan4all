import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import {
  createEpisodeAction,
  deleteEpisodeAction,
  updatePodcastAction,
} from "@/lib/actions/admin-content-actions";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Émission · Studio" };
export const dynamic = "force-dynamic";

export default async function AdminPodcast({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const podcast = await prisma.podcast.findUnique({
    where: { id },
    include: { episodes: { orderBy: { number: "desc" } } },
  });
  if (!podcast) notFound();

  const inp = "rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]";

  return (
    <div>
      <Link href="/admin/podcasts" className="mb-4 inline-flex text-[13px] font-semibold text-ink-3 hover:text-ink">‹ Podcasts</Link>
      <h1 className="mb-5 text-lg font-bold">{podcast.title}</h1>

      {/* Réglages de l'émission */}
      <section className="mb-6 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.06em] text-ink-3">Réglages</h2>
        <form action={updatePodcastAction.bind(null, podcast.id)} className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Titre<input name="title" defaultValue={podcast.title} className={inp} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Catégorie<input name="category" defaultValue={podcast.category} className={inp} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Cadence<input name="cadence" defaultValue={podcast.cadence} className={inp} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Cover (URL, optionnel)<input name="coverUrl" placeholder="https://…" className={inp} /></label>
          <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">Enregistrer</button>
        </form>
      </section>

      {/* Ajouter un épisode */}
      <section className="mb-6 rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Nouvel épisode</div>
        <form action={createEpisodeAction.bind(null, podcast.id)} className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Titre<input name="title" required maxLength={160} className={inp} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Durée (min)<input name="durationMin" type="number" min={1} defaultValue={25} className="w-24 rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]" /></label>
          <label className="grid min-w-[220px] flex-1 gap-1.5 text-xs font-semibold text-ink-2">Audio (URL, optionnel)<input name="audioUrl" placeholder="https://…mp3" className={inp} /></label>
          <label className="grid w-full gap-1.5 text-xs font-semibold text-ink-2">Description<input name="description" maxLength={400} className={inp} /></label>
          <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">Ajouter</button>
        </form>
      </section>

      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        {podcast.episodes.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-3 border-b border-line-2 px-5 py-3 last:border-b-0">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-navy text-[12px] font-bold text-white">{e.number}</span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{e.title}</div>
              <div className="text-[11.5px] text-ink-3">{Math.round(e.durationSec / 60)} min · {formatDate(e.publishedAt)} · {e.audioUrl.startsWith("placeholder://") ? "audio à venir" : "audio en ligne"}</div>
            </div>
            <form action={deleteEpisodeAction.bind(null, e.id, podcast.id)}>
              <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3 py-1 text-[11px] font-semibold text-red">Suppr.</button>
            </form>
          </div>
        ))}
        {podcast.episodes.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-ink-3">Aucun épisode.</p> : null}
      </div>
    </div>
  );
}
