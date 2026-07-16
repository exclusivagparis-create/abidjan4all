"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { parseVideoUrl } from "@/lib/video";

async function requirePublisher() {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    redirect("/login?next=/admin/videos");
  }
}

/** Les vidéos paraissent sur l'accueil et sur /videos : on purge les deux. */
function rafraichir() {
  revalidatePath("/admin/videos");
  revalidatePath("/videos");
  revalidatePath("/");
}

function champs(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim().slice(0, 160),
    description: String(formData.get("description") ?? "").trim().slice(0, 600) || null,
    sourceUrl: String(formData.get("sourceUrl") ?? "").trim().slice(0, 500),
    live: formData.get("live") === "on",
  };
}

export async function createVideoAction(formData: FormData): Promise<void> {
  await requirePublisher();
  const { title, description, sourceUrl, live } = champs(formData);
  if (!title) redirect("/admin/videos?erreur=titre");

  const parsed = parseVideoUrl(sourceUrl);
  if (!parsed) redirect("/admin/videos?erreur=url");

  await prisma.video.create({
    data: { title, description, sourceUrl, provider: parsed.provider, providerRef: parsed.providerRef, live },
  });
  rafraichir();
  redirect("/admin/videos");
}

export async function updateVideoAction(id: string, formData: FormData): Promise<void> {
  await requirePublisher();
  const { title, description, sourceUrl, live } = champs(formData);
  if (!title) redirect("/admin/videos?erreur=titre");

  const parsed = parseVideoUrl(sourceUrl);
  if (!parsed) redirect("/admin/videos?erreur=url");

  await prisma.video
    .update({
      where: { id },
      data: { title, description, sourceUrl, provider: parsed.provider, providerRef: parsed.providerRef, live },
    })
    .catch(() => {});
  rafraichir();
  redirect("/admin/videos");
}

/** Diffuser / retirer de l'antenne sans supprimer la vidéo. */
export async function toggleVideoPublishedAction(id: string): Promise<void> {
  await requirePublisher();
  const v = await prisma.video.findUnique({ where: { id }, select: { published: true } });
  if (v) await prisma.video.update({ where: { id }, data: { published: !v.published } });
  rafraichir();
  redirect("/admin/videos");
}

/**
 * Passe une vidéo en direct. Un seul direct à la fois : les autres sont
 * retirés du direct, sinon deux vidéos revendiqueraient l'antenne.
 */
export async function toggleVideoLiveAction(id: string): Promise<void> {
  await requirePublisher();
  const v = await prisma.video.findUnique({ where: { id }, select: { live: true } });
  if (v) {
    if (v.live) {
      await prisma.video.update({ where: { id }, data: { live: false } });
    } else {
      await prisma.$transaction([
        prisma.video.updateMany({ where: { live: true }, data: { live: false } }),
        prisma.video.update({ where: { id }, data: { live: true, published: true } }),
      ]);
    }
  }
  rafraichir();
  redirect("/admin/videos");
}

export async function deleteVideoAction(id: string): Promise<void> {
  await requirePublisher();
  await prisma.video.delete({ where: { id } }).catch(() => {});
  rafraichir();
  redirect("/admin/videos");
}
