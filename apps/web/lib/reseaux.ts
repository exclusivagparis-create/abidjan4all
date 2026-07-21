/**
 * Réseaux sociaux officiels d'Abidjan4All.
 * Renseignez l'URL de chaque compte pour activer son lien : un réseau dont
 * l'`href` est vide n'est PAS affiché (aucun lien mort en production).
 */
export type ReseauSocial = { name: string; label: string; href: string; glyph: string };

export const RESEAUX_SOCIAUX: ReseauSocial[] = [
  { name: "facebook", label: "Facebook", href: "", glyph: "f" },
  { name: "x", label: "X (Twitter)", href: "", glyph: "𝕏" },
  { name: "whatsapp", label: "WhatsApp", href: "", glyph: "✆" },
  { name: "youtube", label: "YouTube", href: "", glyph: "▶" },
  { name: "tiktok", label: "TikTok", href: "", glyph: "♪" },
  { name: "instagram", label: "Instagram", href: "", glyph: "◎" },
];

/** Réseaux effectivement configurés (URL non vide) — les seuls affichés. */
export const RESEAUX_ACTIFS = RESEAUX_SOCIAUX.filter((r) => r.href.trim() !== "");
