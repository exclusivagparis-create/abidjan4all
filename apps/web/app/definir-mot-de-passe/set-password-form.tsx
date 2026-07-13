"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setPasswordWithTokenAction, type SetPasswordResult } from "@/lib/actions/set-password-actions";

const field = "rounded-[8px] border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-ink-3";

export function SetPasswordForm({ token }: { token: string }) {
  const [result, action, pending] = useActionState<SetPasswordResult | undefined, FormData>(
    setPasswordWithTokenAction,
    undefined
  );

  if (result?.ok) {
    return (
      <div className="rounded-[14px] border border-line bg-surface p-6 text-center shadow-[var(--shadow-sm)]">
        <p className="mb-4 font-serif text-lg text-green">✓ Votre mot de passe est défini.</p>
        <Link href="/login" className="inline-block rounded-pill bg-red px-6 py-2.5 text-sm font-bold text-white">
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
      <input type="hidden" name="token" value={token} />
      <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
        Nouveau mot de passe (8 caractères min.)
        <input name="next" type="password" required minLength={8} autoComplete="new-password" className={field} />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
        Confirmer le mot de passe
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={field} />
      </label>
      {result && !result.ok ? <p className="text-[12.5px] font-semibold text-red">{result.error}</p> : null}
      <button type="submit" disabled={pending} className="justify-self-start rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on disabled:opacity-60">
        {pending ? "Enregistrement…" : "Définir mon mot de passe"}
      </button>
    </form>
  );
}
