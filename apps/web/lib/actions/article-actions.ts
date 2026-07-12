"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, Prisma, type ArticleStatus } from "@a4a/db";
import { auth, PUBLISH_ROLES, STUDIO_ROLES } from "@/auth";
import { sendArticleAlert } from "@/lib/push";

const BlockSchema = z.object({
  type: z.enum(["paragraph", "h2", "quote", "callout", "image", "kpi", "note"]),
  text: z.string().optional(),
  cite: z.string().optional(),
  url: z.string().optional(),
  alt: z.string().optional(),
  variant: z.enum(["orange", "blue", "teal", "red", "green", "purple"]).optional(), // encadré coloré
});

const ArticleInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, "Titre trop court."),
  kicker: z.string().trim().optional(),
  dek: z.string().trim().optional(),
  rubriqueId: z.string().min(1, "Choisir une rubrique."),
  premium: z.boolean(),
  tags: z.array(z.string().trim().min(1)).max(12),
  scheduledAt: z.string().nullable().optional(), // ISO ou null
  coverAssetId: z.string().nullable().optional(),
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

/** ~200 mots/min, minimum 1 min. */
function computeReadingTime(blocks: ArticleInput["blocks"]): number {
  const words = blocks
    .map((b) => b.text ?? "")
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
  const input = parsed.data;

  const data = {
    title: input.title,
    kicker: input.kicker || null,
    dek: input.dek || null,
    rubriqueId: input.rubriqueId,
    premium: input.premium,
    tags: input.tags,
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    coverAssetId: input.coverAssetId ?? null,
    body: input.blocks as Prisma.InputJsonValue,
    readingTime: computeReadingTime(input.blocks),
  };

  if (input.id) {
    const updated = await prisma.article.update({
      where: { id: input.id },
      data: {
        ...data,
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

  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) return { ok: false, error: "Article introuvable." };
  if (!rule.from.includes(article.status)) {
    return { ok: false, error: `Transition impossible depuis « ${article.status} ».` };
  }
  if (action === "schedule" && (!article.scheduledAt || article.scheduledAt <= new Date())) {
    return { ok: false, error: "Renseigner d'abord une date de programmation future." };
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
