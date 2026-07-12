import { createReadStream, existsSync } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";

export const dynamic = "force-dynamic";

/**
 * Sert les fichiers de la médiathèque depuis UPLOADS_DIR (volume persistant
 * en production). Nécessaire car Next standalone ne sert pas les fichiers
 * ajoutés dans public/ après le build. En dev, les fichiers déjà présents
 * dans public/uploads sont servis statiquement par Next avant cette route.
 */
const UPLOAD_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "public", "uploads");

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
};

// Noms générés par uploadMedia uniquement — aucun chemin, aucune traversée.
const SAFE_NAME = /^[a-z0-9-]+\.(jpg|png|webp|gif|svg|mp3|mp4)$/;

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!SAFE_NAME.test(name)) return new Response("Introuvable", { status: 404 });

  const filePath = path.join(UPLOAD_DIR, name);
  if (!existsSync(filePath)) return new Response("Introuvable", { status: 404 });

  const { size } = await stat(filePath);
  const ext = name.split(".").pop()!;
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

  return new Response(stream, {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Content-Length": String(size),
      // noms uniques horodatés → cache long sans risque
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
