import { prisma, type BriefKind } from "@a4a/db";

/**
 * A4A Intelligence — pilier B2B du Business Model 2026-2031.
 *
 * Une SÉRIE est un produit d'abonnement (rapport mensuel, revue trimestrielle,
 * classement annuel…) ; ses ÉDITIONS sont les livraisons. Le résumé d'une
 * édition est public ; son corps et son PDF sont réservés aux abonnés en cours
 * de validité — l'administration voit tout, pour relire avant diffusion.
 */

export const KIND_LABEL: Record<BriefKind, string> = {
  rapport: "Rapport périodique",
  revue: "Revue",
  classement: "Classement",
  etude: "Étude sur mesure",
  revue_presse: "Revue de presse",
};

/** Rôles qui consultent les éditions sans abonnement (relecture éditoriale). */
const ROLES_ACCES_TOTAL = ["editor", "admin"];

/** Séries en vente, dans l'ordre de la vitrine. */
export function listSeriesActives() {
  return prisma.briefSerie.findMany({
    where: { actif: true },
    orderBy: [{ ordre: "asc" }, { title: "asc" }],
  });
}

/**
 * L'abonnement en cours de validité d'un compte à une série, s'il existe.
 * `null` pour un visiteur anonyme.
 */
export async function abonnementActif(userId: string | undefined, serieId: string) {
  if (!userId) return null;
  const ab = await prisma.briefAbonnement.findUnique({
    where: { userId_serieId: { userId, serieId } },
  });
  return ab && ab.expiresAt > new Date() ? ab : null;
}

/** Toutes les séries auxquelles un compte est abonné et encore à jour. */
export function mesAbonnements(userId: string) {
  return prisma.briefAbonnement.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    include: { serie: true },
    orderBy: { expiresAt: "desc" },
  });
}

/**
 * Le compte peut-il lire l'intégralité des éditions de cette série ?
 * Abonnement valide, ou rôle éditorial (relecture avant diffusion).
 */
export async function peutLireEditions(
  user: { id: string; role?: string } | undefined,
  serieId: string
): Promise<boolean> {
  if (!user) return false;
  if (user.role && ROLES_ACCES_TOTAL.includes(user.role)) return true;
  return (await abonnementActif(user.id, serieId)) !== null;
}

/**
 * Ouvre ou prolonge l'abonnement d'un compte à une série. Une prolongation
 * repart de l'échéance en cours si elle est future — l'abonné ne perd jamais
 * les mois déjà payés en se réabonnant en avance.
 */
export async function ouvrirAbonnement(params: {
  userId: string;
  serieId: string;
  dureeMois: number;
  orderId?: string;
}) {
  const existant = await prisma.briefAbonnement.findUnique({
    where: { userId_serieId: { userId: params.userId, serieId: params.serieId } },
  });
  const now = new Date();
  const base = existant && existant.expiresAt > now ? existant.expiresAt : now;
  const expiresAt = new Date(base);
  expiresAt.setMonth(expiresAt.getMonth() + params.dureeMois);

  return prisma.briefAbonnement.upsert({
    where: { userId_serieId: { userId: params.userId, serieId: params.serieId } },
    create: {
      userId: params.userId,
      serieId: params.serieId,
      startAt: now,
      expiresAt,
      orderId: params.orderId ?? null,
    },
    update: { expiresAt, orderId: params.orderId ?? existant?.orderId ?? null },
  });
}
