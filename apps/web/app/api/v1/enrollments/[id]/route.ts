import { z } from "zod";
import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";
import { auth } from "@/auth";

const PatchInput = z.object({
  lastLessonId: z.string().optional(),
  progressPct: z.number().int().min(0).max(100).optional(),
});

// PATCH /api/v1/enrollments/:id (auth) { lastLessonId, progressPct } → Enrollment
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);

  const { id } = await params;
  const enrollment = await prisma.enrollment.findUnique({ where: { id } });
  if (!enrollment || enrollment.userId !== session.user.id) {
    return apiError("not_found", "Inscription introuvable.", 404);
  }

  const parsed = PatchInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Corps invalide.", 400);

  const updated = await prisma.enrollment.update({
    where: { id },
    data: {
      ...(parsed.data.lastLessonId ? { lastLessonId: parsed.data.lastLessonId } : {}),
      ...(parsed.data.progressPct !== undefined
        ? {
            progressPct: parsed.data.progressPct,
            certificateIssued: parsed.data.progressPct >= 100 || enrollment.certificateIssued,
          }
        : {}),
    },
  });
  return Response.json(updated);
}
