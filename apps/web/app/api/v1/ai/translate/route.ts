import { z } from "zod";
import { prisma } from "@a4a/db";
import { translateArticle } from "@a4a/ai";
import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import { hasActiveSubscription } from "@/lib/billing";
import { adresseAppelant, limiter, reponseTropDeRequetes } from "@/lib/limite-debit";
import { MESSAGE_PREMIUM, corpsLisible } from "@/lib/mur-payant";

const TranslateInput = z.object({
  articleId: z.string().min(1),
  target: z.enum(["en", "fr"]).default("en"),
});

// POST /api/v1/ai/translate { articleId, target } → { title, body } (contrat §IA)
export async function POST(request: Request) {
  // Ces routes appellent un modèle payant : sans plafond, un simple script
  // pouvait vider le budget en une nuit. Le compte n'est pas exigé — la
  // fonction sert au lectorat anonyme — mais la cadence, si.
  {
    const v = limiter(`ia-traduction:${adresseAppelant(request)}`, 10, 3600);
    if (!v.autorise) return reponseTropDeRequetes(v.attendre);
  }

  const parsed = TranslateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "articleId requis, target ∈ {en, fr}.", 400);

  const { articleId, target } = parsed.data;
  const article = await prisma.article.findFirst({
    where: { OR: [{ id: articleId }, { slug: articleId }], status: "published" },
  });
  if (!article) return apiError("not_found", "Article introuvable.", 404);

  /**
   * Le mur payant s'applique ici comme ailleurs.
   *
   * Il manquait : la route servait le corps entier d'un article payant à un
   * appelant anonyme. Et `target: "fr"` sur un article français, ou le repli
   * sans clé d'IA, renvoyaient le texte original tel quel — la traduction
   * était devenue la porte de service du mur.
   */
  const session = await auth();
  const abonne = session?.user ? await hasActiveSubscription(session.user.id) : false;
  if (!corpsLisible({ premium: article.premium, abonne })) {
    return apiError("premium_required", MESSAGE_PREMIUM, 402);
  }

  const blocks = Array.isArray(article.body) ? article.body : [];
  const text = [article.dek ?? "", ...blocks.map((b) => (b as { text?: string }).text ?? "")]
    .filter(Boolean)
    .join("\n");

  const translation = await translateArticle(article.title, text, target);
  return Response.json(translation);
}
