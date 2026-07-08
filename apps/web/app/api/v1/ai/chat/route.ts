import { z } from "zod";
import { prisma } from "@a4a/db";
import { chatReply, type SearchSource } from "@a4a/ai";
import { apiError } from "@/lib/api";
import { absoluteUrl } from "@/lib/seo";
import { searchArticles } from "@/lib/search";

const ChatInput = z.object({
  message: z.string().trim().min(2).max(1000),
  articleId: z.string().optional(),
});

// POST /api/v1/ai/chat { message, articleId? } → { reply, sources } (contrat §IA)
// Contexte : l'article courant s'il est fourni, complété par la recherche interne.
export async function POST(request: Request) {
  const parsed = ChatInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "message requis (2 à 1000 caractères).", 400);

  const { message, articleId } = parsed.data;
  const sources: SearchSource[] = [];

  if (articleId) {
    const article = await prisma.article.findFirst({
      where: { OR: [{ id: articleId }, { slug: articleId }], status: "published" },
      include: { rubrique: { select: { slug: true } } },
    });
    if (article) {
      const blocks = Array.isArray(article.body) ? article.body : [];
      const text = [article.dek ?? "", ...blocks.map((b) => (b as { text?: string }).text ?? "")]
        .filter(Boolean)
        .join(" ");
      sources.push({
        title: article.title,
        url: absoluteUrl(`/${article.rubrique.slug}/${article.slug}`),
        snippet: text.slice(0, 800),
      });
    }
  }

  const { results } = await searchArticles({ q: message, limit: 4 });
  for (const r of results) {
    if (sources.some((s) => s.url.endsWith(`/${r.slug}`))) continue;
    sources.push({
      title: r.title,
      url: absoluteUrl(`/${r.rubriqueSlug}/${r.slug}`),
      snippet: r.snippet.replace(/<\/?mark>/g, ""),
    });
  }

  const { reply, sources: used, engine } = await chatReply(message, sources.slice(0, 5));
  return Response.json({ reply, sources: used, engine });
}
