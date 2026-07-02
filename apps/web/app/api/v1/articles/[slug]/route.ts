import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";

// GET /api/v1/articles/:slug — body complet ; 402 si premium & non-abonné
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await prisma.article.findFirst({
    where: { slug, status: "published" },
    include: {
      rubrique: { select: { slug: true, name: true, color: true } },
      author: { select: { name: true, bio: true, avatarUrl: true } },
      coverAsset: { select: { url: true, alt: true, credit: true } },
    },
  });
  if (!article) return apiError("not_found", "Article introuvable.", 404);

  // TODO(DF-03) : lever la restriction pour les abonnés authentifiés (Auth.js + Subscription)
  if (article.premium) {
    const teaser = Array.isArray(article.body) ? article.body.slice(0, 2) : article.body;
    return Response.json(
      {
        error: { code: "premium_required", message: "Cet article est réservé aux abonnés A4A+." },
        article: { ...article, body: teaser, bodyTruncated: true },
      },
      { status: 402 }
    );
  }

  return Response.json(article);
}
