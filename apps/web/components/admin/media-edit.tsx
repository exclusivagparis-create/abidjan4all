"use client";

import { useActionState, useState } from "react";
import { updateMedia, type MediaResult } from "@/lib/actions/media-actions";

/** Édition d'un média : métadonnées + remplacement optionnel du fichier. */
export function MediaEdit({
  asset,
}: {
  asset: { id: string; alt: string | null; credit: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [result, formAction, pending] = useActionState<MediaResult | undefined, FormData>(
    updateMedia,
    undefined
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-pill border border-line bg-surface-2 px-3 py-1 text-[11px] font-semibold text-ink-2"
      >
        Modifier
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 grid gap-2 rounded-[10px] border border-dashed border-line bg-surface-2 p-3">
      <input type="hidden" name="id" value={asset.id} />
      <label className="grid gap-1 text-[10.5px] font-semibold text-ink-2">
        Texte alternatif
        <input name="alt" defaultValue={asset.alt ?? ""} className="rounded border border-line bg-surface px-2 py-1.5 text-[12px]" />
      </label>
      <label className="grid gap-1 text-[10.5px] font-semibold text-ink-2">
        Crédit
        <input name="credit" defaultValue={asset.credit ?? ""} placeholder="© Photographe" className="rounded border border-line bg-surface px-2 py-1.5 text-[12px]" />
      </label>
      <label className="grid gap-1 text-[10.5px] font-semibold text-ink-2">
        Remplacer le fichier (optionnel)
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,audio/mpeg,video/mp4"
          className="text-[11px] text-ink-2 file:mr-2 file:rounded-pill file:border file:border-line file:bg-surface file:px-3 file:py-1 file:text-[11px] file:font-semibold"
        />
      </label>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="rounded-pill bg-brand-fill px-3.5 py-1.5 text-[11.5px] font-bold text-brand-on disabled:opacity-60">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] font-semibold text-ink-3">
          Fermer
        </button>
      </div>
      {result && !result.ok ? <p className="text-[11.5px] font-semibold text-red">{result.error}</p> : null}
      {result?.ok ? <p className="text-[11.5px] font-semibold text-green">Média mis à jour.</p> : null}
    </form>
  );
}
