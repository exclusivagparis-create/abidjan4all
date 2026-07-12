import { prisma, type Role } from "@a4a/db";
import { apiError } from "@/lib/api";
import { auth } from "@/auth";

const ROLES: Role[] = ["reader", "member", "journalist", "editor", "admin", "partner"];

// GET /api/v1/admin/users?role= → [User] (contrat §Back-office, admin uniquement).
// Périmètre restreint : jamais le hash de mot de passe, ni les données de paiement.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (me?.role !== "admin") return apiError("forbidden", "Réservé à l'administration.", 403);

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const users = await prisma.user.findMany({
    where: role && ROLES.includes(role as Role) ? { role: role as Role } : undefined,
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      verified: true,
      country: true,
      createdAt: true,
      badges: { select: { slug: true, label: true } },
    },
  });
  return Response.json(users);
}
