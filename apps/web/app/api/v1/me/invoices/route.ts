import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";
import { auth } from "@/auth";

// GET /api/v1/me/invoices (auth) → [Invoice] — contrat §Abonnements
export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);

  const invoices = await prisma.invoice.findMany({
    where: { payment: { subscription: { userId: session.user.id } } },
    orderBy: { issuedAt: "desc" },
    include: { payment: { select: { amount: true, currency: true, provider: true } } },
  });
  return Response.json(invoices);
}
