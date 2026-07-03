"use client";

import { useActionState } from "react";
import { addLiveUpdate, type LiveResult } from "@/lib/actions/live-actions";

const TYPES = [
  { value: "text", label: "Texte" },
  { value: "quote", label: "Citation" },
  { value: "stat", label: "Chiffre clé" },
  { value: "media", label: "Média" },
];

export function LiveComposer({ liveBlogId, disabled }: { liveBlogId: string; disabled: boolean }) {
  const [result, formAction, pending] = useActionState<LiveResult | undefined, FormData>(
    addLiveUpdate.bind(null, liveBlogId),
    undefined
  );

  const inputCls =
    "w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-ink-3";

  return (
    <form
      action={formAction}
      className={`rounded-[14px] border border-line bg-surface-2 p-5 ${disabled ? "opacity-60" : ""}`}
    >
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">
        Poster une mise à jour
      </div>
      <div className="mb-3 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Type</span>
          <select name="type" defaultValue="text" disabled={disabled} className={inputCls}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Titre (optionnel — la valeur pour un chiffre clé)</span>
          <input name="title" disabled={disabled} placeholder="Objectif relevé à 50 % / « 4 015 $ »" className={inputCls} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-ink-2">Contenu</span>
        <textarea
          name="body"
          required
          rows={3}
          disabled={disabled}
          placeholder="Le directeur général confirme…"
          className={`${inputCls} resize-y font-serif text-[15px]`}
        />
      </label>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-2">
          <input type="checkbox" name="pinned" disabled={disabled} className="h-4 w-4 accent-[var(--navy)]" />
          📌 Épingler dans les faits clés
        </label>
        <button
          type="submit"
          disabled={pending || disabled}
          className="rounded-pill bg-brand-fill px-5 py-2.5 text-[13px] font-bold text-brand-on disabled:opacity-60"
        >
          {pending ? "Publication…" : "Publier la mise à jour"}
        </button>
      </div>
      {result && !result.ok ? <p className="mt-3 text-[12.5px] font-semibold text-red">{result.error}</p> : null}
      {result?.ok ? (
        <p className="mt-3 text-[12.5px] font-semibold text-green">
          Publiée — visible dans le flux public en quelques secondes.
        </p>
      ) : null}
    </form>
  );
}
