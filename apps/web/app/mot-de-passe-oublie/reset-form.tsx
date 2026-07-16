"use client";

import { useActionState } from "react";
import { requestPasswordResetAction, type ResetResult } from "@/lib/actions/register-actions";

export function ResetForm() {
  const [state, action, pending] = useActionState<ResetResult | undefined, FormData>(
    requestPasswordResetAction,
    undefined
  );

  if (state?.ok) {
    return (
      <div className="rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
        <h2 className="mb-2 font-serif text-[20px] font-semibold">Regardez votre boîte mail</h2>
        <p className="font-serif text-[15px] leading-[1.5] text-ink-2">
          Si un compte existe avec cette adresse, un lien de réinitialisation vient d&apos;être envoyé. Il est valable
          2 heures et ne fonctionne qu&apos;une seule fois.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      {state?.ok === false ? (
        <p className="rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
          {state.error}
        </p>
      ) : null}
      <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
        Adresse e-mail
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-ink-3"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-pill bg-red py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {pending ? "Envoi…" : "Recevoir un lien"}
      </button>
    </form>
  );
}
