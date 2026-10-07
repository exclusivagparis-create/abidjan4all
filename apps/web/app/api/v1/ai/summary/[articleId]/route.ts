import { prisma, Prisma } from "@a4a/db";
import { summarizeArticle } from "@a4a/ai";
import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import { hasActiveSubscription } from "@/lib/billing";
import { adresseAppelant, limiter, reponseTropDeRequetes } from "@/lib/limite-debit";
import { MESSAGE_PREMIUM, corpsLisible, regenerationAutorisee } from "@/lib/mur-payant";

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

  /**
   * Lecture du cache : publique, et elle le reste.
   *
   * Les points clés s'affichent sur la page d'article même derrière le mur —
   * c'est un choix éditorial, ils donnent envie de s'abonner. Ce qui suit, en
   * revanche, lit le corps entier et appelle un modèle payant : à partir d'ici
   * les règles changent.
   */
  if (article.aiSummary && !force) {
    return Response.json(article.aiSummary);
  }

  // Un plafond, comme sur les trois autres routes d'IA. Celle-ci n'en avait
  // aucun, alors qu'elle écrit aussi en base : `?force=1` en boucle suffisait
  // à faire tourner le modèle sans fin.
  {
    const v = limiter(`ia-resume:${adresseAppelant(request)}`, 20, 3600);
    if (!v.autorise) return reponseTropDeRequetes(v.attendre);
  }

  // Rôle relu en base, jamais le jeton seul : un compte rétrogradé ne doit pas
  // garder le pouvoir de dépenser jusqu'à l'expiration de sa session.
  const session = await auth();
  const moi = session?.user
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } })
    : null;

  const redactionEnChef = regenerationAutorisee(moi?.role);

  if (force && !redactionEnChef) {
    return apiError(
      "forbidden",
      "La régénération d'un résumé est réservée à la rédaction en chef et à l'administration.",
      403
    );
  }

  /**
   * Le mur s'applique à la génération, sauf pour la rédaction en chef.
   *
   * Sans cette exception, un article payant n'obtiendrait jamais ses premiers
   * points clés : il faudrait être à la fois de la maison et abonné. Or ces
   * points clés s'affichent précisément pour donner envie de s'abonner, et
   * celui qui les fabrique peut déjà lire l'article dans le Studio. Ce qui
   * sort d'ici est un résumé, public par choix éditorial — pas le texte.
   */
  const abonne = moi ? await hasActiveSubscription(moi.id) : false;
  if (!redactionEnChef && !corpsLisible({ premium: article.premium, abonne })) {
    return apiError("premium_required", MESSAGE_PREMIUM, 402);
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
