"use server";

import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { prisma, type MediaType } from "@a4a/db";
import { auth, STUDIO_ROLES } from "@/auth";

export type MediaResult = { ok: true } | { ok: false; error: string };

/**
 * Stockage fichiers : UPLOADS_DIR (volume Docker persistant en production,
 * servi par la route /uploads/[name]) — repli public/uploads en dev, où Next
 * les sert statiquement. TODO(infra) : adaptateur S3 IONOS Object Storage,
 * variables S3_ENDPOINT/S3_BUCKET/S3_KEY/S3_SECRET du README.
 */
const UPLOAD_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "public", "uploads");
const MAX_SIZE = 8 * 1024 * 1024; // 8 Mo

const MIME_EXT: Record<string, { ext: string; type: MediaType }> = {
  "image/jpeg": { ext: "jpg", type: "image" },
  "image/png": { ext: "png", type: "image" },
  "image/webp": { ext: "webp", type: "image" },
  "image/gif": { ext: "gif", type: "image" },
  "image/svg+xml": { ext: "svg", type: "svg" },
  "audio/mpeg": { ext: "mp3", type: "audio" },
  "video/mp4": { ext: "mp4", type: "video" },
};

export async function uploadMedia(_prev: MediaResult | undefined, formData: FormData): Promise<MediaResult> {
  const session = await auth();
  if (!session?.user || !STUDIO_ROLES.includes(session.user.role as (typeof STUDIO_ROLES)[number])) {
    return { ok: false, error: "Accès refusé." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choisir un fichier." };
  if (file.size > MAX_SIZE) return { ok: false, error: "Fichier trop lourd (8 Mo max)." };
  const kind = MIME_EXT[file.type];
  if (!kind) return { ok: false, error: `Format non pris en charge (${file.type || "inconnu"}).` };

  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${kind.ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));

  await prisma.mediaAsset.create({
    data: {
      type: kind.type,
      url: `/uploads/${name}`,
      alt: String(formData.get("alt") ?? "").trim() || null,
      credit: String(formData.get("credit") ?? "").trim() || null,
      sizeBytes: file.size,
      tags: [],
      uploadedById: session.user.id,
    },
  });
  revalidatePath("/admin/media");
  return { ok: true };
}

/**
 * Édite un média : métadonnées (alt, crédit) et, si un fichier est fourni,
 * remplacement du contenu. Le remplacement écrit un NOUVEAU nom (le cache
 * navigateur des uploads est immutable) et met à jour MediaAsset.url — les
 * articles qui l'utilisent en une suivent automatiquement (référence par id).
 */
export async function updateMedia(_prev: MediaResult | undefined, formData: FormData): Promise<MediaResult> {
  const session = await auth();
  if (!session?.user || !STUDIO_ROLES.includes(session.user.role as (typeof STUDIO_ROLES)[number])) {
    return { ok: false, error: "Accès refusé." };
  }

  const id = String(formData.get("id") ?? "");
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) return { ok: false, error: "Média introuvable." };

  const data: { alt: string | null; credit: string | null; url?: string; sizeBytes?: number; type?: MediaType } = {
    alt: String(formData.get("alt") ?? "").trim() || null,
    credit: String(formData.get("credit") ?? "").trim() || null,
  };

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_SIZE) return { ok: false, error: "Fichier trop lourd (8 Mo max)." };
    const kind = MIME_EXT[file.type];
    if (!kind) return { ok: false, error: `Format non pris en charge (${file.type || "inconnu"}).` };

    const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${kind.ext}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));

    data.url = `/uploads/${name}`;
    data.sizeBytes = file.size;
    data.type = kind.type;
  }

  await prisma.mediaAsset.update({ where: { id }, data });

  // l'ancien fichier ne sert plus à personne (l'url a changé partout via l'id)
  if (data.url && asset.url.startsWith("/uploads/")) {
    await unlink(path.join(UPLOAD_DIR, path.basename(asset.url))).catch(() => {});
  }
  revalidatePath("/admin/media");
  revalidatePath("/", "layout"); // images à la une potentiellement remplacées
  return { ok: true };
}

export async function deleteMedia(id: string): Promise<MediaResult> {
  const session = await auth();
  if (!session?.user || !STUDIO_ROLES.includes(session.user.role as (typeof STUDIO_ROLES)[number])) {
    return { ok: false, error: "Accès refusé." };
  }

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    include: { _count: { select: { articlesAsCover: true, liveUpdates: true } } },
  });
  if (!asset) return { ok: false, error: "Média introuvable." };
  if (asset._count.articlesAsCover > 0 || asset._count.liveUpdates > 0) {
    return { ok: false, error: "Média utilisé (image à la une ou live-blog) — détacher d'abord." };
  }

  await prisma.mediaAsset.delete({ where: { id } });
  if (asset.url.startsWith("/uploads/")) {
    await unlink(path.join(UPLOAD_DIR, path.basename(asset.url))).catch(() => {});
  }
  revalidatePath("/admin/media");
  return { ok: true };
}
