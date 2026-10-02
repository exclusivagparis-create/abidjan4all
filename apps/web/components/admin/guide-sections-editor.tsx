"use client";

import { useState } from "react";
import { RichTextEditor } from "./rich-text-editor";
import { SECTIONS, type CleSection } from "@/lib/guide";

/**
 * Les sections rédigées d'une fiche du Guide, chacune avec son éditeur.
 *
 * Elles sont présentées pliées, dépliées au clic : une fiche compte cinq
 * sections, et cinq éditeurs ouverts d'un coup donnent une page impossible à
 * parcourir. Celles qui contiennent déjà du texte s'ouvrent d'office — on
 * revient plus souvent pour relire que pour écrire.
 */
export function GuideSectionsEditor({ valeurs }: { valeurs: Partial<Record<CleSection, string | null>> }) {
  const [html, setHtml] = useState<Record<string, string>>(
    Object.fromEntries(SECTIONS.map((s) => [s.cle, valeurs[s.cle] ?? ""]))
  );
  const [ouvertes, setOuvertes] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map((s) => [s.cle, (valeurs[s.cle] ?? "").trim() !== ""]))
  );

  return (
    <div className="grid gap-3">
      {SECTIONS.map((s) => {
        const rempli = (html[s.cle] ?? "").trim() !== "";
        const ouverte = ouvertes[s.cle];
        return (
          <section key={s.cle} className="rounded-[12px] border border-line bg-surface">
            <input type="hidden" name={s.cle} value={html[s.cle] ?? ""} />
            <button
              type="button"
              onClick={() => setOuvertes((o) => ({ ...o, [s.cle]: !o[s.cle] }))}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className="text-[14px] font-bold">{s.label}</span>
              <span className={`rounded-pill px-2 py-0.5 text-[10.5px] font-bold ${rempli ? "bg-[rgba(14,138,95,0.12)] text-green" : "bg-surface-2 text-ink-3"}`}>
                {rempli ? "rédigée" : "à écrire"}
              </span>
              <span className="ml-auto text-[12px] text-ink-3">{ouverte ? "Replier" : "Déplier"}</span>
            </button>
            {ouverte ? (
              <div className="border-t border-line-2 px-4 py-3">
                <p className="mb-2 text-[12px] text-ink-3">{s.aide}</p>
                <RichTextEditor value={html[s.cle] ?? ""} onChange={(v) => setHtml((h) => ({ ...h, [s.cle]: v }))} />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
