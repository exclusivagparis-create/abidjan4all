import { prisma } from "@a4a/db";
import { apiError, articleListSelect } from "@/lib/api";
import { auth } from "@/auth";

// GET /api/v1/ai/recommendations (auth) → [Article] « Pour vous » (contrat §IA).
// Scoring déterministe : rubriques suivies (interests) et favoris d'abord,
// complété par les plus récents — pas d'appel LLM nécessaire.
export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { interests: true, favorites: { select: { id: true, rubriqueId: true } } },
  });
  if (!user) return apiError("unauthorized", "Compte introuvable — reconnectez-vous.", 401);

  // Rubriques implicites : celles des favoris s'ajoutent aux intérêts déclarés.
  const rubriqueIds = new Set(user.interests);
  for (const f of user.favorites) rubriqueIds.add(f.rubriqueId);
  const favoriteIds = new Set(user.favorites.map((f) => f.id));

  const LIMIT = 12;
  const preferred =
    rubriqueIds.size > 0
      ? await prisma.article.findMany({
          where: {
            status: "published",
            rubriqueId: { in: [...rubriqueIds] },
            id: { notIn: [...favoriteIds] }, // déjà lus/gardés — pas la peine
          },
          orderBy: { publishedAt: "desc" },
          take: LIMIT,
          select: articleListSelect,
        })
      : [];

  // Complément : les plus récents hors doublons, pour toujours remplir le bloc.
  const fill =
    preferred.length < LIMIT
      ? await prisma.article.findMany({
          where: {
            status: "published",
            id: { notIn: [...preferred.map((a) => a.id), ...favoriteIds] },
          },
          orderBy: { publishedAt: "desc" },
          take: LIMIT - preferred.length,
          select: articleListSelect,
        })
      : [];

  return Response.json({ data: [...preferred, ...fill], meta: { basis: rubriqueIds.size > 0 ? "interests" : "recent" } });
}
