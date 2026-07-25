import type { AdFormat } from "@a4a/db";

/**
 * Grilles tarifaires commerciales — source unique, ajustable ici.
 * Montants en FCFA (XOF). Servent la page publique /publicite, la monétisation
 * des annonces (emploi/immobilier) et l'adhésion WhatsApp Club.
 */

/** Formats publicitaires et CPM (coût pour mille impressions). */
export type TarifPub = {
  format: AdFormat;
  label: string;
  dimensions: string;
  cpm: number;
  description: string;
};

export const TARIFS_PUB: TarifPub[] = [
  {
    format: "leaderboard_728x90",
    label: "Bandeau (leaderboard)",
    dimensions: "728 × 90",
    cpm: 3000,
    description: "En-tête de rubrique, pleine largeur — la plus forte visibilité.",
  },
  {
    format: "mpu_300x250",
    label: "Pavé (rectangle)",
    dimensions: "300 × 250",
    cpm: 2500,
    description: "Encart en colonne, au fil de la lecture.",
  },
  {
    format: "native",
    label: "Natif in-feed",
    dimensions: "Responsive",
    cpm: 4000,
    description: "Intégré au flux d'articles, mention « Publicité ».",
  },
  {
    format: "interstitial",
    label: "Interstitiel mobile",
    dimensions: "Plein écran",
    cpm: 5000,
    description: "Plein écran mobile, une fois par session, fermable.",
  },
];

/** Communiqué partenaire : article sponsorisé rédigé et signé « partenaire ». */
export const COMMUNIQUE_PARTENAIRE = {
  min: 150000,
  max: 300000,
  formules: [
    { id: "standard", label: "Communiqué standard", prix: 150000, description: "Article sponsorisé publié 30 jours, partagé une fois en newsletter." },
    { id: "premium", label: "Communiqué premium", prix: 300000, description: "Mise en avant accueil 7 jours, partage réseaux + newsletter, référencement prolongé." },
  ],
} as const;

/** Palier tarifaire d'une annonce payante : prix pour une durée de publication. */
export type PalierAnnonce = { id: string; label: string; prix: number; jours: number; description: string };

export const TARIFS_EMPLOI: PalierAnnonce[] = [
  { id: "standard", label: "Standard", prix: 15000, jours: 30, description: "Publication 30 jours dans la bourse d'emploi." },
  { id: "booster", label: "Booster", prix: 30000, jours: 45, description: "45 jours + remontée en tête de liste chaque semaine." },
  { id: "premium", label: "Premium", prix: 50000, jours: 60, description: "60 jours + mise en avant + relais newsletter." },
];

export const TARIFS_IMMO: PalierAnnonce[] = [
  { id: "essentiel", label: "Essentiel", prix: 5000, jours: 15, description: "Annonce immobilière visible 15 jours." },
  { id: "confort", label: "Confort", prix: 12000, jours: 30, description: "30 jours de visibilité." },
  { id: "vitrine", label: "Vitrine", prix: 25000, jours: 60, description: "60 jours + mise en avant de la rubrique immobilier." },
];

/** Adhésion WhatsApp Club : accès au groupe privé pour une durée donnée. */
export const TARIFS_WHATSAPP: PalierAnnonce[] = [
  { id: "mensuel", label: "Mensuel", prix: 2000, jours: 30, description: "Accès 1 mois au groupe WhatsApp privé A4A." },
  { id: "trimestriel", label: "Trimestriel", prix: 5000, jours: 90, description: "Accès 3 mois — deux mois offerts sur le tarif mensuel." },
  { id: "annuel", label: "Annuel", prix: 15000, jours: 365, description: "Accès 12 mois au meilleur tarif." },
];

/**
 * Packs de réservation d'emplacement en self-service (page /publicite) : prix
 * forfaitaire par format et par durée. La grille VIVANTE est en base (AdPack,
 * éditable au Studio /admin/ads/tarifs) — celle-ci n'est plus que le repli si
 * la table est vide, et la référence des anciennes commandes (lib/packs.ts).
 */
export type PackPub = PalierAnnonce & { format: AdFormat };

export const PACKS_PUB: PackPub[] = [
  { id: "bandeau-7", format: "leaderboard_728x90", label: "Bandeau 728×90 — 7 jours", jours: 7, prix: 40000, description: "Bandeau en tête de page, 7 jours." },
  { id: "bandeau-15", format: "leaderboard_728x90", label: "Bandeau 728×90 — 15 jours", jours: 15, prix: 75000, description: "Bandeau en tête de page, 15 jours." },
  { id: "bandeau-30", format: "leaderboard_728x90", label: "Bandeau 728×90 — 30 jours", jours: 30, prix: 130000, description: "Bandeau en tête de page, 30 jours." },
  { id: "pave-7", format: "mpu_300x250", label: "Pavé 300×250 — 7 jours", jours: 7, prix: 30000, description: "Pavé en colonne / dans le contenu, 7 jours." },
  { id: "pave-15", format: "mpu_300x250", label: "Pavé 300×250 — 15 jours", jours: 15, prix: 55000, description: "Pavé en colonne / dans le contenu, 15 jours." },
  { id: "pave-30", format: "mpu_300x250", label: "Pavé 300×250 — 30 jours", jours: 30, prix: 95000, description: "Pavé en colonne / dans le contenu, 30 jours." },
  { id: "natif-7", format: "native", label: "Natif in-feed — 7 jours", jours: 7, prix: 50000, description: "Encart natif au fil des articles, 7 jours." },
  { id: "natif-15", format: "native", label: "Natif in-feed — 15 jours", jours: 15, prix: 90000, description: "Encart natif au fil des articles, 15 jours." },
  { id: "natif-30", format: "native", label: "Natif in-feed — 30 jours", jours: 30, prix: 160000, description: "Encart natif au fil des articles, 30 jours." },
  { id: "video-7", format: "video", label: "Encart vidéo — 7 jours", jours: 7, prix: 45000, description: "Encart sponsor sur la page Vidéos, 7 jours." },
  { id: "video-15", format: "video", label: "Encart vidéo — 15 jours", jours: 15, prix: 80000, description: "Encart sponsor sur la page Vidéos, 15 jours." },
  { id: "video-30", format: "video", label: "Encart vidéo — 30 jours", jours: 30, prix: 140000, description: "Encart sponsor sur la page Vidéos, 30 jours." },
];

/** Retrouve un palier par identifiant dans une grille donnée. */
export function trouverPalier(grille: PalierAnnonce[], id: string): PalierAnnonce | undefined {
  return grille.find((p) => p.id === id);
}

/**
 * Formatage FCFA sûr côté client — identique à `formatXOF` de `@a4a/payments`
 * sans en importer le module (qui dépend de `node:crypto` et casserait le
 * bundle navigateur d'un composant client).
 */
export function formatFCFA(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}
