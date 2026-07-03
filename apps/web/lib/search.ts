import { prisma, Prisma } from "@a4a/db";

export type SearchPeriod = "24h" | "7j" | "30j" | "annee";
export type SearchSort = "pertinence" | "recent";

export interface SearchParams {
  q: string;
  rubrique?: string;
  period?: SearchPeriod;
  sort?: SearchSort;
  page?: number;
  limit?: number;
}

export interface SearchResultRow {
  id: string;
  slug: string;
  title: string;
  kicker: string | null;
  premium: boolean;
  publishedAt: Date;
  readingTime: number;
  rubriqueSlug: string;
  rubriqueName: string;
  rubriqueColor: string;
  authorName: string;
  coverUrl: string | null;
  coverAlt: string | null;
  /** extrait ts_headline — contient des <mark>…</mark>, source débarrassée de tout HTML */
  snippet: string;
  rank: number;
}

export interface SearchFacets {
  rubriques: { slug: string; name: string; color: string; count: number }[];
}

export interface SearchResponse {
  results: SearchResultRow[];
  total: number;
  facets: SearchFacets;
  tookMs: number;
}

export const PERIOD_LABELS: Record<SearchPeriod, string> = {
  "24h": "24 heures",
  "7j": "7 jours",
  "30j": "30 jours",
  annee: "Cette année",
};

const PERIOD_SQL: Record<SearchPeriod, Prisma.Sql> = {
  "24h": Prisma.sql`interval '24 hours'`,
  "7j": Prisma.sql`interval '7 days'`,
  "30j": Prisma.sql`interval '30 days'`,
  annee: Prisma.sql`interval '1 year'`,
};

/**
 * Recherche full-text PostgreSQL (config french_unaccent : pluriels, élisions,
 * insensible aux accents) sur la colonne générée Article.searchVector —
 * GET /search du contrat d'API.
 * À l'échelle : remplacer par Elasticsearch/Meilisearch (README §Stack).
 */
export async function searchArticles(params: SearchParams): Promise<SearchResponse> {
  const started = Date.now();
  const q = params.q.trim().slice(0, 200);
  const limit = Math.min(20, Math.max(1, params.limit ?? 10));
  const page = Math.max(1, params.page ?? 1);
  const offset = (page - 1) * limit;

  const empty: SearchResponse = { results: [], total: 0, facets: { rubriques: [] }, tookMs: 0 };
  if (!q) return empty;

  const tsquery = Prisma.sql`websearch_to_tsquery('french_unaccent', ${q})`;

  // conditions communes (sans le filtre rubrique, réutilisées pour les facettes)
  let base = Prisma.sql`a."status" = 'published' AND a."searchVector" @@ ${tsquery}`;
  if (params.period && PERIOD_SQL[params.period]) {
    base = Prisma.sql`${base} AND a."publishedAt" >= (now() at time zone 'utc') - ${PERIOD_SQL[params.period]}`;
  }
  let where = base;
  if (params.rubrique) {
    where = Prisma.sql`${where} AND r."slug" = ${params.rubrique}`;
  }

  const orderBy =
    params.sort === "recent"
      ? Prisma.sql`a."publishedAt" DESC`
      : Prisma.sql`rank DESC, a."publishedAt" DESC`;

  // source de l'extrait : chapeau + textes des blocs, chevrons neutralisés
  // (ts_headline n'échappe pas le HTML de la source)
  const headlineSource = Prisma.sql`
    translate(
      coalesce(a."dek", '') || ' — ' ||
      coalesce(
        CASE WHEN jsonb_typeof(a."body") = 'array'
          THEN (SELECT string_agg(elem->>'text', ' ') FROM jsonb_array_elements(a."body") elem)
          ELSE ''
        END, ''),
      '<>', '‹›')`;

  const [results, totalRows, facetRows] = await Promise.all([
    prisma.$queryRaw<SearchResultRow[]>(Prisma.sql`
      SELECT
        a."id", a."slug", a."title", a."kicker", a."premium",
        a."publishedAt", a."readingTime",
        r."slug"  AS "rubriqueSlug",
        r."name"  AS "rubriqueName",
        r."color" AS "rubriqueColor",
        u."name"  AS "authorName",
        m."url"   AS "coverUrl",
        m."alt"   AS "coverAlt",
        ts_rank(a."searchVector", ${tsquery}) AS rank,
        ts_headline('french_unaccent', ${headlineSource}, ${tsquery},
          'StartSel=<mark>, StopSel=</mark>, MaxWords=32, MinWords=16') AS snippet
      FROM "Article" a
      JOIN "Rubrique" r ON r."id" = a."rubriqueId"
      JOIN "User" u ON u."id" = a."authorId"
      LEFT JOIN "MediaAsset" m ON m."id" = a."coverAssetId"
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}`),
    prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT count(*) AS total
      FROM "Article" a
      JOIN "Rubrique" r ON r."id" = a."rubriqueId"
      WHERE ${where}`),
    prisma.$queryRaw<{ slug: string; name: string; color: string; count: bigint }[]>(Prisma.sql`
      SELECT r."slug", r."name", r."color", count(*) AS count
      FROM "Article" a
      JOIN "Rubrique" r ON r."id" = a."rubriqueId"
      WHERE ${base}
      GROUP BY r."slug", r."name", r."color", r."order"
      ORDER BY count DESC, r."order" ASC`),
  ]);

  return {
    results,
    total: Number(totalRows[0]?.total ?? 0),
    facets: { rubriques: facetRows.map((f) => ({ ...f, count: Number(f.count) })) },
    tookMs: Date.now() - started,
  };
}
