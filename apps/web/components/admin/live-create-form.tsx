"use client";

import { useActionState } from "react";
import { createLiveBlog, type LiveResult } from "@/lib/actions/live-actions";

export function LiveCreateForm({ rubriques }: { rubriques: { id: string; name: string }[] }) {
  const [result, formAction, pending] = useActionState<LiveResult | undefined, FormData>(
    createLiveBlog,
    undefined
  );

  const inputCls =
    "rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-ink-3";

  return (
    <form action={formAction} className="mb-6 rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Ouvrir un direct</div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Titre de l&apos;événement</span>
          <input name="title" required placeholder="Conseil Café-Cacao : conférence de presse…" className={inputCls} />
        </label>
        <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Chapeau (optionnel)</span>
          <input name="dek" placeholder="Suivi minute par minute…" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Rubrique</span>
          <select name="rubriqueId" required defaultValue="" className={inputCls}>
            <option value="" disabled>
              Choisir…
            </option>
            {rubriques.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-red px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {pending ? "Ouverture…" : "● Ouvrir le direct"}
        </button>
      </div>
      {result && !result.ok ? <p className="mt-3 text-[12.5px] font-semibold text-red">{result.error}</p> : null}
    </form>
  );
}
