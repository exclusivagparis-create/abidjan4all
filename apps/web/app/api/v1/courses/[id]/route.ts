import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";

// GET /api/v1/courses/:id → { course, lessons } (contrat §E-learning)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await prisma.course.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  if (!course) return apiError("not_found", "Formation introuvable.", 404);

  const { lessons, ...rest } = course;
  return Response.json({ course: rest, lessons });
}
