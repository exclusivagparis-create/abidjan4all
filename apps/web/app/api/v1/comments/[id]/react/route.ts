import { z } from "zod";
import { prisma, Prisma } from "@a4a/db";
import { apiError } from "@/lib/api";
import { auth } from "@/auth";

const ReactInput = z.object({ emoji: z.string().min(1).max(8) });

// POST /api/v1/comments/:id/react (auth) { emoji }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);

  const parsed = ReactInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Émoji manquant.", 400);

  const { id } = await params;
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment || comment.status !== "approved") return apiError("not_found", "Commentaire introuvable.", 404);

  const reactions = { ...((comment.reactions ?? {}) as Record<string, number>) };
  reactions[parsed.data.emoji] = (reactions[parsed.data.emoji] ?? 0) + 1;

  const updated = await prisma.comment.update({
    where: { id },
    data: { reactions: reactions as Prisma.InputJsonValue },
  });
  return Response.json(updated);
}
