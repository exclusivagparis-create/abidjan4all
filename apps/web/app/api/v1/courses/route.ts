import { prisma, Prisma } from "@a4a/db";

// GET /api/v1/courses?category=&level= → [Course] (contrat §E-learning)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const where: Prisma.CourseWhereInput = {};
  const category = searchParams.get("category");
  if (category) where.category = category;
  const level = searchParams.get("level");
  if (level) where.level = level;

  const courses = await prisma.course.findMany({ where, orderBy: { title: "asc" } });
  return Response.json(courses);
}
