import { embedUrl } from "@/lib/video";

/**
 * Lecteur intégré. La source est reconstruite par embedUrl() à partir du
 * couple (provider, providerRef) validé — aucun HTML fourni par la rédaction
 * n'est injecté ici.
 */
export function VideoPlayer({
  provider,
  providerRef,
  title,
  className = "",
  videoId,
}: {
  provider: string;
  providerRef: string;
  title: string;
  className?: string;
  /** Identifiant de la vidéo, quand sa lecture doit être comptée. */
  videoId?: string;
}) {
  const src = embedUrl(provider, providerRef);
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-surface-2 text-[12px] text-ink-3 ${className}`}>
        Vidéo indisponible
      </div>
    );
  }
  return (
    <iframe
      src={src}
      title={title}
      // Repère lu par le compteur de vues : le départ du focus vers CETTE
      // iframe signale qu'on a cliqué dedans, donc lancé la lecture.
      data-video-id={videoId}
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      className={`border-0 ${className}`}
    />
  );
}
