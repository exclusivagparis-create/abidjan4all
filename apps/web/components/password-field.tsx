"use client";

import { useId, useState } from "react";

/**
 * Champ mot de passe avec bouton de visibilité.
 *
 * Le bouton porte `type="button"` : sans lui, un bouton dans un formulaire
 * vaut `submit` et cliquer sur l'œil enverrait le formulaire. Il est exclu de
 * la tabulation (`tabIndex={-1}`) pour ne pas s'intercaler entre le mot de
 * passe et le bouton de connexion, et son état est annoncé aux lecteurs
 * d'écran via `aria-pressed` + un libellé qui change.
 */
export function PasswordField({
  name,
  label,
  autoComplete = "current-password",
  required = true,
  placeholder = "••••••••••",
  minLength,
  hint,
  className,
}: {
  name: string;
  label: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  minLength?: number;
  /** Mention affichée sous le champ (« 8 caractères minimum. »). */
  hint?: string;
  /** Habillage du champ, quand la page a sa propre convention de styles. */
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-ink-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          name={name}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          // pr-11 : réserve la place du bouton pour qu'un mot de passe long
          // ne passe pas dessous.
          className={
            className ??
            "w-full rounded-[8px] border border-line bg-surface-2 py-2.5 pl-3.5 pr-11 text-sm text-ink outline-none focus:border-ink-3"
          }
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-pressed={visible}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-3 hover:text-ink"
        >
          <span aria-hidden className="text-[16px] leading-none">
            {visible ? "🙈" : "👁"}
          </span>
        </button>
      </div>
      {hint ? <span className="text-[11px] font-normal text-ink-3">{hint}</span> : null}
    </div>
  );
}
