import { answerFromSources } from "@a4a/ai";
import { apiError } from "@/lib/api";
import { absoluteUrl } from "@/lib/seo";
import { searchArticles } from "@/lib/search";
import { adresseAppelant, limiter, reponseTropDeRequetes } from "@/lib/limite-debit";

// GET /api/v1/ai/search?q= → { answer, sources, results } (contrat §Recherche)
export async function GET(request: Request) {
  // Ces routes appellent un modèle payant : sans plafond, un simple script
  // pouvait vider le budget en une nuit. Le compte n'est pas exigé — la
  // fonction sert au lectorat anonyme — mais la cadence, si.
  {
    const v = limiter(`ia-recherche:${adresseAppelant(request)}`, 30, 3600);
    if (!v.autorise) return reponseTropDeRequetes(v.attendre);
  }

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
