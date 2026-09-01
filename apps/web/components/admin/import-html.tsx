"use client";

/**
 * Import d'un article depuis du HTML.
 *
 * Le rédacteur colle le code d'une page — ou son contenu copié depuis un
 * traitement de texte — et l'éditeur en fait des blocs. Chaque élément retrouve
 * son type : intertitre, citation, image, paragraphe. L'article reste donc
 * modifiable morceau par morceau, ce qu'un pavé de HTML n'aurait pas permis.
 */
import { useMemo, useState } from "react";
import { htmlVersBlocs, resumeImport, type BlocImporte } from "@/lib/html-vers-blocs";

export function ImportHtml({
  onInserer,
  corpsVide,
}: {
  onInserer: (blocs: BlocImporte[], remplacer: boolean) => void;
  /** L'article n'a-t-il pas encore de contenu ? Décide de l'option par défaut. */
  corpsVide: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [html, setHtml] = useState("");
  // Remplacer par défaut sur un article vierge, compléter sinon : on ne
  // propose jamais d'effacer un texte existant sans que ce soit demandé.
  const [remplacer, setRemplacer] = useState(corpsVide);

  // Analyse à la frappe : le rédacteur voit ce qu'il obtiendra avant
  // d'insérer. Le coût est nul face à un collage de quelques dizaines de Ko,
  // et l'aperçu évite l'insertion à l'aveugle suivie d'une annulation.
  const blocs = useMemo(() => {
    if (!html.trim()) return [];
    try {
      return htmlVersBlocs(html);
    } catch {
      return [];
    }
  }, [html]);

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="rounded-pill border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2"
      >
        ⇩ Importer du HTML
      </button>
    );
  }

  const inserer = () => {
    if (blocs.length === 0) return;
    onInserer(blocs, remplacer);
    setHtml("");
    setOuvert(false);
  };

  return (
    <div className="w-full rounded-[10px] border border-dashed border-line bg-surface-2 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-2">
          Importer un article depuis du HTML
        </span>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="text-[12px] font-semibold text-ink-2 hover:text-ink"
        >
          Fermer
        </button>
      </div>

      <textarea
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        rows={8}
        spellCheck={false}
        placeholder="Collez ici le code HTML de l'article…"
        className="w-full resize-y rounded-[8px] border border-line bg-surface px-3 py-2 font-mono text-[12px] leading-relaxed text-ink outline-none focus:border-ink-3"
      />

      <p className="mt-2 text-[12px] text-ink-2">
        {html.trim() ? (
          <>
            <strong className="font-semibold">{resumeImport(blocs)}</strong>
            {blocs.length > 0 ? (
              <>
                {" "}
                — les scripts, styles et menus sont écartés ; les images sont reprises par leur adresse et restent
                à téléverser dans la médiathèque si vous voulez les conserver durablement.
              </>
            ) : null}
          </>
        ) : (
          "Les intertitres, citations, listes et images retrouveront leur type dans l'éditeur."
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-2">
          <input
            type="checkbox"
            checked={remplacer}
            onChange={(e) => setRemplacer(e.target.checked)}
            className="h-4 w-4 accent-[var(--navy)]"
          />
          Remplacer le contenu actuel
        </label>
        <button
          type="button"
          onClick={inserer}
          disabled={blocs.length === 0}
          className="rounded-pill bg-navy px-5 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
        >
          {remplacer ? "Remplacer" : "Ajouter à la suite"}
        </button>
      </div>
    </div>
  );
}
