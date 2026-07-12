import { PlaceholderMedia } from "./placeholder-media";

type Block = {
  type: string;
  text?: string;
  cite?: string;
  url?: string;
  alt?: string;
};

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
          case "callout":
            return (
              <div
                key={i}
                className="my-8 rounded-r-md border-l-4 border-[#F47920] bg-[rgba(244,121,32,0.07)] px-6 py-5 font-serif text-[15.5px] leading-relaxed text-ink"
              >
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
