import { prisma } from "@a4a/db";

/**
 * Accès recruteur à la CVthèque (pilier 5 du Business Model 2026-2031).
 *
 * Les CV restent visibles de tous — c'est l'intérêt des candidats et du
 * référencement. Seules les COORDONNÉES (e-mail, téléphone) sont réservées aux
 * recruteurs abonnés : c'est ce qui se vend.
 */

/** Rôles qui voient les coordonnées sans abonnement (support, modération). */
const ROLES_ACCES_TOTAL = ["editor", "admin"];

/** L'accès recruteur en cours de validité d'un compte, s'il existe. */
export async function accesRecruteurActif(userId: string | undefined) {
  if (!userId) return null;
  const acces = await prisma.recruiterAccess.findUnique({ where: { userId } });
  return acces && acces.expiresAt > new Date() ? acces : null;
}

/** Le visiteur peut-il voir les coordonnées des candidats ? */
export async function peutVoirCoordonnees(
  user: { id: string; role?: string } | undefined
): Promise<boolean> {
  if (!user) return false;
  if (user.role && ROLES_ACCES_TOTAL.includes(user.role)) return true;
  return (await accesRecruteurActif(user.id)) !== null;
}

/**
 * Ouvre ou prolonge l'accès recruteur. Une prolongation repart de l'échéance
 * en cours si elle est future — les jours déjà payés ne sont jamais perdus.
 */
export async function ouvrirAccesRecruteur(params: {
  userId: string;
  tier: string;
  jours: number;
  orderId?: string;
}) {
  const existant = await prisma.recruiterAccess.findUnique({ where: { userId: params.userId } });
  const now = new Date();
  const base = existant && existant.expiresAt > now ? existant.expiresAt : now;
  const expiresAt = new Date(base.getTime() + params.jours * 24 * 3600 * 1000);

  return prisma.recruiterAccess.upsert({
    where: { userId: params.userId },
    create: { userId: params.userId, tier: params.tier, expiresAt, orderId: params.orderId ?? null },
    update: { tier: params.tier, expiresAt, orderId: params.orderId ?? existant?.orderId ?? null },
  });
}
