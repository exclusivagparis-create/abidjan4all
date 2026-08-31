"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, type LiveBlogStatus } from "@a4a/db";
import { auth, PUBLISH_ROLES, STUDIO_ROLES } from "@/auth";

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

/**
 * Corriger une mise à jour déjà publiée.
 *
 * Un direct s'écrit dans l'urgence : un chiffre erroné, une déclaration mal
 * attribuée, une information qui se dément dans la minute. Jusqu'ici rien ne
 * pouvait être repris — la mise à jour partait dans le fil public et y restait,
 * faute exacte comprise. Pour un journal, c'est le défaut le plus coûteux : on
 * ne peut pas corriger ce qu'on vient d'affirmer.
 *
 * La correction reste ouverte même après clôture du direct. La règle qui
 * interdit d'AJOUTER dans un direct clos protège la chronologie ; elle n'a
 * aucune raison d'empêcher de rectifier une erreur qu'on découvre le lendemain.
 */
export async function modifierLiveUpdate(
  id: string,
  _prev: LiveResult | undefined,
  formData: FormData
): Promise<LiveResult> {
  const user = await requireStudio();
  if (!user) return { ok: false, error: "Accès refusé." };

  const update = await prisma.liveUpdate.findUnique({ where: { id }, select: { liveBlogId: true } });
  if (!update) return { ok: false, error: "Mise à jour introuvable." };

  const parsed = UpdateInput.safeParse({
    type: formData.get("type"),
    title: formData.get("title") || undefined,
    body: formData.get("body"),
    pinned: formData.get("pinned") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };

  await prisma.liveUpdate.update({
    where: { id },
    // `time` n'est PAS retouché : l'heure affichée est celle de l'événement
    // rapporté, pas celle de la correction. La déplacer réécrirait la
    // chronologie du direct et ferait mentir le fil.
    data: { ...parsed.data, title: parsed.data.title ?? null },
  });

  revaliderDirect(update.liveBlogId);
  return { ok: true, id };
}

/** Retirer une mise à jour du fil. */
export async function supprimerLiveUpdate(id: string): Promise<LiveResult> {
  const user = await requireStudio();
  if (!user) return { ok: false, error: "Accès refusé." };

  const update = await prisma.liveUpdate.findUnique({ where: { id }, select: { liveBlogId: true } });
  if (!update) return { ok: false, error: "Mise à jour introuvable." };

  // Le compteur suit, dans la même transaction : affiché sur la liste des
  // directs et sur le fil public, il indiquerait sinon plus de mises à jour
  // qu'il n'en existe.
  await prisma.$transaction([
    prisma.liveUpdate.delete({ where: { id } }),
    prisma.liveBlog.update({
      where: { id: update.liveBlogId },
      data: { updatesCount: { decrement: 1 } },
    }),
  ]);

  revaliderDirect(update.liveBlogId);
  return { ok: true, id };
}

/** Modifier l'en-tête d'un direct : titre, chapeau, rubrique. */
export async function modifierLiveBlog(
  id: string,
  _prev: LiveResult | undefined,
  formData: FormData
): Promise<LiveResult> {
  const user = await requireStudio();
  if (!user) return { ok: false, error: "Accès refusé." };

  const parsed = LiveBlogInput.safeParse({
    title: formData.get("title"),
    dek: formData.get("dek") || undefined,
    rubriqueId: formData.get("rubriqueId"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };

  await prisma.liveBlog.update({
    where: { id },
    data: { ...parsed.data, dek: parsed.data.dek ?? null },
  });

  revaliderDirect(id);
  return { ok: true, id };
}

/**
 * Supprimer un direct et tout son fil.
 *
 * Réservé à la rédaction en chef et à l'administration, à la différence des
 * mises à jour : effacer un direct fait disparaître le récit entier d'un
 * événement, souvent écrit à plusieurs mains. C'est la même règle que pour la
 * suppression d'articles — ce qui engage la mémoire du journal ne se décide pas
 * au niveau du reporter.
 */
export async function supprimerLiveBlog(id: string): Promise<LiveResult> {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    return { ok: false, error: "Réservé à la rédaction en chef et à l'administration." };
  }

  const blog = await prisma.liveBlog.findUnique({ where: { id }, select: { articleId: true } });
  if (!blog) return { ok: false, error: "Direct introuvable." };

  // Les mises à jour d'abord : elles référencent le direct, la base refuserait
  // l'ordre inverse. L'article éventuellement rattaché n'est PAS touché — il
  // vit sa propre vie, et le supprimer ici serait un effet de bord que personne
  // n'a demandé.
  await prisma.$transaction([
    prisma.liveUpdate.deleteMany({ where: { liveBlogId: id } }),
    prisma.liveBlog.delete({ where: { id } }),
  ]);

  revalidatePath("/admin/live");
  revalidatePath("/en-direct");
  revalidatePath("/");
  return { ok: true, id };
}

/** Rafraîchit les pages où un direct se donne à voir. */
function revaliderDirect(liveBlogId: string) {
  revalidatePath("/admin/live");
  revalidatePath(`/admin/live/${liveBlogId}`);
  revalidatePath("/en-direct");
  revalidatePath(`/en-direct/${liveBlogId}`);
  revalidatePath("/"); // ticker de l'accueil
}
