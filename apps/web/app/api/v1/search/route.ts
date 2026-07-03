import { apiError } from "@/lib/api";
import { searchArticles, type SearchPeriod, type SearchSort } from "@/lib/search";

const PERIODS = new Set(["24h", "7j", "30j", "annee"]);
const SORTS = new Set(["pertinence", "recent"]);

// GET /api/v1/search?q=&type=article&rubrique=&period=&sort=&page=&limit=
// → { results, facets } (API_CONTRACTS.md §Recherche)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return apiError("missing_query", "Paramètre q requis.", 400);

  // type=video|podcast : à brancher quand ces contenus seront indexés (DF-05)
  const type = searchParams.get("type") ?? "article";
  if (type !== "article") {
    return Response.json({ results: [], facets: { rubriques: [], types: ["article"] } });
  }

  const period = searchParams.get("period") ?? undefined;
  const sort = searchParams.get("sort") ?? undefined;

  const { results, total, facets, tookMs } = await searchArticles({
    q,
    rubrique: searchParams.get("rubrique") ?? undefined,
    period: period && PERIODS.has(period) ? (period as SearchPeriod) : undefined,
    sort: sort && SORTS.has(sort) ? (sort as SearchSort) : undefined,
    page: Number(searchParams.get("page")) || 1,
    limit: Number(searchParams.get("limit")) || 10,
  });

  return Response.json({ results, facets, meta: { total, tookMs } });
}
