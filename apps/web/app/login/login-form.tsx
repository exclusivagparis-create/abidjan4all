"use client";

import { useActionState } from "react";
import Link from "next/link";
import { authenticate } from "@/lib/actions/auth-actions";
import { PasswordField } from "@/components/password-field";

export function LoginForm({ next }: { next?: string }) {
  const [error, formAction, pending] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* Défaut : l'espace membre, accessible à tous les rôles. Viser /admin
          enfermait un simple membre dans une boucle (le Studio le renvoie au
          login, qui le renvoie au Studio). La rédaction arrive avec next=/admin. */}
      <input type="hidden" name="redirectTo" value={next ?? "/espace-membre"} />
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
      <PasswordField name="password" label="Mot de passe" autoComplete="current-password" />

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

      <div className="mt-1 flex flex-col gap-2 text-center text-[12.5px] text-ink-3">
        <Link href="/mot-de-passe-oublie" className="font-semibold text-blue hover:underline">
          Mot de passe oublié ?
        </Link>
        <span>
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-semibold text-blue hover:underline">
            Créer un compte
          </Link>
        </span>
      </div>
    </form>
  );
}
