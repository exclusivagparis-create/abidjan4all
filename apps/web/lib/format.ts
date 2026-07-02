const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const DATE_FULL_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const formatDate = (d: Date | null) => (d ? DATE_FMT.format(d) : "");
export const formatDateFull = (d: Date | null) => (d ? DATE_FULL_FMT.format(d) : "");

/** « AK » pour « Awa Koné » — avatars initiales de la maquette. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => (w[0] ?? "").toUpperCase())
    .join("");
}
