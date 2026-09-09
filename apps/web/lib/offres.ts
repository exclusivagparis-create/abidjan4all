import { prisma, type Offer } from "@a4a/db";

/**
 * Offres A4A+ : lecture en base et calcul du prix réellement dû.
 *
 * La grille vivait dans une constante TypeScript (`PLANS`) : la rédaction ne
 * pouvait ni corriger un prix ni ouvrir une offre sans déploiement. Ce module
 * la remplace ; `@a4a/payments` ne garde que l'abstraction des prestataires.
 *
 * Le prix affiché et le prix encaissé sont calculés ICI et nulle part
 * ailleurs : c'est la seule façon qu'une remise ne s'applique pas à moitié —
 * annoncée sur la page publique mais absente du montant débité, ou l'inverse.
 */

/** Offre enrichie du prix effectif : ce que la page publique et le checkout manipulent. */
export interface OffreVue {
  id: string;
  name: string;
  tagline: string;
  /** Prix catalogue, avant remise. */
  prixCatalogue: number;
  /** Prix réellement dû ce jour. Égal au catalogue si aucune remise ne court. */
  prix: number;
  /** Vrai si une remise est active à l'instant du calcul. */
  remise: boolean;
  /** Économie en francs (0 sans remise). */
  economie: number;
  /** Mention affichée à côté du prix barré, si la rédaction en a saisi une. */
  remiseLabel: string | null;
  features: string[];
  highlight: boolean;
  active: boolean;
  ordre: number;
}

/**
 * Prix dû pour une offre à une date donnée.
 *
 * Trois garde-fous, chacun pour une erreur de saisie déjà vue ailleurs :
 * une remise hors de sa fenêtre ne s'applique pas ; un pourcentage est borné
 * à 100 ; le résultat ne descend jamais sous zéro — une remise en francs
 * supérieure au prix donnerait sinon un montant négatif envoyé au prestataire.
 */
export function prixDu(offer: Offer, at: Date = new Date()): { prix: number; remise: boolean; economie: number } {
  const catalogue = Math.max(0, offer.price);
  if (offer.discountKind === "none" || offer.discountValue <= 0) {
    return { prix: catalogue, remise: false, economie: 0 };
  }
  if (offer.discountFrom && at < offer.discountFrom) return { prix: catalogue, remise: false, economie: 0 };
  if (offer.discountTo && at > offer.discountTo) return { prix: catalogue, remise: false, economie: 0 };

  const brut =
    offer.discountKind === "percent"
      ? Math.round((catalogue * (100 - Math.min(100, offer.discountValue))) / 100)
      : catalogue - offer.discountValue;

  const prix = Math.max(0, brut);
  return { prix, remise: prix < catalogue, economie: catalogue - prix };
}

function vue(offer: Offer, at: Date = new Date()): OffreVue {
  const { prix, remise, economie } = prixDu(offer, at);
  return {
    id: offer.id,
    name: offer.name,
    tagline: offer.tagline,
    prixCatalogue: offer.price,
    prix,
    remise,
    economie,
    remiseLabel: remise ? offer.discountLabel : null,
    features: offer.features,
    highlight: offer.highlight,
    active: offer.active,
    ordre: offer.ordre,
  };
}

/**
 * Offres proposées aux lecteurs : actives et payantes.
 *
 * « free » est exclue — elle n'existe qu'à des fins de clé étrangère, pour les
 * comptes sans abonnement, et n'a jamais été une offre commerciale.
 */
export async function offresPubliques(at: Date = new Date()): Promise<OffreVue[]> {
  const offers = await prisma.offer.findMany({
    where: { active: true, id: { not: "free" }, price: { gt: 0 } },
    orderBy: [{ ordre: "asc" }, { price: "asc" }],
  });
  return offers.map((o) => vue(o, at));
}

/** Toutes les offres, actives ou non — vue d'administration. */
export async function toutesLesOffres(at: Date = new Date()): Promise<OffreVue[]> {
  const offers = await prisma.offer.findMany({
    where: { id: { not: "free" } },
    orderBy: [{ ordre: "asc" }, { price: "asc" }],
  });
  return offers.map((o) => vue(o, at));
}

/** Une offre par son slug, remise appliquée. `null` si inconnue. */
export async function offreParId(id: string, at: Date = new Date()): Promise<OffreVue | null> {
  const offer = await prisma.offer.findUnique({ where: { id } });
  return offer ? vue(offer, at) : null;
}

/**
 * Libellés d'offres pour l'affichage d'un abonnement existant (espace membre,
 * liste des abonnés, facture). Passe par la base : une offre désactivée doit
 * continuer de s'afficher correctement pour ceux qui la détiennent encore.
 */
export async function libellesOffres(): Promise<Map<string, string>> {
  const offers = await prisma.offer.findMany({ select: { id: true, name: true } });
  return new Map(offers.map((o) => [o.id, o.name]));
}
