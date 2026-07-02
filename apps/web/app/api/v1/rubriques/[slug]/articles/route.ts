import { prisma } from "@a4a/db";
import { apiError, articleListSelect, pagination } from "@/lib/api";

// GET /api/v1/rubriques/:slug/articles?page=
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rubrique = await prisma.rubrique.findUnique({ where: { slug } });
  if (!rubrique) return apiError("not_found", "Rubrique introuvable.", 404);

  const { searchParams } = new URL(request.url);
  const { page, limit, skip, take } = pagination(searchParams);
  const where = { status: "published" as const, rubriqueId: rubrique.id };

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
