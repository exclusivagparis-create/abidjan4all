import { z } from "zod";
import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";
import { auth } from "@/auth";

async function findArticle(idOrSlug: string) {
  return prisma.article.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true },
  });
}

// GET /api/v1/articles/:id/comments — approuvés uniquement
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await findArticle(slug);
  if (!article) return apiError("not_found", "Article introuvable.", 404);

  const comments = await prisma.comment.findMany({
    where: { articleId: article.id, status: "approved" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      body: true,
      reactions: true,
      parentId: true,
      createdAt: true,
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
  return Response.json(comments);
}

const CommentInput = z.object({
  body: z.string().trim().min(3).max(2000),
  parentId: z.string().optional(),
});

// POST /api/v1/articles/:id/comments (auth) — status=pending → modération
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);

  const { slug } = await params;
  const article = await findArticle(slug);
  if (!article) return apiError("not_found", "Article introuvable.", 404);

  const parsed = CommentInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", parsed.error.issues[0]?.message ?? "Corps invalide.", 400);

  const comment = await prisma.comment.create({
    data: {
      articleId: article.id,
      userId: session.user.id,
      body: parsed.data.body,
      parentId: parsed.data.parentId ?? null,
      status: "pending",
    },
  });
  return Response.json(comment, { status: 201 });
}
