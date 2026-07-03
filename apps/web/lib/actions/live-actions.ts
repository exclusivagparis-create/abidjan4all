"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, type LiveBlogStatus } from "@a4a/db";
import { auth, STUDIO_ROLES } from "@/auth";

export type LiveResult = { ok: true; id: string } | { ok: false; error: string };

async function requireStudio() {
  const session = await auth();
  if (!session?.user || !STUDIO_ROLES.includes(session.user.role as (typeof STUDIO_ROLES)[number])) {
    return null;
  }
  return session.user;
}

const LiveBlogInput = z.object({
  title: z.string().trim().min(3, "Titre trop court."),
  dek: z.string().trim().optional(),
  rubriqueId: z.string().min(1, "Choisir une rubrique."),
});

export async function createLiveBlog(_prev: LiveResult | undefined, formData: FormData): Promise<LiveResult> {
  const user = await requireStudio();
  if (!user) return { ok: false, error: "Accès refusé." };

  const parsed = LiveBlogInput.safeParse({
    title: formData.get("title"),
    dek: formData.get("dek") || undefined,
    rubriqueId: formData.get("rubriqueId"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };

  const blog = await prisma.liveBlog.create({
    data: { ...parsed.data, dek: parsed.data.dek ?? null, status: "live" },
  });
  revalidatePath("/admin/live");
  revalidatePath("/en-direct");
  return { ok: true, id: blog.id };
}

const UpdateInput = z.object({
  type: z.enum(["text", "quote", "stat", "media"]),
  title: z.string().trim().optional(),
  body: z.string().trim().min(2, "Contenu requis."),
  pinned: z.boolean(),
});

export async function addLiveUpdate(
  liveBlogId: string,
  _prev: LiveResult | undefined,
  formData: FormData
): Promise<LiveResult> {
  const user = await requireStudio();
  if (!user) return { ok: false, error: "Accès refusé." };

  const blog = await prisma.liveBlog.findUnique({ where: { id: liveBlogId } });
  if (!blog) return { ok: false, error: "Live-blog introuvable." };
  if (blog.status === "ended") return { ok: false, error: "Ce direct est clôturé — rouvrez-le d'abord." };

  const parsed = UpdateInput.safeParse({
    type: formData.get("type"),
    title: formData.get("title") || undefined,
    body: formData.get("body"),
    pinned: formData.get("pinned") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };

  const [update] = await prisma.$transaction([
    prisma.liveUpdate.create({
      data: { liveBlogId, ...parsed.data, title: parsed.data.title ?? null },
    }),
    prisma.liveBlog.update({
      where: { id: liveBlogId },
      data: { updatesCount: { increment: 1 } },
    }),
  ]);
  revalidatePath(`/admin/live/${liveBlogId}`);
  revalidatePath(`/en-direct/${liveBlogId}`);
  revalidatePath("/"); // ticker de l'accueil
  return { ok: true, id: update.id };
}

export async function setLiveBlogStatus(id: string, status: LiveBlogStatus): Promise<LiveResult> {
  const user = await requireStudio();
  if (!user) return { ok: false, error: "Accès refusé." };
  await prisma.liveBlog.update({ where: { id }, data: { status } });
  revalidatePath("/admin/live");
  revalidatePath(`/admin/live/${id}`);
  revalidatePath("/en-direct");
  revalidatePath(`/en-direct/${id}`);
  return { ok: true, id };
}
