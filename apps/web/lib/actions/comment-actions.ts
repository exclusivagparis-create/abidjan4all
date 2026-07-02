"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, type CommentStatus } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";

export type CommentResult = { ok: true } | { ok: false; error: string };

const BodySchema = z.string().trim().min(3, "Commentaire trop court.").max(2000, "Commentaire trop long (2 000 caractères max).");

/** Tout utilisateur connecté peut commenter — le commentaire part en modération. */
export async function addComment(
  articleId: string,
  _prev: CommentResult | undefined,
  formData: FormData
): Promise<CommentResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Connectez-vous pour commenter." };

  const parsed = BodySchema.safeParse(formData.get("body"));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };

  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { id: true } });
  if (!article) return { ok: false, error: "Article introuvable." };

  // TODO(DF-04) : score de toxicité via services/ai avant mise en file
  await prisma.comment.create({
    data: { articleId, userId: session.user.id, body: parsed.data, status: "pending" },
  });
  return { ok: true };
}

/** Modération (editor+) — approuver / rejeter / signaler. */
export async function moderateComment(id: string, status: CommentStatus): Promise<CommentResult> {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    return { ok: false, error: "Rôle editor ou admin requis." };
  }
  await prisma.comment.update({ where: { id }, data: { status } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/comments");
  return { ok: true };
}
