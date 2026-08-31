"use client";

/**
 * Le fil d'un direct, avec correction et retrait de chaque mise à jour.
 *
 * Jusqu'ici le fil n'était qu'une liste : une fois postée, une mise à jour
 * restait telle quelle. Or un direct s'écrit dans l'urgence, et c'est
 * précisément là qu'on se trompe.
 *
 * La correction se fait EN PLACE, sur la ligne concernée, plutôt que sur une
 * page à part : en direct, on n'a pas le temps de naviguer, et perdre de vue le
 * reste du fil pour corriger une ligne fait perdre le fil justement.
 */
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  modifierLiveUpdate,
  supprimerLiveUpdate,
  type LiveResult,
} from "@/lib/actions/live-actions";

const TYPES = [
  { value: "text", label: "Texte" },
  { value: "quote", label: "Citation" },
  { value: "stat", label: "Chiffre clé" },
  { value: "media", label: "Média" },
];

export interface LigneFil {
  id: string;
  heure: string;
  type: string;
  titre: string | null;
  corps: string;
  epinglee: boolean;
}

const champ =
  "w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-ink-3";

/**
 * Corriger ou retirer une ligne du fil est ouvert à toute la rédaction, sans
 * condition de rôle : c'est le geste courant du direct, celui qu'on fait dans
 * la minute où l'on s'aperçoit de l'erreur. Seule la suppression du direct
 * ENTIER est réservée à la rédaction en chef (cf. live-entete.tsx).
 */
export function LiveFil({ lignes }: { lignes: LigneFil[] }) {
  const [enEdition, setEnEdition] = useState<string | null>(null);

  return (
    <div className="mt-6 rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
      <div className="mb-3 text-sm font-bold">Fil ({lignes.length} dernières)</div>
      {lignes.map((l) =>
        enEdition === l.id ? (
          <Correction key={l.id} ligne={l} onFini={() => setEnEdition(null)} />
        ) : (
          <Ligne key={l.id} ligne={l} onModifier={() => setEnEdition(l.id)} />
        )
      )}
      {lignes.length === 0 ? <p className="py-3 text-[13px] text-ink-3">Aucune mise à jour.</p> : null}
    </div>
  );
}

function Ligne({ ligne, onModifier }: { ligne: LigneFil; onModifier: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const retirer = () => {
    // Une mise à jour publiée a déjà été lue par le public : on demande
    // confirmation, et on dit ce qu'on s'apprête à retirer plutôt qu'un « êtes
    // vous sûr ? » que personne ne lit.
    const extrait = ligne.corps.slice(0, 80) + (ligne.corps.length > 80 ? "…" : "");
    if (!window.confirm(`Retirer définitivement cette mise à jour du fil ?\n\n« ${extrait} »`)) return;
    setErreur(null);
    startTransition(async () => {
      const r = await supprimerLiveUpdate(ligne.id);
      if (!r.ok) return setErreur(r.error);
      router.refresh();
    });
  };

  return (
    <div className="border-b border-line-2 py-3 last:border-b-0">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
        <span className="font-extrabold">{ligne.heure}</span>
        <span className="rounded-pill bg-surface-2 px-2 py-0.5 font-bold uppercase">{ligne.type}</span>
        {ligne.epinglee ? <span>📌</span> : null}
        <span className="flex-1" />
        <button
          type="button"
          onClick={onModifier}
          disabled={pending}
          className="rounded-pill border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-2 disabled:opacity-50"
        >
          Modifier
        </button>
        <button
          type="button"
          onClick={retirer}
          disabled={pending}
          className="rounded-pill border border-red px-2.5 py-1 text-[11px] font-semibold text-red disabled:opacity-50"
        >
          {pending ? "Retrait…" : "Retirer"}
        </button>
      </div>
      {ligne.titre ? <div className="font-serif text-[15px] font-semibold">{ligne.titre}</div> : null}
      <div className="font-serif text-[14px] text-ink-2">{ligne.corps}</div>
      {erreur ? <p className="mt-1.5 text-[12px] font-semibold text-red">{erreur}</p> : null}
    </div>
  );
}

function Correction({ ligne, onFini }: { ligne: LigneFil; onFini: () => void }) {
  const router = useRouter();
  const [result, formAction, pending] = useActionState<LiveResult | undefined, FormData>(
    async (prev: LiveResult | undefined, data: FormData) => {
      const r = await modifierLiveUpdate(ligne.id, prev, data);
      if (r.ok) {
        router.refresh();
        onFini();
      }
      return r;
    },
    undefined
  );

  return (
    <form action={formAction} className="border-b border-line-2 py-3 last:border-b-0">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-2">
        <span className="font-extrabold">{ligne.heure}</span>
        <span className="italic">
          {/* L'heure ne bouge pas : elle date l'événement rapporté, pas la
              correction. Le dire évite qu'on croie le fil réordonné. */}
          l&apos;heure d&apos;origine est conservée
        </span>
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        <select name="type" defaultValue={ligne.type} className={`${champ} w-auto`}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          name="title"
          defaultValue={ligne.titre ?? ""}
          placeholder="Titre (optionnel)"
          className={`${champ} min-w-[200px] flex-1`}
        />
      </div>
      <textarea
        name="body"
        required
        rows={3}
        defaultValue={ligne.corps}
        className={`${champ} resize-y font-serif text-[15px]`}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-2">
          <input
            type="checkbox"
            name="pinned"
            defaultChecked={ligne.epinglee}
            className="h-4 w-4 accent-[var(--navy)]"
          />
          📌 Épingler dans les faits clés
        </label>
        <span className="flex gap-2">
          <button
            type="button"
            onClick={onFini}
            className="rounded-pill border border-line px-4 py-2 text-[12.5px] font-semibold text-ink-2"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-pill bg-navy px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
          >
            {pending ? "Correction…" : "Corriger"}
          </button>
        </span>
      </div>
      {result && !result.ok ? <p className="mt-2 text-[12px] font-semibold text-red">{result.error}</p> : null}
    </form>
  );
}
