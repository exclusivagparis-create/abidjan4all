import Link from "next/link";
import { VideoPlayer } from "@/components/video-player";
import { thumbnailUrl } from "@/lib/video";

export type VideoItem = {
  id: string;
  title: string;
  provider: string;
  providerRef: string;
  live: boolean;
};

/**
 * Fenêtre vidéo du rail de l'accueil : le direct s'il y en a un, sinon la
 * dernière vidéo, puis l'historique des suivantes. Rien n'est rendu si la
 * rédaction n'a encore publié aucune vidéo.
 */
export function VideoWindow({ videos }: { videos: VideoItem[] }) {
  const [une, ...historique] = videos;
  if (!une) return null;

  return (
    // flex-1 + min-h-0 : la fenêtre occupe exactement le vide laissé entre les
    // articles du rail et « Les plus lus », au lieu d'allonger la hauteur du
    // hero — ce qui creuserait un blanc sous le grand article à gauche.
    <section className="mb-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-line bg-surface">
      <div className="flex flex-none items-center gap-2 border-b border-line bg-navy px-4 py-2">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-white">Vidéos</span>
        {une.live ? (
          <span className="flex items-center gap-1.5 rounded-pill bg-red px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-white">
            <span className="h-1.5 w-1.5 rounded-pill bg-white" />
            En direct
          </span>
        ) : null}
        <Link href="/videos" className="ml-auto text-[11px] font-semibold text-[#F5C24B] hover:underline">
          Tout voir ›
        </Link>
      </div>

      <VideoPlayer
        provider={une.provider}
        providerRef={une.providerRef}
        title={une.title}
        className="aspect-video w-full flex-none"
      />

      <div className="flex-none px-4 py-2.5">
        <Link href="/videos" className="line-clamp-2 font-serif text-[14.5px] font-semibold leading-[1.2] hover:underline">
          {une.title}
        </Link>
      </div>

      {historique.length > 0 ? (
        // Hauteur plafonnée et liste défilante : sans cela, chaque vidéo
        // ajoutée allonge le rail et creuse un blanc sous le grand article.
        <div className="min-h-0 max-h-[104px] flex-1 overflow-y-auto border-t border-line-2 px-4 pb-2 pt-2">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-3">Historique vidéo</div>
          {historique.map((v) => {
            const vignette = thumbnailUrl(v.provider, v.providerRef);
            return (
              <Link
                key={v.id}
                href="/videos"
                className="flex items-center gap-2.5 border-b border-line-2 py-2 last:border-b-0 hover:opacity-80"
              >
                {vignette ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={vignette} alt="" className="h-[34px] w-[60px] flex-none rounded-[4px] object-cover" />
                ) : (
                  <span className="flex h-[34px] w-[60px] flex-none items-center justify-center rounded-[4px] bg-surface-2 text-[13px] text-ink-3">
                    ▶
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-serif text-[12.5px] font-semibold leading-[1.25]">{v.title}</span>
                </span>
                {v.live ? (
                  <span className="flex-none rounded-pill bg-red px-1.5 py-[1px] text-[8.5px] font-extrabold uppercase text-white">
                    Live
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
