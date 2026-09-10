import { PlaceholderMedia } from "./placeholder-media";

type Block = {
  type: string;
  text?: string;
  html?: string;
  cite?: string;
  url?: string;
  /** Texte alternatif : pour les lecteurs d'écran, jamais affiché. */
  alt?: string;
  /** Légende éditoriale, affichée sous l'image. */
  caption?: string;
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
          case "richtext":
            // HTML déjà nettoyé au save (liste blanche serveur) — styles éditoriaux.
            return (
              <div
                key={i}
                className="mb-[22px] font-serif text-[17.5px] leading-[1.78] text-ink [&_a]:text-blue [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-line [&_blockquote]:pl-4 [&_blockquote]:italic [&_h3]:mt-6 [&_h3]:font-serif [&_h3]:text-[22px] [&_h3]:font-bold [&_h4]:mt-5 [&_h4]:font-serif [&_h4]:text-[19px] [&_h4]:font-semibold [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:border [&_th]:border-line [&_th]:bg-surface-2 [&_th]:px-2.5 [&_th]:py-1.5 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
                dangerouslySetInnerHTML={{ __html: block.html ?? "" }}
              />
            );
          case "paragraph": {
            const text = block.text ?? "";
            // premier paragraphe = « lead » du modèle : plus grand, semi-gras
            const lead = dropCap && i === 0 && text.length > 1;
            const classe = lead
              ? "mb-[22px] font-serif text-[19.5px] font-semibold leading-[1.62] text-ink"
              : "mb-[22px] font-serif text-[17.5px] leading-[1.78] text-ink";

            // Un paragraphe mis en forme porte du `html` ; les autres — tous
            // ceux écrits avant que l'éditeur ne sache le faire, dont les
            // 4 315 articles repris — n'ont que du `text`, et restent rendus
            // comme du texte. Le champ départage : rien à migrer, et pas de
            // risque qu'un chevron d'archive soit relu comme du balisage.
            if (block.html) {
              return (
                <div
                  key={i}
                  className={`${classe} [&_a]:text-blue [&_a]:underline [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6`}
                  // Nettoyé au save par la liste blanche du serveur, comme le
                  // texte enrichi (cf. sanitizeBlocks).
                  dangerouslySetInnerHTML={{ __html: block.html }}
                />
              );
            }

            return (
              <p key={i} className={classe}>
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
          case "image": {
            // `<figure>` plutôt qu'une image nue : la légende doit être liée à
            // la photo dans la structure du document, pas seulement posée
            // dessous. Sans légende saisie, aucun `<figcaption>` n'est rendu —
            // on n'affiche pas un texte de repli faute de mieux.
            const legende = block.caption?.trim();
            return (
              <figure key={i} className="my-7">
                {/* `h-[320px]` ne vaut plus que pour l'aplat d'attente, qui n'a
                    aucune dimension propre ; une vraie photo prend la largeur
                    de la colonne et sa hauteur naturelle, plafonnée à 70 %. */}
                <PlaceholderMedia
                  ajuste
                  url={block.url}
                  alt={block.alt}
                  className="h-[320px] max-h-[70vh] w-full rounded-[3px]"
                />
                {legende ? (
                  // Centrée, comme la légende de la photo de une : les deux
                  // sont le même objet éditorial et doivent se lire pareil.
                  <figcaption className="mt-2 px-0.5 text-center text-[11.5px] leading-normal text-ink-3">
                    {legende}
                  </figcaption>
                ) : null}
              </figure>
            );
          }
          default:
            return null;
        }
      })}
    </>
  );
}
