"use client";

import { useActionState } from "react";
import { submitContactAction, type ContactResult } from "@/lib/actions/contact-actions";

const field = "w-full rounded-[8px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-ink-3";
const label = "grid gap-1.5 text-xs font-semibold text-ink-2";

export function ContactForm() {
  const [result, action, pending] = useActionState<ContactResult | undefined, FormData>(submitContactAction, undefined);

  if (result?.ok) {
    return (
      <div className="rounded-[14px] border border-line bg-surface p-6 text-center shadow-[var(--shadow-sm)]">
        <p className="font-serif text-lg text-green">✓ Merci, votre message a bien été envoyé.</p>
        <p className="mt-1 text-[13px] text-ink-3">La rédaction vous répondra sous 48 heures ouvrées.</p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
      {/* pot de miel anti-spam (masqué) */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>Nom<input name="name" required maxLength={80} className={field} /></label>
        <label className={label}>E-mail<input name="email" type="email" required className={field} /></label>
      </div>
      <label className={label}>Objet<input name="subject" required maxLength={140} className={field} /></label>
      <label className={label}>Message<textarea name="body" required rows={6} maxLength={4000} className={`${field} resize-y`} /></label>
      {result && !result.ok ? <p className="text-[12.5px] font-semibold text-red">{result.error}</p> : null}
      <button type="submit" disabled={pending} className="justify-self-start rounded-pill bg-red px-6 py-2.5 text-[13px] font-bold text-white disabled:opacity-60">
        {pending ? "Envoi…" : "Envoyer le message"}
      </button>
    </form>
  );
}
