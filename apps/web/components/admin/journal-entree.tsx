"use client";

/**
 * Une ligne du journal des suppressions, dépliable sur son instantané.
 *
 * L'instantané est replié par défaut : c'est un objet complet, parfois plusieurs
 * milliers de caractères, et la question qu'on se pose en arrivant sur cette
 * page est « qu'est-ce qui a disparu, quand, par qui ». Le contenu intégral ne
 * sert qu'une fois qu'on a trouvé la bonne ligne.
 */
import { useState } from "react";

export function JournalEntree({
  quand,
  par,
  titre,
  detail,
  etiquette,
  snapshot,
}: {
  quand: string;
  par: string;
  titre: string;
  detail: string;
  etiquette: string;
  snapshot: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [copie, setCopie] = useState(false);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(snapshot);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : le contenu
      // reste sélectionnable à la main, on ne bloque pas là-dessus.
    }
  };

  return (
    <div className="border-b border-line-2 last:border-b-0">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="flex w-full items-start gap-4 px-6 py-3.5 text-left hover:bg-surface-2"
      >
        <span className="min-w-[86px] pt-0.5 text-[12px] font-semibold text-ink-2">{quand}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold">{titre}</span>
          <span className="block truncate text-[12px] text-ink-2">{detail}</span>
        </span>
        <span className="hidden whitespace-nowrap rounded-pill bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2 sm:inline">
          {etiquette}
        </span>
        <span className="hidden whitespace-nowrap pt-0.5 text-[12px] text-ink-2 md:inline">par {par}</span>
        <span className="pt-0.5 text-[12px] text-ink-2">{ouvert ? "▲" : "▼"}</span>
      </button>

      {ouvert ? (
        <div className="border-t border-line-2 bg-surface-2 px-6 py-4">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-2">
              Contenu au moment de la suppression
            </span>
            <button
              type="button"
              onClick={copier}
              className="rounded-pill border border-line bg-surface px-3 py-1 text-[11.5px] font-semibold text-ink-2"
            >
              {copie ? "Copié" : "Copier"}
            </button>
            <span className="text-[11.5px] text-ink-2 sm:hidden">{etiquette} · par {par}</span>
          </div>
          {/* `overflow-x-auto` : un instantané contient des lignes très longues
              (corps d'article, URL d'images). Sans cela, la page entière
              défilerait latéralement. */}
          <pre className="max-h-[420px] overflow-auto rounded-[8px] border border-line bg-surface p-3 text-[11.5px] leading-relaxed">
            {snapshot}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
