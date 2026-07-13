import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { createPodcastAction, deletePodcastAction } from "@/lib/actions/admin-content-actions";

export const metadata: Metadata = { title: "Podcasts · Studio" };
export const dynamic = "force-dynamic";

const ERREURS: Record<string, string> = {
  "1": "Émission invalide — titre requis.",
  doublon: "Une émission avec ce titre existe déjà.",
};

export default async function AdminPodcasts({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const podcasts = await prisma.podcast.findMany({
    orderBy: { title: "asc" },
    include: { _count: { select: { episodes: true } } },
  });

  return (
    <div>
      <h1 className="mb-6 text-lg font-bold">Podcasts</h1>

      {erreur && ERREURS[erreur] ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">{ERREURS[erreur]}</p>
      ) : null}

      <section className="mb-6 rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Nouvelle émission</div>
        <form action={createPodcastAction} className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
            Titre
            <input name="title" required maxLength={120} placeholder="Abidjan Décodé" className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
            Catégorie
            <input name="category" placeholder="Actualité" className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
            Cadence
            <input name="cadence" placeholder="hebdomadaire" className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]" />
          </label>
          <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">Créer</button>
        </form>
      </section>

      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        {podcasts.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-line-2 px-5 py-3.5 last:border-b-0">
            <div className="min-w-0 flex-1">
              <div className="font-bold">{p.title}</div>
              <div className="text-[11.5px] text-ink-3">{p.category} · {p.cadence} · {p._count.episodes} épisode(s)</div>
            </div>
            <Link href={`/admin/podcasts/${p.id}`} className="rounded-pill border border-line bg-surface-2 px-3.5 py-1.5 text-[11.5px] font-semibold text-ink-2">
              Gérer / épisodes
            </Link>
            <form action={deletePodcastAction.bind(null, p.id)}>
              <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3.5 py-1.5 text-[11.5px] font-semibold text-red">Supprimer</button>
            </form>
          </div>
        ))}
        {podcasts.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-ink-3">Aucune émission.</p> : null}
      </div>
    </div>
  );
}
