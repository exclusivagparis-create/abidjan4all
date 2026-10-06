import { prisma } from "@a4a/db";
import { apiError, articleListSelect } from "@/lib/api";
import { auth } from "@/auth";
import { classer, estPersonnalise } from "@/lib/fil-personnalise";

// GET /api/v1/ai/recommendations (auth) → [Article] « Pour vous » (contrat §IA).
// Classement déterministe, sans appel à un modèle : rubriques suivies, favoris
// et pays du compte. La logique est celle du fil personnalisé de l'espace
// membre (`lib/fil-personnalise`) — deux classements différents pour le même
// lecteur selon qu'il passe par le site ou par l'API n'aurait aucun sens.
export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { interests: true, country: true, favorites: { select: { id: true, rubriqueId: true } } },
  });
  if (!user) return apiError("unauthorized", "Compte introuvable — reconnectez-vous.", 401);

  const prefs = {
    interets: user.interests,
    rubriquesDesFavoris: [...new Set(user.favorites.map((f) => f.rubriqueId))],
    pays: user.country,
  };

  const LIMIT = 12;
  const candidats = await prisma.article.findMany({
    where: {
      status: "published",
      hidden: false,
      id: { notIn: user.favorites.map((f) => f.id) }, // déjà gardés — pas la peine
    },
    orderBy: { publishedAt: "desc" },
    take: 120,
    select: { ...articleListSelect, rubriqueId: true },
  });

  const classes = classer(candidats, prefs).slice(0, LIMIT);

  return Response.json({
    data: classes.map(({ article, raison }) => {
      const { rubriqueId: _rubriqueId, ...reste } = article;
      return { ...reste, reason: raison || null };
    }),
    meta: { basis: estPersonnalise(prefs) ? "interests" : "recent" },
  });
}
