import { answerFromSources } from "@a4a/ai";
import { apiError } from "@/lib/api";
import { absoluteUrl } from "@/lib/seo";
import { searchArticles } from "@/lib/search";

// GET /api/v1/ai/search?q= → { answer, sources, results } (contrat §Recherche)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return apiError("missing_query", "Paramètre q requis.", 400);

  const { results } = await searchArticles({ q, limit: 5 });
  const { answer, sources, engine } = await answerFromSources(
    q,
    results.map((r) => ({
      title: r.title,
      url: absoluteUrl(`/${r.rubriqueSlug}/${r.slug}`),
      snippet: r.snippet.replace(/<\/?mark>/g, ""),
    }))
  );

  return Response.json({ answer, sources, engine, results });
}
