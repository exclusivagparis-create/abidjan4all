"use client";

/**
 * Sélecteur de visuel de la médiathèque.
 *
 * Écrit une fois, utilisé deux fois : pour l'image à la une, et pour les blocs
 * « Média » du corps d'article. Le second n'existait pas — le bloc Média ne
 * savait produire qu'un placeholder, si bien qu'un article ne pouvait porter
 * qu'une seule vraie image, sa couverture.
 *
 * La sélection est décrite par `estChoisi` plutôt que par une valeur, parce que
 * les deux usages ne désignent pas la même chose : la une retient l'identifiant
 * du média, le bloc retient son URL. Un seul composant sert les deux sans
 * qu'aucun ait à se plier à la convention de l'autre.
 */
import { useEffect, useState, useTransition } from "react";
import { chercherMedias } from "@/lib/actions/media-actions";

export type MediaOption = { id: string; url: string; alt: string | null };

export function SelecteurImage({
  medias,
  estChoisi,
  onChoisir,
  autoriserAucune = false,
}: {
  /** Visuels récents, fournis par le serveur au chargement de la page. */
  medias: MediaOption[];
  estChoisi: (m: MediaOption) => boolean;
  onChoisir: (m: MediaOption | null) => void;
  /** Propose une case « Aucune » — utile pour la une, pas pour un bloc image. */
  autoriserAucune?: boolean;
}) {
  const [recherche, setRecherche] = useState("");
  const [distants, setDistants] = useState<MediaOption[] | null>(null);
  const [pending, startTransition] = useTransition();

  const q = recherche.trim();

  // La liste locale ne contient que les visuels récents ; au-delà, on interroge
  // le serveur. Sans cela, chercher une photo d'archive ne donnerait rien et
  // laisserait croire qu'elle n'a pas été reprise.
  useEffect(() => {
    if (q.length < 2) {
      setDistants(null);
      return;
    }
    const minuteur = setTimeout(() => {
      startTransition(async () => setDistants(await chercherMedias(q)));
    }, 300);
    return () => clearTimeout(minuteur);
  }, [q]);

  const locaux = q
    ? medias.filter((m) => (m.alt ?? "").toLowerCase().includes(q.toLowerCase()) || m.url.toLowerCase().includes(q.toLowerCase()))
    : medias;

  // Les résultats du serveur complètent les visuels déjà en main sans les
  // remplacer : ce qui était affiché reste affiché, l'un ne chasse pas l'autre.
  const vus = new Set(locaux.map((m) => m.id));
  const visibles = distants ? [...locaux, ...distants.filter((m) => !vus.has(m.id))] : locaux;

  return (
    <div>
      <input
        type="search"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder={`Rechercher parmi ${medias.length} image${medias.length > 1 ? "s" : ""}…`}
        className="mb-2 w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[12.5px] outline-none focus:border-ink-3"
      />
      <div className="max-h-[300px] overflow-y-auto rounded-[8px] border border-line-2 p-2">
        <div className="grid grid-cols-3 gap-2">
          {autoriserAucune && !q ? (
            <button
              type="button"
              onClick={() => onChoisir(null)}
              className={`flex h-16 items-center justify-center rounded-[8px] border text-[11px] font-semibold ${
                medias.every((m) => !estChoisi(m)) ? "border-ink text-ink" : "border-line text-ink-3"
              }`}
            >
              Aucune
            </button>
          ) : null}
          {visibles.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.alt ?? undefined}
              onClick={() => onChoisir(m)}
              className={`h-16 overflow-hidden rounded-[8px] border-2 ${
                estChoisi(m) ? "border-[var(--accent)]" : "border-transparent"
              }`}
            >
              {m.url.startsWith("placeholder://") ? (
                <span className="flex h-full w-full items-center justify-center bg-surface-2 px-1 text-center font-mono text-[9px] uppercase text-ink-3">
                  {m.url.slice("placeholder://".length).slice(0, 24)}
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.alt ?? ""} className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
        {visibles.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-ink-2">
            {pending ? "Recherche…" : `Aucune image ne correspond à « ${recherche} ».`}
          </p>
        ) : null}
        {pending && visibles.length > 0 ? (
          <p className="pt-2 text-center text-[11.5px] text-ink-2">Recherche dans toute la médiathèque…</p>
        ) : null}
      </div>
    </div>
  );
}
