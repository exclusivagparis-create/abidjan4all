/** Bandeau « En Direct » défilant (breaking ticker de Page Accueil.dc.html). */
export function Ticker({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  const loop = [...items, ...items]; // dupliqué pour une boucle continue

  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1200px] items-stretch">
        <div className="flex flex-none items-center gap-2 bg-red px-[18px] text-xs font-extrabold uppercase tracking-[0.05em] text-white">
          <span className="h-[7px] w-[7px] rounded-pill bg-white [animation:a4a-pulse_1.4s_infinite]" />
          En Direct
        </div>
        <div className="flex h-[42px] flex-1 items-center overflow-hidden">
          <div className="flex gap-[42px] whitespace-nowrap pl-[22px] text-[13.5px] text-ink [animation:a4a-marquee_28s_linear_infinite]">
            {loop.map((item, i) => (
              <span key={i}>
                <b className="text-red">•</b>&nbsp; {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
