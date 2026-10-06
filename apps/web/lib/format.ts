const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const DATE_FULL_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const formatDate = (d: Date | null) => (d ? DATE_FMT.format(d) : "");
export const formatDateFull = (d: Date | null) => (d ? DATE_FULL_FMT.format(d) : "");

const NOMBRE_FMT = new Intl.NumberFormat("fr-FR");

/**
 * « 1 vue », « 1 240 vues », « 12,4 k vues ».
 *
 * Au-delà de dix mille, le chiffre exact n'apprend plus rien à un lecteur et
 * encombre la ligne : on l'abrège. Le Studio, lui, affiche le compte entier —
 * c'est là qu'on compare deux formats ou qu'on répond à un annonceur.
 */
export function formatVues(n: number): string {
  if (n < 10_000) return `${NOMBRE_FMT.format(n)} vue${n > 1 ? "s" : ""}`;
  const milliers = n / 1000;
  const arrondi = milliers < 100 ? milliers.toFixed(1).replace(".", ",").replace(",0", "") : Math.round(milliers);
  return `${arrondi} k vues`;
}

/** Nombre entier, séparateurs français : « 12 408 ». */
export const formatNombre = (n: number) => NOMBRE_FMT.format(n);

/** « AK » pour « Awa Koné » — avatars initiales de la maquette. */
/**
 * Retire les astérisques d'emphase d'un titre (`*texte*` → `texte`).
 *
 * Vit ici, et non dans le composant RichTitle, pour être utilisable partout
 * où un titre sort en texte nu : <title>, Open Graph, Twitter, JSON-LD, RSS,
 * sitemap Google, newsletter. Ces astérisques sont une convention d'affichage
 * et ne doivent jamais atteindre un lecteur ni un robot.
 */
export function plainTitle(text: string): string {
  return text.replace(/\*([^*]+)\*/g, "$1");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => (w[0] ?? "").toUpperCase())
    .join("");
}
