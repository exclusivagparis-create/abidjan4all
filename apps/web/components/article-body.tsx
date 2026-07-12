import { PlaceholderMedia } from "./placeholder-media";

type Block = {
  type: string;
  text?: string;
  cite?: string;
  url?: string;
  alt?: string;
  variant?: string;
};

/** Teintes des encadrés (callout) — reprises du modèle éditorial. */
const CALLOUT_TINT: Record<string, { border: string; bg: string; head: string }> = {
  orange: { border: "#F47920", bg: "rgba(244,121,32,0.07)", head: "#c85d10" },
  blue: { border: "#1a3a5c", bg: "rgba(26,58,92,0.07)", head: "#1a3a5c" },
  teal: { border: "#006e5a", bg: "rgba(0,110,90,0.07)", head: "#006e5a" },
  red: { border: "#a01520", bg: "rgba(160,21,32,0.06)", head: "#a01520" },
  green: { border: "#006633", bg: "rgba(0,102,51,0.07)", head: "#006633" },
  purple: { border: "#7C3A8C", bg: "rgba(124,58,140,0.07)", head: "#7C3A8C" },
};

/** Un encadré peut porter un titre en première ligne « Titre | corps… ». */
function splitHeading(text: string): { heading?: string; body: string } {
  const nl = text.indexOf("\n");
  if (nl > 0 && nl < 80) return { heading: text.slice(0, nl).trim(), body: text.slice(nl + 1).trim() };
  return { body: text };
}

/**
 * Rendu des blocs WYSIWYG (`Article.body`) — style éditorial du modèle
 * maquette 2026 : chapô fort en tête, intertitres à filet, exergues à filets
 * dorés, encadrés teintés à liseré orange. Les teintes passent par rgba pour
 * rester lisibles en mode sombre.
 */
export function ArticleBody({ blocks, dropCap = true }: { blocks: unknown; dropCap?: boolean }) {
  if (!Array.isArray(blocks)) return null;

  return (
    <>
      {(blocks as Block[]).map((block, i) => {
        switch (block.type) {
          case "paragraph": {
            const text = block.text ?? "";
            // premier paragraphe = « lead » du modèle : plus grand, semi-gras
            if (dropCap && i === 0 && text.length > 1) {
              return (
                <p key={i} className="mb-[22px] font-serif text-[19.5px] font-semibold leading-[1.62] text-ink">
                  {text}
                </p>
              );
            }
            return (
              <p key={i} className="mb-[22px] font-serif text-[17.5px] leading-[1.78] text-ink">
                {text}
              </p>
            );
          }
          case "h2":
            return (
              <h2
                key={i}
                className="mb-4 mt-10 border-b border-[rgba(212,168,67,0.45)] pb-2 font-serif text-[25px] font-bold leading-[1.2] text-ink"
              >
                {block.text}
              </h2>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="my-[44px] border-b border-t-[3px] border-[#d4a843] py-6"
              >
                <p className="mb-2.5 font-serif text-[24px] font-medium italic leading-[1.45] text-ink">
                  « {block.text} »
                </p>
                {block.cite ? (
                  <cite className="text-[11.5px] font-bold uppercase not-italic tracking-[0.1em] text-ink-3">
                    — {block.cite}
                  </cite>
                ) : null}
              </blockquote>
            );
          case "callout": {
            const tint = CALLOUT_TINT[block.variant ?? "orange"] ?? CALLOUT_TINT.orange!;
            const { heading, body } = splitHeading(block.text ?? "");
            return (
              <div
                key={i}
                className="my-8 rounded-r-md border-l-4 px-6 py-5"
                style={{ borderColor: tint.border, background: tint.bg }}
              >
                {heading ? (
                  <div
                    className="mb-2.5 text-[12.5px] font-bold uppercase tracking-[0.1em]"
                    style={{ color: tint.head }}
                  >
                    {heading}
                  </div>
                ) : null}
                {body.split("\n").map((line, k) => (
                  <p key={k} className="mb-1.5 font-serif text-[15px] leading-relaxed text-ink last:mb-0">
                    {line}
                  </p>
                ))}
              </div>
            );
          }
          case "kpi": {
            // barre de chiffres clés (modèle : fond sombre, labels orange).
            // une ligne « Label | Valeur » par item.
            const items = (block.text ?? "")
              .split("\n")
              .map((l) => l.split("|").map((s) => s.trim()))
              .filter((pair) => pair[0]);
            if (items.length === 0) return null;
            return (
              <div key={i} className="my-8 flex flex-wrap gap-x-10 gap-y-4 rounded-md bg-ink px-7 py-6">
                {items.map(([label, value], k) => (
                  <div key={k}>
                    <div className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#F5C24B]">
                      {label}
                    </div>
                    <div className="text-[15px] font-bold leading-tight text-bg">{value ?? ""}</div>
                  </div>
                ))}
              </div>
            );
          }
          case "note":
            // note de vérification des sources (modèle : vert à tirets).
            return (
              <div
                key={i}
                className="my-6 rounded-md border border-dashed border-[#006633] bg-[rgba(0,102,51,0.05)] px-5 py-3.5 text-[13.5px] leading-relaxed text-[#2a5a2a]"
              >
                <strong className="font-bold text-[#006633]">✅ Vérification : </strong>
                {block.text}
              </div>
            );
          case "image":
            return (
              <PlaceholderMedia key={i} url={block.url} alt={block.alt} className="my-7 h-[320px] w-full rounded-[3px]" />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
