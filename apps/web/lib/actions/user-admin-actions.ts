"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type Role } from "@a4a/db";
import { auth } from "@/auth";

const ASSIGNABLE_ROLES: Role[] = ["reader", "member", "journalist", "editor", "admin", "partner"];

/** Garde : seul un admin encore présent en base peut administrer les comptes. */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/users");
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!me || me.role !== "admin") redirect("/admin");
  return me;
}

/** Change le rôle d'un compte — jamais le sien (pas d'auto-rétrogradation). */
export async function setUserRoleAction(userId: string, formData: FormData): Promise<void> {
  const me = await requireAdmin();
  if (userId === me.id) return; // le bouton n'existe pas côté UI, ceinture+bretelles
  const role = String(formData.get("role") ?? "");
  if (!ASSIGNABLE_ROLES.includes(role as Role)) return;

  await prisma.user.update({ where: { id: userId }, data: { role: role as Role } });
  revalidatePath("/admin/users");
}

/** Bascule le statut vérifié (coche publique du profil). */
export async function toggleVerifiedAction(userId: string): Promise<void> {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { verified: true } });
  if (!user) return;
  await prisma.user.update({ where: { id: userId }, data: { verified: !user.verified } });
  revalidatePath("/admin/users");
}
