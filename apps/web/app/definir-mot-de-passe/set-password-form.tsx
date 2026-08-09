"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setPasswordWithTokenAction, type SetPasswordResult } from "@/lib/actions/set-password-actions";
import { PasswordField } from "@/components/password-field";

// Habillage du champ, avec la place réservée au bouton œil à droite.
const field =
  "w-full rounded-[8px] border border-line bg-bg py-2.5 pl-3.5 pr-11 text-[14px] text-ink outline-none focus:border-ink-3";

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
      <PasswordField
        name="next"
        label="Nouveau mot de passe"
        autoComplete="new-password"
        minLength={8}
        hint="8 caractères minimum."
        className={field}
      />
      <PasswordField
        name="confirm"
        label="Confirmer le mot de passe"
        autoComplete="new-password"
        minLength={8}
        className={field}
      />
      {result && !result.ok ? <p className="text-[12.5px] font-semibold text-red">{result.error}</p> : null}
      <button type="submit" disabled={pending} className="justify-self-start rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on disabled:opacity-60">
        {pending ? "Enregistrement…" : "Définir mon mot de passe"}
      </button>
    </form>
  );
}
