import { prisma } from "@a4a/db";
import { PACKS_PUB, type PackPub } from "@/lib/tarifs";

/**
 * Grille des prix des packs self-service, lue en base (éditable au Studio,
 * /admin/ads/tarifs). PACKS_PUB (lib/tarifs.ts) reste le repli si la table est
 * vide — même filet de sécurité que le menu par défaut : aucune manipulation
 * ne peut laisser la page de réservation sans offre.
 */

type AdPackRow = Awaited<ReturnType<typeof prisma.adPack.findMany>>[number];

function toPackPub(row: AdPackRow): PackPub {
  return {
    id: row.id,
    format: row.format,
    label: row.label,
    jours: row.jours,
    prix: row.prix,
    description: row.description,
  };
}

/**
 * Packs en vente (formulaire de réservation, page /publicite). Le repli sur la
 * grille par défaut ne joue que si la table est entièrement VIDE : si la régie
 * a retiré tous les packs de la vente, la vente est bien fermée (liste vide).
 */
export async function listActivePacks(): Promise<PackPub[]> {
  const rows = await prisma.adPack.findMany({ orderBy: [{ ordre: "asc" }, { jours: "asc" }] });
  if (rows.length === 0) return PACKS_PUB;
  return rows.filter((r) => r.actif).map(toPackPub);
}

/**
 * Retrouve un pack par identifiant, y compris retiré de la vente : une
 * commande en attente de paiement peut référencer un pack désactivé entre
 * temps. Repli sur la grille par défaut (commandes antérieures à la table).
 */
export async function trouverPack(id: string): Promise<PackPub | undefined> {
  const row = await prisma.adPack.findUnique({ where: { id } });
  if (row) return toPackPub(row);
  return PACKS_PUB.find((p) => p.id === id);
}
