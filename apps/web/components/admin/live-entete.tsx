"use client";

/**
 * En-tête modifiable d'un direct : titre, chapeau, rubrique — et suppression.
 *
 * Rien de tout cela n'était rattrapable après la création. Un direct ouvert sur
 * « Élection présidentielle » et rangé par erreur dans Sport y restait, et un
 * direct créé par mégarde ne pouvait plus être retiré du site.
 *
 * Le formulaire reste replié tant qu'on ne le demande pas : l'écran d'un direct
 * sert d'abord à suivre le fil, pas à régler des réglages.
 */
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { modifierLiveBlog, supprimerLiveBlog, type LiveResult } from "@/lib/actions/live-actions";

export interface RubriqueChoix {
  id: string;
  name: string;
}

const champ =
  "w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-ink-3";

export function LiveEntete({
  id,
  titre,
  chapeau,
  rubriqueId,
  rubriques,
  peutSupprimer,
  nombreDeMisesAJour,
}: {
  id: string;
  titre: string;
  chapeau: string;
  rubriqueId: string;
  rubriques: RubriqueChoix[];
  /** Supprimer le direct entier : rédaction en chef et administration. */
  peutSupprimer: boolean;
  nombreDeMisesAJour: number;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const [result, formAction, enCours] = useActionState<LiveResult | undefined, FormData>(
    async (prev: LiveResult | undefined, data: FormData) => {
      const r = await modifierLiveBlog(id, prev, data);
      if (r.ok) {
        router.refresh();
        setOuvert(false);
      }
      return r;
    },
    undefined
  );

  const supprimer = () => {
    // On annonce ce qui disparaît. « Ce direct et ses 47 mises à jour » se
    // mesure ; « êtes-vous sûr ? » ne se mesure pas.
    const quoi =
      nombreDeMisesAJour > 0
        ? `« ${titre} » et ses ${nombreDeMisesAJour} mises à jour`
        : `« ${titre} »`;
    if (!window.confirm(`Supprimer définitivement ${quoi} ?\n\nLe fil entier disparaîtra du site.`)) return;
    setErreur(null);
    startTransition(async () => {
      const r = await supprimerLiveBlog(id);
      if (!r.ok) return setErreur(r.error);
      router.push("/admin/live");
    });
  };

  if (!ouvert) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="rounded-pill border border-line bg-surface px-4 py-2 text-xs font-semibold"
        >
          Modifier le direct
        </button>
        {peutSupprimer ? (
          <button
            type="button"
            onClick={supprimer}
            disabled={pending}
            className="rounded-pill border border-red bg-surface px-4 py-2 text-xs font-semibold text-red disabled:opacity-50"
          >
            {pending ? "Suppression…" : "Supprimer le direct"}
          </button>
        ) : null}
        {erreur ? <span className="text-[12px] font-semibold text-red">{erreur}</span> : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="mb-4 rounded-[14px] border border-line bg-surface-2 p-5">
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-2">Modifier le direct</div>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Titre</span>
          <input name="title" defaultValue={titre} required className={champ} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Chapeau (optionnel)</span>
          <input name="dek" defaultValue={chapeau} className={champ} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Rubrique</span>
          <select name="rubriqueId" defaultValue={rubriqueId} className={champ}>
            {rubriques.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="rounded-pill border border-line px-4 py-2 text-[12.5px] font-semibold text-ink-2"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={enCours}
          className="rounded-pill bg-navy px-5 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
        >
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
      {result && !result.ok ? <p className="mt-2 text-[12px] font-semibold text-red">{result.error}</p> : null}
    </form>
  );
}
