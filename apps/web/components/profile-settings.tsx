"use client";

import { useActionState } from "react";
import {
  changeOwnPasswordAction,
  updateOwnNameAction,
  type ProfileResult,
} from "@/lib/actions/profile-actions";

const field = "rounded-[8px] border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-ink-3";
const label = "grid gap-1.5 text-xs font-semibold text-ink-2";

function Feedback({ result }: { result: ProfileResult | undefined }) {
  if (!result) return null;
  return (
    <p className={`text-[12.5px] font-semibold ${result.ok ? "text-green" : "text-red"}`}>
      {result.ok ? result.message : result.error}
    </p>
  );
}

export function ProfileSettings({ name, email }: { name: string; email: string }) {
  const [nameRes, nameAction, namePending] = useActionState<ProfileResult | undefined, FormData>(
    updateOwnNameAction,
    undefined
  );
  const [pwdRes, pwdAction, pwdPending] = useActionState<ProfileResult | undefined, FormData>(
    changeOwnPasswordAction,
    undefined
  );

  return (
    <div className="grid gap-6">
      {/* Identité */}
      <section className="rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.06em] text-ink-3">Identité</h2>
        <form action={nameAction} className="grid max-w-[420px] gap-4">
          <label className={label}>
            Nom et prénom
            <input name="name" defaultValue={name} required maxLength={80} className={field} />
          </label>
          <label className={label}>
            Adresse e-mail (non modifiable)
            <input
              value={email}
              readOnly
              disabled
              className="cursor-not-allowed rounded-[8px] border border-line bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink-3"
            />
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={namePending} className="justify-self-start rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on disabled:opacity-60">
              {namePending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <Feedback result={nameRes} />
          </div>
        </form>
      </section>

      {/* Mot de passe */}
      <section className="rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.06em] text-ink-3">Mot de passe</h2>
        <form action={pwdAction} className="grid max-w-[420px] gap-4">
          <label className={label}>
            Mot de passe actuel
            <input name="current" type="password" required autoComplete="current-password" className={field} />
          </label>
          <label className={label}>
            Nouveau mot de passe (8 caractères min.)
            <input name="next" type="password" required minLength={8} autoComplete="new-password" className={field} />
          </label>
          <label className={label}>
            Confirmer le nouveau mot de passe
            <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={field} />
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={pwdPending} className="justify-self-start rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on disabled:opacity-60">
              {pwdPending ? "Modification…" : "Changer le mot de passe"}
            </button>
            <Feedback result={pwdRes} />
          </div>
        </form>
      </section>
    </div>
  );
}
