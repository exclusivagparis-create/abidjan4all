"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createListingAction, type ListingResult } from "@/lib/actions/listing-actions";

const field = "w-full rounded-[8px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-ink-3";
const label = "grid gap-1.5 text-xs font-semibold text-ink-2";

const TYPES: Array<[string, string]> = [
  ["emploi", "Emploi"],
  ["immobilier", "Immobilier"],
  ["service", "Service"],
];

export function ListingForm({ connected }: { connected: boolean }) {
  const [result, action, pending] = useActionState<ListingResult | undefined, FormData>(createListingAction, undefined);

  if (!connected) {
    return (
      <div className="rounded-[14px] border border-line bg-surface-2 p-6 text-center">
        <p className="mb-3 font-serif text-[15px] text-ink-2">Connectez-vous pour déposer une annonce gratuitement.</p>
        <Link href="/login?next=/annonces" className="inline-block rounded-pill bg-red px-5 py-2.5 text-[13px] font-bold text-white">
          Se connecter
        </Link>
      </div>
    );
  }

  if (result?.ok) {
    return (
      <div className="rounded-[14px] border border-line bg-surface p-6 text-center shadow-[var(--shadow-sm)]">
        <p className="font-serif text-lg text-green">✓ Votre annonce a bien été déposée.</p>
        <p className="mt-1 text-[13px] text-ink-3">Elle sera visible après validation par la rédaction.</p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Catégorie
          <select name="type" className={field}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className={label}>Localisation<input name="location" required maxLength={80} placeholder="Abidjan, Cocody" className={field} /></label>
      </div>
      <label className={label}>Titre<input name="title" required maxLength={140} placeholder="Développeur web — CDI" className={field} /></label>
      <label className={label}>Description<textarea name="description" required rows={5} maxLength={4000} className={`${field} resize-y`} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>Prix / salaire en FCFA (optionnel)<input name="price" type="number" min={0} className={field} /></label>
        <label className={label}>Contact (e-mail ou téléphone)<input name="contact" maxLength={120} className={field} /></label>
      </div>
      {result && !result.ok ? <p className="text-[12.5px] font-semibold text-red">{result.error}</p> : null}
      <button type="submit" disabled={pending} className="justify-self-start rounded-pill bg-red px-6 py-2.5 text-[13px] font-bold text-white disabled:opacity-60">
        {pending ? "Envoi…" : "Déposer l'annonce"}
      </button>
    </form>
  );
}
