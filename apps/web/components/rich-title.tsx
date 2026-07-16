import { Fragment } from "react";

/**
 * Titre d'article avec emphase : le texte entre astérisques `*...*` s'affiche
 * en orange italique, comme le <em> du modèle éditorial. Le reste est brut.
 * Ex. `PND 2026 : *47 820 milliards engagés* dès le premier jour`.
 */
export function RichTitle({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
          <em key={i} className="italic text-[#F47920]">
            {part.slice(1, -1)}
          </em>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

// La version texte nu vit dans lib/format : elle sert aussi hors composants
// (RSS, sitemap, newsletter). Réexportée ici pour les appelants existants.
export { plainTitle } from "@/lib/format";
