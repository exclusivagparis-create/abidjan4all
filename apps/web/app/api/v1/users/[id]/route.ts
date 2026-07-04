import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";

// GET /api/v1/users/:id → profil public (DF-04 communauté — jamais l'email)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      country: true,
      bio: true,
      verified: true,
      createdAt: true,
      badges: { select: { slug: true, label: true } },
      groups: { select: { slug: true, name: true, color: true, membersCount: true } },
      _count: {
        select: { comments: { where: { status: "approved" } }, articles: { where: { status: "published" } } },
      },
    },
  });
  if (!user) return apiError("not_found", "Membre introuvable.", 404);

  const { _count, ...profile } = user;
  return Response.json({ ...profile, commentsCount: _count.comments, articlesCount: _count.articles });
}
