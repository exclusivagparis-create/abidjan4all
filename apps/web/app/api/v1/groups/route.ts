import { prisma } from "@a4a/db";

// GET /api/v1/groups → [Group] (DF-04 communauté)
export async function GET() {
  const groups = await prisma.group.findMany({ orderBy: { membersCount: "desc" } });
  return Response.json(groups);
}
