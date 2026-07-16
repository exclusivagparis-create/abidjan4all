const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const DATE_FULL_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const formatDate = (d: Date | null) => (d ? DATE_FMT.format(d) : "");
export const formatDateFull = (d: Date | null) => (d ? DATE_FULL_FMT.format(d) : "");

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
