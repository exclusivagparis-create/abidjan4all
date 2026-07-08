import { z } from "zod";
import { prisma } from "@a4a/db";
import { translateArticle } from "@a4a/ai";
import { apiError } from "@/lib/api";

const TranslateInput = z.object({
  articleId: z.string().min(1),
  target: z.enum(["en", "fr"]).default("en"),
});

// POST /api/v1/ai/translate { articleId, target } → { title, body } (contrat §IA)
export async function POST(request: Request) {
  const parsed = TranslateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "articleId requis, target ∈ {en, fr}.", 400);

  const { articleId, target } = parsed.data;
  const article = await prisma.article.findFirst({
    where: { OR: [{ id: articleId }, { slug: articleId }], status: "published" },
  });
  if (!article) return apiError("not_found", "Article introuvable.", 404);

  const blocks = Array.isArray(article.body) ? article.body : [];
  const text = [article.dek ?? "", ...blocks.map((b) => (b as { text?: string }).text ?? "")]
    .filter(Boolean)
    .join("\n");

  const translation = await translateArticle(article.title, text, target);
  return Response.json(translation);
}
