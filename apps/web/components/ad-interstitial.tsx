"use client";

import { useEffect, useState } from "react";

/**
 * Interstitiel mobile plein écran. Affiché au plus une fois par session (plafond
 * de fréquence via sessionStorage), fermable, et ne compte l'impression que
 * lorsqu'il s'affiche réellement — via un beacon POST vers l'API d'impression.
 */
export function AdInterstitial({
  id,
  advertiser,
  headline,
  imageUrl,
  linkUrl,
}: {
  id: string;
  advertiser: string;
  headline: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const cle = "a4a_interstitiel_vu";
    if (sessionStorage.getItem(cle)) return; // déjà servi cette session
    sessionStorage.setItem(cle, "1");
    setOpen(true);
    // Impression comptée à l'affichage réel (fire-and-forget).
    void fetch(`/api/v1/ads/impression/${id}`, { method: "POST", keepalive: true }).catch(() => {});
  }, [id]);

  if (!open) return null;

  const media = imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt={headline ?? advertiser} className="max-h-[70vh] w-full rounded-[12px] object-contain" />
  ) : (
    <div className="rounded-[12px] bg-surface-2 px-6 py-16 text-center">
      <div className="font-serif text-[22px] font-semibold text-ink">{headline ?? advertiser}</div>
      <div className="mt-1 text-[13px] text-ink-3">{advertiser}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[rgba(0,0,0,0.72)] p-4" role="dialog" aria-label="Publicité">
      <div className="relative w-full max-w-[420px]">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="rounded-pill bg-white/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-ink-3">
            Publicité
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-pill bg-white/90 text-[18px] font-bold text-ink shadow"
          >
            ×
          </button>
        </div>
        {linkUrl ? (
          <a href={`/api/v1/ads/click/${id}`} target="_blank" rel="noreferrer sponsored" onClick={() => setOpen(false)}>
            {media}
          </a>
        ) : (
          media
        )}
      </div>
    </div>
  );
}
