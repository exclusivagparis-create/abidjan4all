import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

/**
 * Répertoire de stockage des fichiers uploadés — volume Docker persistant en
 * production (UPLOADS_DIR=/data/uploads), servi par la route /uploads/[name].
 * En dev sans la variable : public/uploads (servi statiquement par Next).
 */
export const UPLOAD_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "public", "uploads");

export const MAX_UPLOAD = 8 * 1024 * 1024; // 8 Mo

export const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

/** Écrit un fichier image uploadé et renvoie son URL publique `/uploads/…`. */
export async function saveImageUpload(file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (file.size === 0) return { ok: false, error: "Fichier vide." };
  if (file.size > MAX_UPLOAD) return { ok: false, error: "Fichier trop lourd (8 Mo max)." };
  const ext = IMAGE_EXT[file.type];
  if (!ext) return { ok: false, error: `Format image non pris en charge (${file.type || "inconnu"}).` };

  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return { ok: true, url: `/uploads/${name}` };
}

/** Supprime un fichier `/uploads/…` du disque (silencieux si absent). */
export async function removeUpload(url: string | null | undefined): Promise<void> {
  if (url?.startsWith("/uploads/")) {
    await unlink(path.join(UPLOAD_DIR, path.basename(url))).catch(() => {});
  }
}
