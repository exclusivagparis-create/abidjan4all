import { z } from "zod";
import { prisma, Prisma } from "@a4a/db";
import { apiError } from "@/lib/api";
import { auth, PUBLISH_ROLES } from "@/auth";

// GET /api/v1/articles/:slug — body complet ; 402 si premium & non-abonné
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await prisma.article.findFirst({
    where: { slug, status: "published" },
    include: {
      rubrique: { select: { slug: true, name: true, color: true } },
      author: { select: { name: true, bio: true, avatarUrl: true } },
      coverAsset: { select: { url: true, alt: true, credit: true } },
    },
  });
  if (!article) return apiError("not_found", "Article introuvable.", 404);

  // TODO(DF-03) : lever la restriction pour les abonnés authentifiés (Auth.js + Subscription)
  if (article.premium) {
    const teaser = Array.isArray(article.body) ? article.body.slice(0, 2) : article.body;
    return Response.json(
      {
        error: { code: "premium_required", message: "Cet article est réservé aux abonnés A4A+." },
        article: { ...article, body: teaser, bodyTruncated: true },
      },
      { status: 402 }
    );
  }

  return Response.json(article);
}

const ArticlePatchSchema = z.object({
  status: z.enum(["draft", "review", "scheduled", "published"]).optional(),
  title: z.string().min(3).optional(),
  kicker: z.string().nullable().optional(),
  dek: z.string().nullable().optional(),
  body: z.array(z.record(z.unknown())).optional(),
  rubriqueId: z.string().optional(),
  premium: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  readingTime: z.number().int().min(1).optional(),
});

async function findByIdOrSlug(idOrSlug: string) {
  return prisma.article.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] } });
}

// PATCH /api/v1/articles/:id (editor+) — workflow draft→review→scheduled→published
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);
  if (!PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    return apiError("forbidden", "Rôle editor ou admin requis.", 403);
  }

  const { slug: idOrSlug } = await params;
  const article = await findByIdOrSlug(idOrSlug);
  if (!article) return apiError("not_found", "Article introuvable.", 404);

  const parsed = ArticlePatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError("invalid_input", parsed.error.issues[0]?.message ?? "Corps invalide.", 400);
  }
  const { status, scheduledAt, body, ...rest } = parsed.data;

  const data: Prisma.ArticleUncheckedUpdateInput = { ...rest };
  if (body !== undefined) data.body = body as Prisma.InputJsonValue;
  if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
  if (status) {
    data.status = status;
    if (status === "published") data.publishedAt = article.publishedAt ?? new Date();
  }

  const updated = await prisma.article.update({ where: { id: article.id }, data });
  return Response.json(updated);
}

// DELETE /api/v1/articles/:id (admin)
export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);
  if (session.user.role !== "admin") return apiError("forbidden", "Rôle admin requis.", 403);

  const { slug: idOrSlug } = await params;
  const article = await findByIdOrSlug(idOrSlug);
  if (!article) return apiError("not_found", "Article introuvable.", 404);

  await prisma.article.delete({ where: { id: article.id } });
  return new Response(null, { status: 204 });
}
