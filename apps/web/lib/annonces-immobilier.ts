/**
 * Champs métier des annonces immobilières.
 *
 * Une annonce immobilière ne se cherche pas comme une offre d'emploi : on veut
 * une location à Cocody, trois pièces, moins de 400 000 FCFA. Le titre et la
 * description ne permettent pas ce tri — d'où ces quelques champs, stockés dans
 * la colonne `attributes` de l'annonce, qui existe déjà et accepte du JSON.
 *
 * Pas de migration de base : ces critères n'existent que pour un type d'annonce
 * sur trois, et une colonne par critère laisserait des cases vides partout
 * ailleurs.
 *
 * Module sans accès à la base ni au DOM : la lecture et le filtrage sont du
 * calcul pur, on peut les mettre à l'épreuve seuls.
 */

export const TRANSACTIONS = [
  { id: "vente", label: "Vente" },
  { id: "location", label: "Location" },
] as const;

export type Transaction = (typeof TRANSACTIONS)[number]["id"];

export interface CriteresImmo {
  transaction?: Transaction;
  /** Surface en m². */
  surface?: number;
  /** Nombre de pièces. */
  pieces?: number;
  /** Quartier ou commune : Cocody, Yopougon, Bingerville… */
  quartier?: string;
  /** Contact, déjà stocké auparavant pour tous les types d'annonces. */
  contact?: string;
}

const estTransaction = (v: string): v is Transaction => TRANSACTIONS.some((t) => t.id === v);

/** Nombre positif raisonnable, ou rien : une saisie farfelue ne vaut pas mieux qu'un vide. */
function nombre(brut: unknown, max: number): number | undefined {
  const n = Number(String(brut ?? "").trim());
  if (!Number.isFinite(n) || n <= 0 || n > max) return undefined;
  return Math.round(n);
}

/** Lit les champs métier d'un dépôt d'annonce. Les absents sont omis. */
export function lireCriteres(valeurs: {
  transaction?: unknown;
  surface?: unknown;
  pieces?: unknown;
  quartier?: unknown;
}): CriteresImmo {
  const criteres: CriteresImmo = {};

  const t = String(valeurs.transaction ?? "").trim();
  if (estTransaction(t)) criteres.transaction = t;

  const surface = nombre(valeurs.surface, 100000);
  if (surface) criteres.surface = surface;

  const pieces = nombre(valeurs.pieces, 50);
  if (pieces) criteres.pieces = pieces;

  const quartier = String(valeurs.quartier ?? "").trim().slice(0, 60);
  if (quartier) criteres.quartier = quartier;

  return criteres;
}

/** Relit les critères d'une annonce enregistrée, sans faire confiance au stockage. */
export function criteresDe(attributes: unknown): CriteresImmo {
  if (!attributes || typeof attributes !== "object") return {};
  const a = attributes as Record<string, unknown>;
  const criteres = lireCriteres(a);
  const contact = String(a.contact ?? "").trim();
  if (contact) criteres.contact = contact;
  return criteres;
}

export interface FiltreImmo {
  transaction?: string;
  /** Prix maximum en FCFA. */
  prixMax?: number;
  /** Nombre de pièces minimum. */
  piecesMin?: number;
  /** Quartier recherché, comparé sans accent ni casse. */
  quartier?: string;
}

/** Lit les filtres de l'adresse. Une valeur inconnue est ignorée, pas rejetée. */
export function lireFiltre(params: Record<string, string | string[] | undefined>): FiltreImmo {
  const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const filtre: FiltreImmo = {};

  const t = un(params.transaction).trim();
  if (estTransaction(t)) filtre.transaction = t;

  const prixMax = nombre(un(params.prixMax), 1_000_000_000);
  if (prixMax) filtre.prixMax = prixMax;

  const piecesMin = nombre(un(params.pieces), 50);
  if (piecesMin) filtre.piecesMin = piecesMin;

  const quartier = un(params.quartier).trim().slice(0, 60);
  if (quartier) filtre.quartier = quartier;

  return filtre;
}

const sansAccent = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/**
 * Une annonce passe-t-elle le filtre ?
 *
 * Le quartier est comparé au champ métier ET à la localisation : une annonce
 * déposée avant l'arrivée de ces champs n'a pas de quartier renseigné, mais
 * porte souvent « Abidjan, Cocody » en localisation. L'exclure reviendrait à
 * faire disparaître l'historique des annonces le jour de la mise en service.
 */
export function correspond(
  annonce: { price: number | null; location: string; attributes: unknown },
  filtre: FiltreImmo
): boolean {
  const criteres = criteresDe(annonce.attributes);

  if (filtre.transaction && criteres.transaction !== filtre.transaction) return false;
  if (filtre.prixMax !== undefined && (annonce.price === null || annonce.price > filtre.prixMax)) return false;
  if (filtre.piecesMin !== undefined && (criteres.pieces === undefined || criteres.pieces < filtre.piecesMin)) return false;

  if (filtre.quartier) {
    const cherche = sansAccent(filtre.quartier);
    const dansCriteres = criteres.quartier ? sansAccent(criteres.quartier).includes(cherche) : false;
    const dansLocalisation = sansAccent(annonce.location).includes(cherche);
    if (!dansCriteres && !dansLocalisation) return false;
  }

  return true;
}

/** Résumé affiché sur une carte : « Location · 3 pièces · 85 m² · Cocody ». */
export function resume(criteres: CriteresImmo): string[] {
  const parts: string[] = [];
  if (criteres.transaction) parts.push(TRANSACTIONS.find((t) => t.id === criteres.transaction)!.label);
  if (criteres.pieces) parts.push(`${criteres.pieces} pièce${criteres.pieces > 1 ? "s" : ""}`);
  if (criteres.surface) parts.push(`${criteres.surface} m²`);
  if (criteres.quartier) parts.push(criteres.quartier);
  return parts;
}
