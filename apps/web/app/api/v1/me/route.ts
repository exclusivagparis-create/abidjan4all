import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";
import { auth } from "@/auth";

// GET /api/v1/me (auth) → User (+ subscription, badges) — contrat §Auth
export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      country: true,
      bio: true,
      verified: true,
      interests: true,
      locale: true,
      theme: true,
      createdAt: true,
      badges: { select: { slug: true, label: true } },
      subscription: {
        select: { plan: true, status: true, method: true, methodMask: true, currentPeriodEnd: true, since: true },
      },
    },
  });
  if (!user) return apiError("not_found", "Utilisateur introuvable.", 404);
  return Response.json(user);
}
