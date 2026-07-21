"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createListingAction, type ListingResult } from "@/lib/actions/listing-actions";
import { TARIFS_EMPLOI, TARIFS_IMMO, formatFCFA, type PalierAnnonce } from "@/lib/tarifs";

const field = "w-full rounded-[8px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-ink-3";
const label = "grid gap-1.5 text-xs font-semibold text-ink-2";

const TYPES: Array<[string, string]> = [
  ["emploi", "Emploi"],
  ["immobilier", "Immobilier"],
  ["service", "Service"],
];

const METHODES: Array<[string, string]> = [
  ["momo", "MTN MoMo"],
  ["orange", "Orange Money"],
  ["wave", "Wave"],
  ["moov", "Moov Money"],
  ["djamo", "Djamo"],
  ["card", "Carte bancaire"],
  ["paypal", "PayPal"],
];

const GRILLES: Record<string, PalierAnnonce[]> = { emploi: TARIFS_EMPLOI, immobilier: TARIFS_IMMO };

export function ListingForm({ connected }: { connected: boolean }) {
  const [result, action, pending] = useActionState<ListingResult | undefined, FormData>(createListingAction, undefined);
  const [type, setType] = useState("emploi");
  const grille = GRILLES[type]; // défini ⇒ catégorie payante
  const [tier, setTier] = useState<string>(TARIFS_EMPLOI[0]!.id);

  if (!connected) {
    return (
      <div className="rounded-[14px] border border-line bg-surface-2 p-6 text-center">
        <p className="mb-3 font-serif text-[15px] text-ink-2">Connectez-vous pour déposer une annonce.</p>
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

  function onType(v: string) {
    setType(v);
    const g = GRILLES[v];
    if (g) setTier(g[0]!.id);
  }

  return (
    <form action={action} className="grid gap-4 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Catégorie
          <select name="type" value={type} onChange={(e) => onType(e.target.value)} className={field}>
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

      {grille ? (
        <>
          <fieldset className="grid gap-2 border-t border-line-2 pt-4">
            <legend className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Formule de publication</legend>
            {grille.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-2.5 ${tier === p.id ? "border-red bg-[rgba(214,40,45,0.05)]" : "border-line"}`}
              >
                <input type="radio" name="tier" value={p.id} checked={tier === p.id} onChange={() => setTier(p.id)} className="h-4 w-4" />
                <span className="flex-1">
                  <span className="text-[14px] font-bold">{p.label}</span>
                  <span className="block text-[12px] text-ink-3">{p.description}</span>
                </span>
                <span className="font-serif text-[16px] font-bold text-red">{formatFCFA(p.prix)}</span>
              </label>
            ))}
          </fieldset>
          <label className={label}>
            Moyen de paiement
            <select name="method" className={field}>
              {METHODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </>
      ) : (
        <p className="rounded-[8px] bg-surface-2 px-4 py-2.5 text-[12.5px] text-ink-3">
          Les annonces de services sont <span className="font-semibold">gratuites</span> et publiées après validation.
        </p>
      )}

      {result && !result.ok ? <p className="text-[12.5px] font-semibold text-red">{result.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="justify-self-start rounded-pill bg-red px-6 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {pending ? "Envoi…" : grille ? "Payer et publier" : "Déposer l'annonce"}
      </button>
    </form>
  );
}
