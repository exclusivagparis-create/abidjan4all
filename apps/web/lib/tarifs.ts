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

/** Retrouve un palier par identifiant dans une grille donnée. */
export function trouverPalier(grille: PalierAnnonce[], id: string): PalierAnnonce | undefined {
  return grille.find((p) => p.id === id);
}
