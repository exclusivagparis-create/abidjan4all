import { prisma, Prisma } from "@a4a/db";
import { articleListSelect, pagination } from "@/lib/api";

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
