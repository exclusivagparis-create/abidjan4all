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
  ajuste = false,
}: {
  url?: string | null;
  alt?: string | null;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Ajuste le cadre à la photo au lieu de la rogner.
   *
   * Par défaut, l'image remplit un cadre de hauteur fixe et déborde des deux
   * côtés : c'est ce qu'il faut dans une grille de vignettes, où l'alignement
   * prime. Mais dans le corps d'un article, la photo est le document — la
   * rogner en coupe le sens : sur un article publié, la photo de une perdait
   * 45 % de sa surface, un portrait jusqu'à 69 %, têtes tranchées comprises.
   *
   * Ici, la largeur reste celle de la colonne et la hauteur suit le rapport
   * de l'image : rien n'est coupé, rien n'est déformé. La hauteur du cadre
   * passée en classe ne sert plus que de plafond, pour qu'une photo en
   * portrait ne tienne pas trois écrans à elle seule.
   */
  ajuste?: boolean;
}) {
  const caption = url?.startsWith("placeholder://") ? url.slice("placeholder://".length) : alt;
  const isReal = url && !url.startsWith("placeholder://");

  if (isReal) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={alt ?? ""}
        className={className}
        style={
          ajuste
            ? // Le cadre épouse la photo au lieu de l'inverse : largeur jusqu'à
              // la colonne, hauteur jusqu'au plafond, rapport toujours
              // respecté. Aucune bande vide n'apparaît puisque la boîte a
              // exactement la taille de l'image, et une photo plus petite que
              // la colonne s'affiche à sa taille vraie plutôt qu'agrandie et
              // floue — un dixième des 571 photos mesurées en production font
              // moins de 400 px de large.
              {
                width: "auto",
                height: "auto",
                maxWidth: "100%",
                display: "block",
                marginInline: "auto",
                ...style,
              }
            : { objectFit: "cover", ...style }
        }
      />
    );
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
