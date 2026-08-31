import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { LiveComposer } from "@/components/admin/live-composer";
import { LiveEntete } from "@/components/admin/live-entete";
import { LiveFil, type LigneFil } from "@/components/admin/live-fil";
import { setLiveBlogStatus } from "@/lib/actions/live-actions";
import { auth, PUBLISH_ROLES } from "@/auth";

export const metadata: Metadata = { title: "Direct · Studio" };
export const dynamic = "force-dynamic";

export default async function AdminLiveDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const blog = await prisma.liveBlog.findUnique({
    where: { id },
    include: { rubrique: { select: { name: true, color: true } } },
  });
  if (!blog) notFound();

  const [session, rubriques] = await Promise.all([
    auth(),
    prisma.rubrique.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);
  const peutSupprimer = PUBLISH_ROLES.includes(session?.user?.role as (typeof PUBLISH_ROLES)[number]);

  const updates = await prisma.liveUpdate.findMany({
    where: { liveBlogId: id },
    orderBy: { time: "desc" },
    take: 50,
  });

  const isLive = blog.status === "live";
  const toggleStatus = async () => {
    "use server";
    await setLiveBlogStatus(id, isLive ? "ended" : "live");
  };

  return (
    <div>
      <Link href="/admin/live" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-ink-3 hover:text-ink">
        ‹ Retour aux directs
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-[26px] font-medium leading-tight">{blog.title}</h1>
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-red px-2.5 py-1 text-[10px] font-extrabold uppercase text-white">
            <span className="h-1.5 w-1.5 rounded-pill bg-white [animation:a4a-pulse_1.4s_infinite]" />
            Live
          </span>
        ) : (
          <span className="rounded-pill bg-surface-3 px-2.5 py-1 text-[10px] font-extrabold uppercase text-ink-3">
            Terminé
          </span>
        )}
        <span className="text-xs text-ink-3">{blog.updatesCount} mises à jour</span>
        <span className="flex-1" />
        <Link
          href={`/en-direct/${blog.id}`}
          className="rounded-pill border border-line bg-surface px-4 py-2 text-xs font-semibold"
        >
          Voir côté public ↗
        </Link>
        <form action={toggleStatus}>
          <button
            type="submit"
            className={`rounded-pill px-4 py-2 text-xs font-bold ${
              isLive ? "bg-navy text-white" : "bg-green text-white"
            }`}
          >
            {isLive ? "Clôturer le direct" : "Rouvrir le direct"}
          </button>
        </form>
      </div>

      <LiveEntete
        id={blog.id}
        titre={blog.title}
        chapeau={blog.dek ?? ""}
        rubriqueId={blog.rubriqueId}
        rubriques={rubriques}
        peutSupprimer={peutSupprimer}
        nombreDeMisesAJour={blog.updatesCount}
      />

      <LiveComposer liveBlogId={blog.id} disabled={!isLive} />

      {/* Mise en forme côté serveur : le composant du fil ne s'occupe que de
          l'affichage et des actions, pas du fuseau ni du format d'heure. */}
      <LiveFil
        lignes={updates.map<LigneFil>((u) => ({
          id: u.id,
          heure: `${u.time.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          })} GMT`,
          type: u.type,
          titre: u.title,
          corps: u.body,
          epinglee: u.pinned,
        }))}
      />
    </div>
  );
}
