"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createUserAction,
  deleteUserAction,
  type CreateUserResult,
} from "@/lib/actions/user-admin-actions";

const ROLES: Array<[string, string]> = [
  ["reader", "Lecteur"],
  ["member", "Membre"],
  ["journalist", "Journaliste"],
  ["editor", "Rédaction en chef"],
  ["admin", "Administration"],
  ["partner", "Partenaire"],
];

/** Création de compte — le mot de passe généré ne s'affiche qu'une fois. */
export function CreateUserForm() {
  const [result, formAction, pending] = useActionState<CreateUserResult | undefined, FormData>(
    createUserAction,
    undefined
  );

  return (
    <form action={formAction} className="mb-6 rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Créer un compte</div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[180px] flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Nom complet</span>
          <input name="name" required maxLength={80} placeholder="Aya Kouadio" className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none" />
        </label>
        <label className="flex min-w-[220px] flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Email</span>
          <input name="email" type="email" required placeholder="aya.kouadio@abidjan4all.net" className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Rôle</span>
          <select name="role" defaultValue="journalist" className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none">
            {ROLES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending} className="rounded-pill bg-brand-fill px-5 py-2.5 text-[13px] font-bold text-brand-on disabled:opacity-60">
          {pending ? "Création…" : "Créer le compte"}
        </button>
      </div>
      {result && !result.ok ? (
        <p className="mt-3 text-[12.5px] font-semibold text-red">{result.error}</p>
      ) : null}
      {result?.ok ? (
        <div className="mt-3 rounded-md bg-[rgba(14,138,95,0.1)] px-4 py-3 text-[12.5px]">
          {result.invited ? (
            <p className="font-semibold text-green">
              Compte {result.email} créé. Un e-mail d&apos;invitation vient d&apos;être envoyé : la personne y
              définira elle-même son mot de passe (lien valable 7 jours).
            </p>
          ) : (
            <>
              <p className="font-semibold text-green">
                Compte {result.email} créé. Mot de passe initial (affiché une seule fois — transmettez-le de façon
                sécurisée) :
              </p>
              <code className="mt-1 inline-block rounded bg-surface px-2.5 py-1 font-mono text-[13px] font-bold text-ink">
                {result.password}
              </code>
            </>
          )}
        </div>
      ) : null}
    </form>
  );
}

/** Suppression protégée d'un compte, avec confirmation et message d'erreur. */
export function UserDeleteButton({ id, name }: { id: string; name: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Supprimer définitivement le compte « ${name} » ?`)) return;
          startTransition(async () => {
            const r = await deleteUserAction(id);
            setError(r.ok ? null : r.error);
          });
        }}
        className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-2.5 py-1 text-[11px] font-semibold text-red disabled:opacity-60"
      >
        {pending ? "…" : "Supprimer"}
      </button>
      {error ? <span className="max-w-[220px] text-[10.5px] font-semibold leading-tight text-red">{error}</span> : null}
    </span>
  );
}
