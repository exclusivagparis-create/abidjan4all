import { createReadStream, existsSync } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";
import { peutLireEditions } from "@/lib/intelligence";
import { documentPath } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * GET /intelligence/:slug/:numero/pdf — édition A4A Intelligence en PDF.
 *
 * Le fichier est PAYANT : il vit sous `/documents/…`, préfixe que la route
 * publique `/uploads/[name]` ne sert pas. Il ne sort que d'ici, après
 * vérification de l'abonnement en cours de validité (ou d'un rôle éditorial).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; numero: string }> }) {
  const { slug, numero } = await params;

  const serie = await prisma.briefSerie.findUnique({ where: { slug }, select: { id: true, title: true } });
  if (!serie) return new Response("Introuvable", { status: 404 });

  const edition = await prisma.briefEdition.findUnique({
    where: { serieId_numero: { serieId: serie.id, numero: decodeURIComponent(numero) } },
    select: { numero: true, fileUrl: true, publishedAt: true },
  });
  if (!edition?.fileUrl) return new Response("Introuvable", { status: 404 });

  const session = await auth();
  if (!session?.user) return new Response("Authentification requise.", { status: 401 });
  if (!(await peutLireEditions(session.user, serie.id))) {
    return new Response("Abonnement requis.", { status: 403 });
  }
  // Édition non publiée : réservée à la relecture éditoriale.
  const publiee = edition.publishedAt && edition.publishedAt <= new Date();
  if (!publiee && !["editor", "admin"].includes(session.user.role ?? "")) {
    return new Response("Introuvable", { status: 404 });
  }

  const filePath = documentPath(edition.fileUrl);
  if (!filePath || !existsSync(filePath)) return new Response("Introuvable", { status: 404 });

  const { size } = await stat(filePath);
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  const nom = `${slug}-${edition.numero}.pdf`.replace(/[^a-zA-Z0-9.\-]/g, "-");

  return new Response(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(size),
      "Content-Disposition": `inline; filename="${nom}"`,
      // Document payant et nominatif : jamais dans un cache partagé.
      "Cache-Control": "private, no-store",
    },
  });
}
