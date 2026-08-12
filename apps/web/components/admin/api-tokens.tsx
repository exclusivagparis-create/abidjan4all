"use client";

import { useActionState, useState } from "react";
import {
  creerJetonAction,
  revoquerJetonAction,
  supprimerJetonAction,
  type ActionSimple,
  type JetonResult,
} from "@/lib/actions/api-token-actions";

const inp = "rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-ink-3";

const LIBELLE_PORTEE: Record<string, string> = {
  "articles:read": "lecture",
  "articles:write": "rédaction",
  "stats:read": "statistiques",
};

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

export function CreerJeton({ scopes }: { scopes: { id: string; label: string; detail: string }[] }) {
  const [res, action, pending] = useActionState<JetonResult | undefined, FormData>(creerJetonAction, undefined);

  return (
    <section className="mb-8 rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Nouveau jeton</div>

      {res?.ok ? <SecretAffiche token={res.token} message={res.message} /> : null}
      {res && !res.ok ? (
        <p className="mb-3 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
          {res.error}
        </p>
      ) : null}

      <form action={action} className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid min-w-[240px] flex-1 gap-1.5 text-xs font-semibold text-ink-2">
            Nom du jeton
            <input name="name" required placeholder="Claude Desktop de Georges" className={inp} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
            Expire dans (jours)
            <input
              name="jours"
              type="number"
              min={1}
              max={730}
              placeholder="illimité"
              className={`${inp} w-[130px]`}
            />
          </label>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-xs font-semibold text-ink-2">Portées accordées</legend>
          {scopes.map((s) => (
            <label key={s.id} className="flex items-start gap-2.5 text-[13px] text-ink-2">
              <input
                type="checkbox"
                name="scopes"
                value={s.id}
                defaultChecked={s.id === "articles:read"}
                className="mt-1"
              />
              <span>
                <b className="font-semibold text-ink">{s.label}</b>
                <span className="block text-[12px] text-ink-3">{s.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <button
          type="submit"
          disabled={pending}
          className="justify-self-start rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on disabled:opacity-60"
        >
          {pending ? "Création…" : "Créer le jeton"}
        </button>
      </form>
    </section>
  );
}

/** Le secret n'existe qu'ici, une fois. Passé ce rendu, il est irrécupérable. */
function SecretAffiche({ token, message }: { token: string; message: string }) {
  const [copie, setCopie] = useState(false);

  return (
    <div className="mb-4 rounded-[10px] border border-green bg-[rgba(46,139,87,0.08)] p-4">
      <p className="mb-2 text-[13px] font-semibold text-green">{message}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-[8px] bg-navy px-3 py-2 text-[12.5px] text-[#D8DEE9]">
          {token}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(token).then(() => {
              setCopie(true);
              setTimeout(() => setCopie(false), 2500);
            });
          }}
          className="rounded-pill border border-line bg-surface px-4 py-2 text-xs font-bold text-ink"
        >
          {copie ? "Copié ✓" : "Copier"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ligne de la liste
// ---------------------------------------------------------------------------

export interface JetonVue {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  proprietaire: string;
  dernierUsage: string | null;
  expire: string | null;
  perime: boolean;
  revoque: boolean;
  cree: string;
}

export function LigneJeton({ jeton }: { jeton: JetonVue }) {
  const [revRes, revoquer, revPending] = useActionState<ActionSimple | undefined, FormData>(
    revoquerJetonAction,
    undefined
  );
  const [supRes, supprimer, supPending] = useActionState<ActionSimple | undefined, FormData>(
    supprimerJetonAction,
    undefined
  );
  const erreur = (revRes && !revRes.ok && revRes.error) || (supRes && !supRes.ok && supRes.error) || null;

  const inactif = jeton.revoque || jeton.perime;

  return (
    <tr className={`border-b border-line last:border-0 ${inactif ? "opacity-60" : ""}`}>
      <td className="px-4 py-3">
        <div className="font-semibold text-ink">{jeton.name}</div>
        <div className="text-[11.5px] text-ink-3">
          {jeton.proprietaire} · créé le {jeton.cree}
        </div>
        {erreur ? <div className="mt-1 text-[11.5px] font-semibold text-red">{erreur}</div> : null}
      </td>
      <td className="px-4 py-3">
        <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px]">{jeton.prefix}…</code>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {jeton.scopes.map((s) => (
            <span key={s} className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
              {LIBELLE_PORTEE[s] ?? s}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-[12.5px] text-ink-2">{jeton.dernierUsage ?? "jamais utilisé"}</td>
      <td className="px-4 py-3 text-[12.5px]">
        {jeton.revoque ? (
          <span className="font-semibold text-red">Révoqué</span>
        ) : jeton.perime ? (
          <span className="font-semibold text-orange">Expiré</span>
        ) : (
          <span className="font-semibold text-green">
            Actif{jeton.expire ? <span className="font-normal text-ink-3"> · jusqu&apos;au {jeton.expire}</span> : null}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {jeton.revoque ? (
          <form action={supprimer}>
            <input type="hidden" name="id" value={jeton.id} />
            <button type="submit" disabled={supPending} className="text-[12px] font-semibold text-ink-3 hover:text-red">
              {supPending ? "…" : "Supprimer"}
            </button>
          </form>
        ) : (
          <form action={revoquer}>
            <input type="hidden" name="id" value={jeton.id} />
            <button type="submit" disabled={revPending} className="text-[12px] font-semibold text-red hover:underline">
              {revPending ? "…" : "Révoquer"}
            </button>
          </form>
        )}
      </td>
    </tr>
  );
}
