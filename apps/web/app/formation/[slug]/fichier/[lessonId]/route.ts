import { createReadStream, existsSync } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";
import { documentPath } from "@/lib/uploads";
import {
  PLANS_INCLUANT_FORMATION,
  nomDeFichier,
  peutTelecharger,
  ressourcesDe,
} from "@/lib/formation-ressources";

export const dynamic = "force-dynamic";

/**
 * GET /formation/:slug/fichier/:lessonId?f=/documents/xxx.pdf
 *
 * Sert un fichier joint à une leçon. Le fichier vit sous `/documents/`, que la
 * route publique des médias ne sert pas : il ne sort que d'ici, après
 * vérification de l'accès au cours. Sans ce détour, l'adresse d'un support
 * payant circulerait d'un lecteur à l'autre comme n'importe quel lien.
 *
 * Le fichier demandé doit figurer dans la leçon : on ne sert jamais un chemin
 * fourni par l'appelant, seulement un de ceux que la rédaction y a joints.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
  const demande = new URL(request.url).searchParams.get("f") ?? "";

  const lecon = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { title: true, resources: true, course: { select: { id: true, slug: true, price: true } } },
  });
  if (!lecon || lecon.course.slug !== slug) return new Response("Introuvable", { status: 404 });

  const ressource = ressourcesDe(lecon.resources).find((r) => r.url === demande);
  if (!ressource) return new Response("Introuvable", { status: 404 });

  const session = await auth();
  if (!session?.user) {
    return new Response("Authentification requise.", { status: 401 });
  }

  const [inscription, abonnement] = await Promise.all([
    prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId: lecon.course.id, userId: session.user.id } },
      select: { id: true },
    }),
    prisma.subscription.findUnique({
      where: { userId: session.user.id },
      select: { plan: true, status: true, currentPeriodEnd: true },
    }),
  ]);

  const abonnementCouvrant =
    !!abonnement &&
    PLANS_INCLUANT_FORMATION.includes(abonnement.plan) &&
    abonnement.status !== "canceled" &&
    (!abonnement.currentPeriodEnd || abonnement.currentPeriodEnd > new Date());

  const autorise = peutTelecharger({
    inscrit: Boolean(inscription),
    prix: lecon.course.price,
    abonnementCouvrant,
    role: session.user.role,
  });
  if (!autorise) return new Response("Inscription à la formation requise.", { status: 403 });

  const chemin = documentPath(ressource.url);
  if (!chemin || !existsSync(chemin)) return new Response("Introuvable", { status: 404 });

  const { size } = await stat(chemin);
  const flux = Readable.toWeb(createReadStream(chemin)) as ReadableStream;

  return new Response(flux, {
    headers: {
      // Type générique : le navigateur enregistre au lieu d'ouvrir, et un
      // fichier bureautique ne s'exécute jamais dans la page.
      "Content-Type": "application/octet-stream",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${nomDeFichier(ressource.nom, ressource.url)}"`,
      // Document payant et nominatif : jamais dans un cache partagé.
      "Cache-Control": "private, no-store",
    },
  });
}
