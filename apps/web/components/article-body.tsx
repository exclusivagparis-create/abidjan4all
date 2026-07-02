import { PlaceholderMedia } from "./placeholder-media";

type Block = {
  type: string;
  text?: string;
  cite?: string;
  url?: string;
  alt?: string;
};

/**
 * Rendu des blocs WYSIWYG (`Article.body`, cf. DATA_MODEL.md) dans le style
 * de Page Article.dc.html : Newsreader 19px/1.72, lettrine rouge sur le
 * premier paragraphe, exergues centrées.
 */
export function ArticleBody({ blocks, dropCap = true }: { blocks: unknown; dropCap?: boolean }) {
  if (!Array.isArray(blocks)) return null;

  return (
    <>
      {(blocks as Block[]).map((block, i) => {
        switch (block.type) {
          case "paragraph": {
            const text = block.text ?? "";
            if (dropCap && i === 0 && text.length > 1) {
              return (
                <p key={i} className="mb-[22px] font-serif text-[19px] leading-[1.72] text-ink">
                  <span className="float-left pr-3.5 pt-[9px] font-serif text-[82px] font-medium leading-[0.72] text-red">
                    {text[0]}
                  </span>
                  {text.slice(1)}
                </p>
              );
            }
            return (
              <p key={i} className="mb-[22px] font-serif text-[19px] leading-[1.72] text-ink">
                {text}
              </p>
            );
          }
          case "h2":
            return (
              <h2 key={i} className="mb-4 mt-9 font-serif text-[27px] font-semibold leading-[1.2] text-ink">
                {block.text}
              </h2>
            );
          case "quote":
            return (
              <blockquote key={i} className="my-[34px] text-center">
                <p className="mb-3 font-serif text-[31px] font-medium italic leading-[1.3] text-ink">
                  {block.text}
                </p>
                {block.cite ? (
                  <cite className="text-[13px] not-italic text-ink-3">— {block.cite}</cite>
                ) : null}
              </blockquote>
            );
          case "callout":
            return (
              <div key={i} className="my-6 rounded-md border border-line bg-surface-2 p-5 font-serif text-[17px] leading-relaxed text-ink-2">
                {block.text}
              </div>
            );
          case "image":
            return (
              <PlaceholderMedia key={i} url={block.url} alt={block.alt} className="my-7 h-[320px] w-full rounded-md" />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
