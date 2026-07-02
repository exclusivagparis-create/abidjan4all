import { rubriqueBySlug } from "./rubriques";

export interface RubriqueBadgeProps {
  slug: string;
  /** Libellé de remplacement (sinon celui du référentiel). */
  label?: string;
  /** Couleur d'identité (ex. venue de la table Rubrique) ; sinon celle du référentiel. */
  color?: string;
}

/** Étiquette de rubrique : capitale, espacée, dans la couleur d'identité. */
export function RubriqueBadge({ slug, label, color: colorProp }: RubriqueBadgeProps) {
  const rubrique = rubriqueBySlug(slug);
  const color =
    colorProp ?? (rubrique ? `var(${rubrique.cssVar}, ${rubrique.color})` : "var(--ink-3)");
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "var(--radius-pill)",
          background: color,
        }}
      />
      {label ?? rubrique?.name ?? slug}
    </span>
  );
}
