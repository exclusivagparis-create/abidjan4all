import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";
import { auth } from "@/auth";

async function findGroup(slug: string, userId: string) {
  return prisma.group.findUnique({
    where: { slug },
    include: { members: { where: { id: userId }, select: { id: true } } },
  });
}

// POST /api/v1/groups/:slug/membership (auth) → adhésion (DF-04 communauté)
export async function POST(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const [session, { slug }] = await Promise.all([auth(), params]);
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);

  const group = await findGroup(slug, session.user.id);
  if (!group) return apiError("not_found", "Groupe introuvable.", 404);

  if (group.members.length === 0) {
    await prisma.group.update({
      where: { id: group.id },
      data: { members: { connect: { id: session.user.id } }, membersCount: { increment: 1 } },
    });
  }
  return Response.json({ group: group.slug, member: true }, { status: 201 });
}

// DELETE /api/v1/groups/:slug/membership (auth) → départ
export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const [session, { slug }] = await Promise.all([auth(), params]);
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);

  const group = await findGroup(slug, session.user.id);
  if (!group) return apiError("not_found", "Groupe introuvable.", 404);

  if (group.members.length > 0) {
    await prisma.group.update({
      where: { id: group.id },
      data: { members: { disconnect: { id: session.user.id } }, membersCount: { decrement: 1 } },
    });
  }
  return new Response(null, { status: 204 });
}
