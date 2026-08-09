"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type RegisterResult } from "@/lib/actions/register-actions";
import { PasswordField } from "@/components/password-field";

const inp =
  "w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-ink-3";
// Même habillage, avec la place réservée au bouton œil à droite.
const inpOeil =
  "w-full rounded-[10px] border border-line bg-surface py-2.5 pl-3.5 pr-11 text-[14px] text-ink outline-none focus:border-ink-3";

export function RegisterForm() {
  const [state, action, pending] = useActionState<RegisterResult | undefined, FormData>(registerAction, undefined);

  if (state?.ok) {
    return (
      <div className="rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
        <h2 className="mb-2 font-serif text-[20px] font-semibold">Vérifiez votre boîte mail</h2>
        <p className="mb-4 font-serif text-[15px] leading-[1.5] text-ink-2">
          Si cette adresse peut être inscrite, un lien de confirmation vient d&apos;être envoyé à{" "}
          <b>{state.email}</b>. Ouvrez-le pour activer votre compte — il est valable 3 jours.
        </p>
        <p className="text-[13px] text-ink-3">
          Rien reçu au bout de quelques minutes ? Regardez dans vos courriers indésirables.
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
        Nom et prénom
        <input name="name" required autoComplete="name" className={inp} />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
        Adresse e-mail
        <input name="email" type="email" required autoComplete="email" className={inp} />
      </label>
      <PasswordField
        name="password"
        label="Mot de passe"
        autoComplete="new-password"
        minLength={8}
        hint="8 caractères minimum."
        className={inpOeil}
      />
      <PasswordField
        name="confirm"
        label="Confirmer le mot de passe"
        autoComplete="new-password"
        minLength={8}
        className={inpOeil}
      />

      {/* Pot de miel : invisible pour un humain, rempli par les robots. */}
      <input
        name="site"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-pill bg-red py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {pending ? "Création…" : "Créer mon compte"}
      </button>

      <p className="mt-1 text-center text-[12.5px] text-ink-3">
        Déjà inscrit ?{" "}
        <Link href="/login" className="font-semibold text-blue hover:underline">
          Se connecter
        </Link>
      </p>
      <p className="text-center text-[11.5px] leading-[1.5] text-ink-3">
        En créant un compte, vous acceptez les{" "}
        <Link href="/cgu" className="underline">
          conditions générales d&apos;utilisation
        </Link>{" "}
        et la{" "}
        <Link href="/confidentialite" className="underline">
          politique de confidentialité
        </Link>
        .
      </p>
    </form>
  );
}
