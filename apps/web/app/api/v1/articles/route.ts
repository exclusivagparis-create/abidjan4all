import { z } from "zod";
import { prisma, Prisma } from "@a4a/db";
import { apiError, articleListSelect, pagination } from "@/lib/api";
import { autorise, identifier } from "@/lib/api-auth";
import { adresseAppelant, limiter, reponseTropDeRequetes } from "@/lib/limite-debit";

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

const ArticleCreateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,80}$/),
  title: z.string().min(3),
  kicker: z.string().optional(),
  dek: z.string().optional(),
  body: z.array(z.record(z.unknown())).default([]),
  rubriqueId: z.string().min(1),
  premium: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  readingTime: z.number().int().min(1).default(1),
});

/**
 * POST /api/v1/articles — création en brouillon.
 *
 * Accepte désormais un jeton porteur (`Authorization: Bearer a4a_…`) en plus de
 * la session du Studio. La route n'acceptait que le cookie de navigateur :
 * aucune machine ne pouvait s'en servir, alors que le système de jetons
 * existait déjà pour le connecteur. C'est le même mécanisme qui est réemployé
 * ici, et non un second, parallèle : mêmes portées, mêmes plafonds de rôle,
 * même révocation depuis Studio ▸ Accès API.
 *
 * L'article est TOUJOURS créé en brouillon, quel que soit l'appelant. La portée
 * `articles:write` est décrite aux porteurs comme « Créer et modifier des
 * brouillons. Jamais publier. » — une machine ne met rien en ligne toute seule,
 * un humain relit et publie depuis le Studio.
 */
export async function POST(request: Request) {
  const identite = await identifier(request);
  if (!identite) return apiError("unauthorized", "Authentification requise.", 401);
  if (!autorise(identite, "articles:write")) {
    return apiError("forbidden", "Portée articles:write et rôle rédactionnel requis.", 403);
  }

  // Un jeton peut être appelé en boucle par une automatisation mal réglée. La
  // limite est posée par porteur, et non par adresse : deux automatisations
  // derrière la même adresse ne se pénalisent pas l'une l'autre, et changer
  // d'adresse ne la contourne pas.
  const cle = identite.via === "token" ? `articles:create:${identite.userId}` : `articles:create:${adresseAppelant(request)}`;
  const verdict = limiter(cle, 60, 3600);
  if (!verdict.autorise) return reponseTropDeRequetes(verdict.attendre);

  const parsed = ArticleCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError("invalid_input", parsed.error.issues[0]?.message ?? "Corps invalide.", 400);
  }
  const input = parsed.data;

  if (await prisma.article.findUnique({ where: { slug: input.slug } })) {
    return apiError("slug_taken", "Ce slug existe déjà.", 409);
  }

  const article = await prisma.article.create({
    data: {
      ...input,
      body: input.body as Prisma.InputJsonValue,
      status: "draft",
      authorId: identite.userId,
      seo: { metaTitle: input.title, metaDescription: input.dek ?? "" } as Prisma.InputJsonValue,
    },
  });
  return Response.json(article, { status: 201 });
}
