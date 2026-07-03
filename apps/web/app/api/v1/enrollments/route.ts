import { z } from "zod";
import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";
import { auth } from "@/auth";

const EnrollInput = z.object({ courseId: z.string().min(1) });

// POST /api/v1/enrollments (auth) { courseId } → Enrollment (contrat §E-learning)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);

  const parsed = EnrollInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "courseId requis.", 400);

  const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId } });
  if (!course) return apiError("not_found", "Formation introuvable.", 404);

  const enrollment = await prisma.enrollment.upsert({
    where: { courseId_userId: { courseId: course.id, userId: session.user.id } },
    create: { courseId: course.id, userId: session.user.id },
    update: {},
  });
  return Response.json(enrollment, { status: 201 });
}
