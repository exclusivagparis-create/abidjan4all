"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, Prisma, type ArticleStatus } from "@a4a/db";
import { auth, PUBLISH_ROLES, STUDIO_ROLES } from "@/auth";
import { sendArticleAlert } from "@/lib/push";
import { sanitizeArticleHtml } from "@/lib/sanitize-html";

const BlockSchema = z.object({
  type: z.enum(["paragraph", "richtext", "h2", "quote", "callout", "image", "kpi", "note"]),
  text: z.string().optional(),
  html: z.string().optional(), // bloc « Texte enrichi » (nettoyé au save)
  cite: z.string().optional(),
  url: z.string().optional(),
  /**
   * Texte alternatif : décrit l'image pour qui ne la voit pas (lecteurs
   * d'écran, image non chargée). Jamais affiché sous la photo.
   */
  alt: z.string().optional(),
  /**
   * Légende éditoriale, affichée sous l'image.
   *
   * Distincte de `alt`, qu'elle partageait auparavant : un seul champ servait
   * les deux usages, et comme il était pré-rempli avec le libellé du média
   * dans la médiathèque, les articles héritaient d'un nom de classement en
   * guise de légende.
   */
  caption: z.string().optional(),
  variant: z.enum(["orange", "blue", "teal", "red", "green", "purple"]).optional(), // encadré coloré
});

const ArticleInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, "Titre trop court."),
  kicker: z.string().trim().optional(),
  dek: z.string().trim().optional(),
  rubriqueId: z.string().min(1, "Choisir une rubrique."),
  premium: z.boolean(),
  sponsored: z.boolean().optional(),
  sponsorName: z.string().trim().max(80).optional(),
  tags: z.array(z.string().trim().min(1)).max(12),
  scheduledAt: z.string().nullable().optional(), // ISO ou null
  coverAssetId: z.string().nullable().optional(),
  /** Légende de l'image de une, propre à l'article (jamais reprise du média). */
  coverCaption: z.string().nullable().optional(),
  /** Réservé à la rédaction en chef et à l'administration (cf. saveArticle). */
  authorId: z.string().optional(),
  featuredRank: z.number().int().min(1).max(5).nullable().optional(),
  blocks: z.array(BlockSchema).max(200),
});

export type ArticleInput = z.infer<typeof ArticleInputSchema>;
export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Adresses d'image acceptées dans un bloc : http(s), chemin interne, ou le
 * `placeholder://` du sélecteur. Le reste est écarté.
 *
 * Ce contrôle est devenu nécessaire avec l'import de HTML : les blocs image ne
 * venaient jusque-là que du sélecteur de médiathèque, donc d'adresses que nous
 * avions écrites nous-mêmes. Ils peuvent maintenant provenir d'une page
 * quelconque. Un `javascript:` serait inerte dans une balise `img`, mais une
 * `data:` recopierait le visuel entier dans le corps de l'article — plusieurs
 * mégaoctets dans la base à chaque enregistrement, hors de la médiathèque.
 */
function urlImageAcceptable(url: string | undefined): boolean {
  const v = (url ?? "").trim();
  if (!v) return false;
  if (v.startsWith("placeholder://")) return true;
  if (v.startsWith("/")) return !v.startsWith("//");
  return /^https?:\/\//i.test(v);
}

/**
 * Nettoie les blocs avant stockage : HTML et adresses d'image.
 *
 * Le nettoyage porte sur TOUT bloc qui contient du HTML, et non plus sur le
 * seul « texte enrichi » : le paragraphe en porte désormais lui aussi, depuis
 * qu'il a sa barre de mise en forme. Cibler un type plutôt qu'un champ, c'était
 * laisser passer le suivant.
 */
function sanitizeBlocks(blocks: ArticleInput["blocks"]): ArticleInput["blocks"] {
  return blocks.map((b) => {
    if (b.type === "image" && !urlImageAcceptable(b.url)) return { ...b, url: undefined };
    if (typeof b.html === "string") return { ...b, html: sanitizeArticleHtml(b.html) };
    return b;
  });
}

/**
 * ~200 mots/min, minimum 1 min.
 *
 * Le texte nu est privilégié : chaque bloc en porte un, y compris ceux qui
 * portent aussi du HTML. On ne retombe sur le HTML débarrassé de ses balises
 * que pour les blocs anciens qui n'ont pas de `text` — sinon un « <strong> »
 * compterait pour un mot.
 */
function computeReadingTime(blocks: ArticleInput["blocks"]): number {
  const words = blocks
    .map((b) => b.text ?? (b.html ?? "").replace(/<[^>]+>/g, " "))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

async function requireRole(roles: readonly string[]) {
  const session = await auth();
  if (!session?.user || !roles.includes(session.user.role)) return null;
  return session.user;
}

function revalidatePublic() {
  revalidatePath("/", "layout"); // accueil, rubriques, articles (ISR 60 s sinon)
}

export async function saveArticle(raw: unknown): Promise<ActionResult> {
  const user = await requireRole(STUDIO_ROLES);
  if (!user) return { ok: false, error: "Accès refusé." };

  const parsed = ArticleInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const input = { ...parsed.data, blocks: sanitizeBlocks(parsed.data.blocks) };

  const data = {
    title: input.title,
    kicker: input.kicker || null,
    dek: input.dek || null,
    rubriqueId: input.rubriqueId,
    premium: input.premium,
    sponsored: input.sponsored ?? false,
    sponsorName: input.sponsored ? input.sponsorName || null : null,
    tags: input.tags,
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    coverAssetId: input.coverAssetId ?? null,
    coverCaption: input.coverCaption?.trim() || null,
    featuredRank: input.featuredRank ?? null,
    body: input.blocks as Prisma.InputJsonValue,
    readingTime: computeReadingTime(input.blocks),
  };

  // Signature de l'article. Un journaliste ne peut pas se dessaisir du sien ni
  // en attribuer un à quelqu'un d'autre : la signature engage la personne
  // nommée, et son changement relève de la hiérarchie éditoriale. Le champ est
  // donc ignoré — pas refusé — pour les autres rôles, afin qu'un formulaire
  // renvoyant l'auteur courant ne se solde pas par une erreur.
  const peutSigner = PUBLISH_ROLES.includes(user.role as (typeof PUBLISH_ROLES)[number]);
  const auteur = peutSigner && input.authorId ? { authorId: input.authorId } : {};

  if (input.id) {
    // Une position à la Une est unique : la libérer sur l'article qui la détient.
    if (data.featuredRank != null) {
      await prisma.article.updateMany({
        where: { featuredRank: data.featuredRank, id: { not: input.id } },
        data: { featuredRank: null },
      });
    }
    const updated = await prisma.article.update({
      where: { id: input.id },
      data: {
        ...data,
        ...auteur,
        seo: { metaTitle: input.title, metaDescription: input.dek ?? "" } as Prisma.InputJsonValue,
      },
    });
    revalidatePublic();
    return { ok: true, id: updated.id };
  }

  // création : slug unique dérivé du titre
  let slug = slugify(input.title);
  if (await prisma.article.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }
  const created = await prisma.article.create({
    data: {
      ...data,
      slug,
      status: "draft",
      authorId: user.id,
      seo: { metaTitle: input.title, metaDescription: input.dek ?? "" } as Prisma.InputJsonValue,
    },
  });
  revalidatePublic();
  return { ok: true, id: created.id };
}

type Transition = "submit_review" | "back_to_draft" | "schedule" | "publish" | "unpublish";

const TRANSITIONS: Record<
  Transition,
  { from: ArticleStatus[]; roles: readonly string[] }
> = {
  submit_review: { from: ["draft"], roles: STUDIO_ROLES },
  back_to_draft: { from: ["review", "scheduled"], roles: STUDIO_ROLES },
  schedule: { from: ["draft", "review"], roles: PUBLISH_ROLES },
  publish: { from: ["draft", "review", "scheduled"], roles: PUBLISH_ROLES },
  unpublish: { from: ["published"], roles: PUBLISH_ROLES },
};

export async function transitionArticle(id: string, action: Transition): Promise<ActionResult> {
  const rule = TRANSITIONS[action];
  const user = await requireRole(rule.roles);
  if (!user) return { ok: false, error: "Rôle insuffisant pour cette action." };

  const article = await prisma.article.findUnique({
    where: { id },
    include: { coverAsset: { select: { url: true } } },
  });
  if (!article) return { ok: false, error: "Article introuvable." };
  if (!rule.from.includes(article.status)) {
    return { ok: false, error: `Transition impossible depuis « ${article.status} ».` };
  }
  if (action === "schedule" && (!article.scheduledAt || article.scheduledAt <= new Date())) {
    return { ok: false, error: "Renseigner d'abord une date de programmation future." };
  }
  // Image de couverture obligatoire pour paraître en ligne : sans elle,
  // l'accueil et les listes affichent un aplat gris qui trahit un site en
  // construction. Le contrôle porte sur la mise en ligne (publication directe
  // ou programmation), jamais sur brouillon/relecture — on peut donc préparer
  // un article sans image, mais pas le publier ainsi. Un placeholder du seed
  // (url `placeholder://…`) ne compte pas comme une vraie couverture.
  if (action === "publish" || action === "schedule") {
    const url = article.coverAsset?.url;
    const aUneVraieCouverture = Boolean(url) && !url!.startsWith("placeholder://");
    if (!aUneVraieCouverture) {
      return {
        ok: false,
        error: "Ajoutez une image de couverture avant de publier — elle est obligatoire pour paraître en ligne.",
      };
    }
  }

  const data: Prisma.ArticleUpdateInput =
    action === "submit_review"
      ? { status: "review" }
      : action === "back_to_draft"
        ? { status: "draft" }
        : action === "schedule"
          ? { status: "scheduled" }
          : action === "publish"
            ? { status: "published", publishedAt: article.publishedAt ?? new Date(), scheduledAt: null }
            : { status: "draft", publishedAt: null };

  await prisma.article.update({ where: { id }, data });
  revalidatePublic();
  // Alerte Web Push à la première mise en ligne (pas sur une re-publication).
  if (action === "publish" && !article.publishedAt) {
    sendArticleAlert(id).catch((e) => console.error("[push]", e));
  }
  return { ok: true, id };
}

/**
 * Masque / réaffiche un article publié — rédaction en chef et admin. Masqué,
 * il disparaît du public (accueil, rubrique, recherche) et libère sa position
 * à la Une, mais reste consultable en aperçu par la rédaction.
 */
export async function setArticleHidden(id: string, hidden: boolean): Promise<ActionResult> {
  const user = await requireRole(PUBLISH_ROLES);
  if (!user) return { ok: false, error: "Rôle insuffisant." };
  await prisma.article.update({
    where: { id },
    data: { hidden, ...(hidden ? { featuredRank: null } : {}) },
  });
  revalidatePublic();
  return { ok: true, id };
}

/**
 * Mots-clés déjà employés, les plus fréquents d'abord.
 *
 * Les mots-clés n'ont pas de table : ce sont des chaînes libres portées par
 * chaque article. Rien ne les rapprochait, si bien que « Côte d'Ivoire »,
 * « Cote d'Ivoire » et « côte d'ivoire » coexistaient sans que personne le
 * voie. Les proposer à la saisie est la façon la moins intrusive d'y remédier :
 * on ne corrige pas le rédacteur, on lui montre ce qui existe déjà.
 *
 * `archive`, posé par la reprise sur 4 291 articles, est écarté — le suggérer
 * en tête reviendrait à le faire recopier sur des articles qui n'en sont pas.
 */
export async function motsClesConnus(): Promise<{ mot: string; usages: number }[]> {
  const user = await requireRole(STUDIO_ROLES);
  if (!user) return [];

  const lignes = await prisma.$queryRaw<{ mot: string; usages: bigint }[]>`
    SELECT t AS mot, count(*)::bigint AS usages
    FROM "Article", unnest(tags) t
    WHERE t <> 'archive' AND length(trim(t)) > 1
    GROUP BY t
    ORDER BY count(*) DESC, t ASC
    LIMIT 400
  `;
  return lignes.map((l) => ({ mot: l.mot, usages: Number(l.usages) }));
}
