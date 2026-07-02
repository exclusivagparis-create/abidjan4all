import { z } from "zod";
import { prisma, Prisma } from "@a4a/db";
import { apiError, articleListSelect, pagination } from "@/lib/api";
import { auth, PUBLISH_ROLES } from "@/auth";

// GET /api/v1/articles?rubrique=&premium=&page=&limit=
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { page, limit, skip, take } = pagination(searchParams);

  const where: Prisma.ArticleWhereInput = { status: "published" };
  const rubrique = searchParams.get("rubrique");
  if (rubrique) where.rubrique = { slug: rubrique };
  const premium = searchParams.get("premium");
  if (premium === "true" || premium === "false") where.premium = premium === "true";

  const [data, total] = await Promise.all([
    prisma.article.findMany({
      where,
      select: articleListSelect,
      orderBy: { publishedAt: "desc" },
      skip,
      take,
    }),
    prisma.article.count({ where }),
  ]);

  return Response.json({ data, meta: { page, limit, total } });
}

const ArticleCreateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,80}$/),
  title: z.string().min(3),
  kicker: z.string().optional(),
  dek: z.string().optional(),
  body: z.array(z.record(z.unknown())).default([]),
  rubriqueId: z.string().min(1),
  premium: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  readingTime: z.number().int().min(1).default(1),
});

// POST /api/v1/articles (editor+) — création en brouillon
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);
  if (!PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    return apiError("forbidden", "Rôle editor ou admin requis.", 403);
  }

  const parsed = ArticleCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError("invalid_input", parsed.error.issues[0]?.message ?? "Corps invalide.", 400);
  }
  const input = parsed.data;

  if (await prisma.article.findUnique({ where: { slug: input.slug } })) {
    return apiError("slug_taken", "Ce slug existe déjà.", 409);
  }

  const article = await prisma.article.create({
    data: {
      ...input,
      body: input.body as Prisma.InputJsonValue,
      status: "draft",
      authorId: session.user.id,
      seo: { metaTitle: input.title, metaDescription: input.dek ?? "" } as Prisma.InputJsonValue,
    },
  });
  return Response.json(article, { status: 201 });
}
