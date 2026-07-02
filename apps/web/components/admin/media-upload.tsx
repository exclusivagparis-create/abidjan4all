"use client";

import { useActionState } from "react";
import { uploadMedia, type MediaResult } from "@/lib/actions/media-actions";

export function MediaUpload() {
  const [result, formAction, pending] = useActionState<MediaResult | undefined, FormData>(
    uploadMedia,
    undefined
  );

  return (
    <form
      action={formAction}
      className="mb-6 rounded-[14px] border border-dashed border-line bg-surface-2 p-5"
    >
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">
        Ajouter un média — JPG/WebP 1600×900 recommandé, 8 Mo max
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Fichier</span>
          <input
            type="file"
            name="file"
            required
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,audio/mpeg,video/mp4"
            className="text-[12.5px] text-ink-2 file:mr-3 file:rounded-pill file:border file:border-line file:bg-surface file:px-4 file:py-2 file:text-xs file:font-semibold file:text-ink"
          />
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Texte alternatif (accessibilité)</span>
          <input
            name="alt"
            placeholder="Description du visuel"
            className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none"
          />
        </label>
        <label className="flex min-w-[140px] flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Crédit</span>
          <input
            name="credit"
            placeholder="© Photographe"
            className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-brand-fill px-5 py-2.5 text-[13px] font-bold text-brand-on disabled:opacity-60"
        >
          {pending ? "Envoi…" : "Téléverser"}
        </button>
      </div>
      {result && !result.ok ? (
        <p className="mt-3 text-[12.5px] font-semibold text-red">{result.error}</p>
      ) : null}
      {result?.ok ? (
        <p className="mt-3 text-[12.5px] font-semibold text-green">Média ajouté à la bibliothèque.</p>
      ) : null}
    </form>
  );
}
