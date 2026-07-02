/**
 * Visuel éditorial : le handoff ne fournit aucune imagerie — les maquettes
 * utilisent des aplats hachurés avec légende monospace, reproduits ici.
 * Quand la médiathèque réelle sera branchée (DF-02), ce composant affichera
 * l'image si `url` n'est pas un placeholder.
 */
export function PlaceholderMedia({
  url,
  alt,
  className,
  style,
}: {
  url?: string | null;
  alt?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const caption = url?.startsWith("placeholder://") ? url.slice("placeholder://".length) : alt;
  const isReal = url && !url.startsWith("placeholder://");

  if (isReal) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt ?? ""} className={className} style={{ objectFit: "cover", ...style }} />;
  }

  return (
    <div
      className={className}
      style={{
        background:
          "repeating-linear-gradient(135deg, var(--surface-3), var(--surface-3) 13px, var(--surface-2) 13px, var(--surface-2) 26px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {caption ? (
        <span className="px-4 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">
          {caption}
        </span>
      ) : null}
    </div>
  );
}
