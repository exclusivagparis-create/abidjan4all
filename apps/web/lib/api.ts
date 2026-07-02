import { Prisma } from "@a4a/db";

/** Champs renvoyés pour un article en liste (API_CONTRACTS.md §Articles). */
export const articleListSelect = {
  id: true,
  slug: true,
  title: true,
  kicker: true,
  dek: true,
  premium: true,
  publishedAt: true,
  readingTime: true,
  views: true,
  tags: true,
  rubrique: { select: { slug: true, name: true, color: true } },
  author: { select: { name: true } },
  coverAsset: { select: { url: true, alt: true } },
} satisfies Prisma.ArticleSelect;

/** Pagination `?page=&limit=` → `{ data, meta }` (API_CONTRACTS.md, en-tête). */
export function pagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function apiError(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}
