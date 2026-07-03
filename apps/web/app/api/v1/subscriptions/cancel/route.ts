import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";
import { auth } from "@/auth";

// POST /api/v1/subscriptions/cancel (auth) → Subscription
export async function POST() {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);

  const sub = await prisma.subscription.findUnique({ where: { userId: session.user.id } });
  if (!sub || sub.plan === "free") return apiError("not_found", "Aucun abonnement actif.", 404);

  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "canceled" },
  });
  return Response.json(updated);
}
