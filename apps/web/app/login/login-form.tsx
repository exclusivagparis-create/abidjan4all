"use client";

import { useActionState } from "react";
import { authenticate } from "@/lib/actions/auth-actions";

export function LoginForm({ next }: { next?: string }) {
  const [error, formAction, pending] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="redirectTo" value={next ?? "/admin"} />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-ink-2">Adresse e-mail</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="vous@exemple.com"
          className="rounded-[8px] border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink-3"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-ink-2">Mot de passe</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••••"
          className="rounded-[8px] border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink-3"
        />
      </label>

      {error ? (
        <p className="rounded-[8px] bg-[rgba(214,40,45,0.1)] px-3.5 py-2.5 text-[12.5px] font-semibold text-red">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-pill bg-brand-fill py-3 text-sm font-bold text-brand-on disabled:opacity-60"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
