/**
 * GET /api/v1/articles/slugs — slugs des articles correspondant à un filtre.
 *
 * Sert la sélection « tous les articles du filtre » du Studio. Sans elle, la
 * sélection se limite aux lignes visibles : apurer six mille brouillons
 * demanderait cent vingt-huit passages, et le champ de confirmation prévu
 * au-delà de cent articles ne pourrait jamais s'afficher.
 *
 * Ne renvoie que des slugs, jamais de contenu : c'est une liste de cibles, pas
 * une extraction. Plafonnée à MAX_SLUGS, la limite d'une opération.
 */
import { prisma, type Prisma, type ArticleStatus } from "@a4a/db";
import { apiError } from "@/lib/api";
import { autorise, identifier } from "@/lib/api-auth";
import { MAX_SLUGS } from "@/lib/suppression-articles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUTS: ArticleStatus[] = ["draft", "review", "scheduled", "published"];

export async function GET(request: Request) {
  const moi = await identifier(request);
  if (!moi) return apiError("unauthorized", "Authentification requise.", 401);
  if (!autorise(moi, "articles:delete")) {
    return apiError("forbidden", "Réservé à l'administration et à la rédaction en chef.", 403);
  }

  const { searchParams } = new URL(request.url);
  const statut = searchParams.get("statut") ?? "";
  const q = (searchParams.get("q") ?? "").trim();
  const rubrique = searchParams.get("rubrique") ?? "";

  const where: Prisma.ArticleWhereInput = {
    ...(STATUTS.includes(statut as ArticleStatus) ? { status: statut as ArticleStatus } : {}),
    ...(rubrique ? { rubrique: { slug: rubrique } } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const lignes = await prisma.article.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: MAX_SLUGS,
    select: { slug: true },
  });
  const slugs = lignes.map((l) => l.slug);

  // Décompte des statuts sensibles sur les slugs RÉELLEMENT retenus, et non
  // sur le filtre entier : au-delà du plafond, les deux diffèrent, et
  // l'avertissement affiché doit décrire ce qui va vraiment être supprimé.
  const [total, publies, programmes] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.count({ where: { slug: { in: slugs }, status: "published" } }),
    prisma.article.count({ where: { slug: { in: slugs }, status: "scheduled" } }),
  ]);

  return Response.json({
    slugs,
    total,
    /** Vrai quand le filtre dépasse le plafond : l'interface doit le dire. */
    tronque: total > slugs.length,
    publies,
    programmes,
  });
}
