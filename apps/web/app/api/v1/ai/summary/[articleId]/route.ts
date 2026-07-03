import { prisma, Prisma } from "@a4a/db";
import { summarizeArticle } from "@a4a/ai";
import { apiError } from "@/lib/api";

// GET /api/v1/ai/summary/:articleId → { keyPoints, long } (contrat §IA)
// Généré à la première demande puis mis en cache dans Article.aiSummary.
export async function GET(request: Request, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const article = await prisma.article.findFirst({
    where: { OR: [{ id: articleId }, { slug: articleId }], status: "published" },
  });
  if (!article) return apiError("not_found", "Article introuvable.", 404);

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "1";

  if (article.aiSummary && !force) {
    return Response.json(article.aiSummary);
  }

  const blocks = Array.isArray(article.body) ? article.body : [];
  const text = [article.dek ?? "", ...blocks.map((b) => (b as { text?: string }).text ?? "")].join("\n");

  const summary = await summarizeArticle(article.title, text);
  await prisma.article.update({
    where: { id: article.id },
    data: { aiSummary: summary as unknown as Prisma.InputJsonValue },
  });

  return Response.json(summary);
}
