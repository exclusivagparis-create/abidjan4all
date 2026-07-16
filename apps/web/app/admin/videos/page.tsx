import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import {
  createVideoAction,
  deleteVideoAction,
  toggleVideoLiveAction,
  toggleVideoPublishedAction,
  updateVideoAction,
} from "@/lib/actions/video-actions";
import { PROVIDER_LABEL, thumbnailUrl, type VideoProvider } from "@/lib/video";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Vidéos · Studio" };
export const dynamic = "force-dynamic";

const ERREURS: Record<string, string> = {
  titre: "Le titre est obligatoire.",
  url: "Lien non reconnu. Collez l'adresse d'une vidéo YouTube, Facebook, Vimeo ou Dailymotion (pas un code d'intégration).",
};

export default async function AdminVideos({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const videos = await prisma.video.findMany({ orderBy: [{ live: "desc" }, { publishedAt: "desc" }] });
  const inp = "rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]";
  const btn = "rounded-pill border border-line bg-surface px-3 py-1 text-[11px] font-semibold text-ink-2 hover:text-ink";

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">Vidéos</h1>
      <p className="mb-6 max-w-[75ch] text-[12.5px] text-ink-3">
        Les vidéos de la rubrique <strong>Vidéos</strong> — publiées sur la page d&apos;accueil et sur{" "}
        <code>/videos</code>. Collez le <strong>lien</strong> d&apos;une vidéo ou d&apos;un direct YouTube, Facebook,
        Vimeo ou Dailymotion : l&apos;hébergement, la qualité et le direct sont assurés par la plateforme. Un seul
        direct peut être à l&apos;antenne à la fois.
      </p>

      {erreur && ERREURS[erreur] ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">{ERREURS[erreur]}</p>
      ) : null}

      <section className="mb-6 rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Nouvelle vidéo</div>
        <form action={createVideoAction} className="grid gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="grid flex-1 gap-1.5 text-xs font-semibold text-ink-2">
              Titre
              <input name="title" required placeholder="CAN 2027 : le résumé du match" className={inp} />
            </label>
            <label className="grid flex-1 gap-1.5 text-xs font-semibold text-ink-2">
              Lien de la vidéo
              <input name="sourceUrl" required placeholder="https://www.youtube.com/watch?v=..." className={inp} />
            </label>
          </div>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
            Description (facultative)
            <input name="description" placeholder="Une phrase de contexte" className={inp} />
          </label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-ink-2">
              <input type="checkbox" name="live" /> C&apos;est un direct
            </label>
            <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">
              Ajouter
            </button>
          </div>
        </form>
      </section>

      <div className="grid gap-3">
        {videos.map((v) => {
          const vignette = thumbnailUrl(v.provider, v.providerRef);
          return (
            <div key={v.id} className="rounded-[14px] border border-line bg-surface p-4 shadow-[var(--shadow-sm)]">
              <div className="mb-3 flex items-start gap-4">
                {vignette ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={vignette} alt="" className="h-[68px] w-[120px] flex-none rounded-[8px] object-cover" />
                ) : (
                  <div className="flex h-[68px] w-[120px] flex-none items-center justify-center rounded-[8px] bg-surface-2 text-[10px] font-bold uppercase text-ink-3">
                    {PROVIDER_LABEL[v.provider as VideoProvider] ?? v.provider}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {v.live ? (
                      <span className="rounded-pill bg-red px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
                        En direct
                      </span>
                    ) : null}
                    {!v.published ? (
                      <span className="rounded-pill border border-line px-2 py-0.5 text-[10px] font-bold uppercase text-ink-3">
                        Hors antenne
                      </span>
                    ) : null}
                    <span className="text-[11px] text-ink-3">
                      {PROVIDER_LABEL[v.provider as VideoProvider] ?? v.provider} · {formatDate(v.publishedAt)}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-serif text-[17px] font-semibold">{v.title}</div>
                  <a
                    href={v.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-[11.5px] text-ink-3 underline"
                  >
                    {v.sourceUrl}
                  </a>
                </div>
                <div className="flex flex-none gap-2">
                  <form action={toggleVideoLiveAction.bind(null, v.id)}>
                    <button type="submit" className={btn}>{v.live ? "Arrêter le direct" : "Passer en direct"}</button>
                  </form>
                  <form action={toggleVideoPublishedAction.bind(null, v.id)}>
                    <button type="submit" className={btn}>{v.published ? "Retirer" : "Diffuser"}</button>
                  </form>
                  <form action={deleteVideoAction.bind(null, v.id)}>
                    <button
                      type="submit"
                      className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3 py-1 text-[11px] font-semibold text-red"
                    >
                      Suppr.
                    </button>
                  </form>
                </div>
              </div>

              <details>
                <summary className="cursor-pointer text-[11.5px] font-semibold text-ink-3">Modifier</summary>
                <form action={updateVideoAction.bind(null, v.id)} className="mt-3 grid gap-3">
                  <div className="flex flex-wrap gap-3">
                    <label className="grid flex-1 gap-1.5 text-xs font-semibold text-ink-2">
                      Titre
                      <input name="title" defaultValue={v.title} required className={inp} />
                    </label>
                    <label className="grid flex-1 gap-1.5 text-xs font-semibold text-ink-2">
                      Lien
                      <input name="sourceUrl" defaultValue={v.sourceUrl} required className={inp} />
                    </label>
                  </div>
                  <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
                    Description
                    <input name="description" defaultValue={v.description ?? ""} className={inp} />
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs font-semibold text-ink-2">
                      <input type="checkbox" name="live" defaultChecked={v.live} /> C&apos;est un direct
                    </label>
                    <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2 text-xs font-bold text-brand-on">
                      Enregistrer
                    </button>
                  </div>
                </form>
              </details>
            </div>
          );
        })}
        {videos.length === 0 ? (
          <p className="rounded-[14px] border border-line bg-surface px-5 py-10 text-center text-[13px] text-ink-3">
            Aucune vidéo. La fenêtre vidéo de l&apos;accueil n&apos;apparaîtra qu&apos;une fois la première ajoutée.
          </p>
        ) : null}
      </div>
    </div>
  );
}
