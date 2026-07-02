import { prisma } from "@a4a/db";

export async function GET() {
  const rubriques = await prisma.rubrique.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { articles: { where: { status: "published" } } } } },
  });
  return Response.json(
    rubriques.map(({ _count, ...r }) => ({ ...r, articlesCount: _count.articles }))
  );
}
