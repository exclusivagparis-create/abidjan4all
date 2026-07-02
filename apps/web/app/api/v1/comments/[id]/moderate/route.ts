import { z } from "zod";
import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";
import { auth, PUBLISH_ROLES } from "@/auth";

const ModerateInput = z.object({ status: z.enum(["pending", "approved", "rejected", "flagged"]) });

// POST /api/v1/comments/:id/moderate (editor+) { status }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);
  if (!PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    return apiError("forbidden", "Rôle editor ou admin requis.", 403);
  }

  const parsed = ModerateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Statut invalide.", 400);

  const { id } = await params;
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) return apiError("not_found", "Commentaire introuvable.", 404);

  const updated = await prisma.comment.update({ where: { id }, data: { status: parsed.data.status } });
  return Response.json(updated);
}
