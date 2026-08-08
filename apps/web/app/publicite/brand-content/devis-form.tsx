"use client";

import { useActionState } from "react";
import { demanderDevisAction, type BrandLeadResult } from "@/lib/actions/brand-actions";

const field = "w-full rounded-[8px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-ink-3";
const lbl = "grid gap-1.5 text-xs font-semibold text-ink-2";

export function DevisForm({ offres }: { offres: Array<{ id: string; title: string }> }) {
  const [result, formAction, pending] = useActionState<BrandLeadResult | undefined, FormData>(
    demanderDevisAction,
    undefined
  );

  if (result?.ok) {
    return (
      <div className="rounded-[14px] border border-[#1A6B3C] bg-[rgba(26,107,60,0.06)] px-6 py-7 text-center">
        <p className="font-serif text-[17px] font-semibold text-[#1A6B3C]">Votre demande est bien arrivée.</p>
        <p className="mt-2 text-[14px] text-ink-2">
          Un membre de la régie vous répond sous 48 heures ouvrées avec une proposition chiffrée.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
      {/* Pot de miel : invisible pour un humain, rempli par les robots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={lbl}>
          Société *
          <input name="societe" required maxLength={120} className={field} />
        </label>
        <label className={lbl}>
          Votre nom *
          <input name="contact" required maxLength={120} className={field} />
        </label>
        <label className={lbl}>
          E-mail *
          <input name="email" type="email" required maxLength={160} className={field} />
        </label>
        <label className={lbl}>
          Téléphone
          <input name="tel" maxLength={40} placeholder="+225 …" className={field} />
        </label>
      </div>

      <label className={lbl}>
        Prestation qui vous intéresse
        <select name="offerId" className={field} defaultValue="">
          <option value="">Je ne sais pas encore / autre</option>
          {offres.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </select>
      </label>

      <label className={lbl}>
        Votre projet *
        <textarea
          name="message"
          required
          rows={4}
          maxLength={2000}
          placeholder="Votre objectif, votre calendrier, votre budget indicatif…"
          className={field}
        />
      </label>

      {result && !result.ok ? (
        <p className="rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">{result.error}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-red px-7 py-3 text-[14px] font-bold text-white disabled:opacity-60"
        >
          {pending ? "Envoi…" : "Demander une proposition"}
        </button>
        <span className="text-[11.5px] text-ink-3">Réponse sous 48 h ouvrées · sans engagement</span>
      </div>
    </form>
  );
}
