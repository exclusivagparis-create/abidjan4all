/**
 * Les rubriques éditoriales et leur couleur d'identité.
 * Source : README du handoff §Design tokens (13 rubriques + Sport).
 * La liste canonique vit en base (table Rubrique) ; ceci est le référentiel visuel.
 */
export interface RubriqueToken {
  slug: string;
  name: string;
  color: string;
  cssVar: string;
}

export const RUBRIQUES: RubriqueToken[] = [
  { slug: "cacao", name: "Cacao & Marchés", color: "#8A5A2B", cssVar: "--rub-cacao" },
  { slug: "diaspora", name: "Diaspora", color: "#2E5AAC", cssVar: "--rub-diaspora" },
  { slug: "business", name: "Business", color: "#0E8A5F", cssVar: "--rub-business" },
  { slug: "femmes", name: "Femmes", color: "#B0347A", cssVar: "--rub-femmes" },
  { slug: "environnement", name: "Environnement", color: "#3C8F4E", cssVar: "--rub-environnement" },
  { slug: "videos", name: "Vidéos", color: "#D6282D", cssVar: "--rub-videos" },
  { slug: "direct", name: "En Direct", color: "#E8641A", cssVar: "--rub-direct" },
  { slug: "english", name: "Africa in English", color: "#147C82", cssVar: "--rub-english" },
  { slug: "tourisme", name: "Tourisme", color: "#C98A17", cssVar: "--rub-tourisme" },
  { slug: "religion", name: "Religion", color: "#6A5AA6", cssVar: "--rub-religion" },
  { slug: "politique", name: "Politique", color: "#364152", cssVar: "--rub-politique" },
  { slug: "economie", name: "Économie", color: "#1A6E8E", cssVar: "--rub-economie" },
  { slug: "culture", name: "Culture", color: "#C0562B", cssVar: "--rub-culture" },
  { slug: "sport", name: "Sport", color: "#157A3B", cssVar: "--rub-sport" },
];

export function rubriqueBySlug(slug: string): RubriqueToken | undefined {
  return RUBRIQUES.find((r) => r.slug === slug);
}
