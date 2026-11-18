"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { ADMIN_ROLES } from "@/auth";
import { exigerRole } from "@/lib/garde-role";

/**
 * Accorder ou retirer le rôle « recruteur » — accès permanent à la CVthèque.
 *
 * Réservé à l'administration : cela revient à donner gratuitement ce que la
 * régie vend 400 000 F l'année.
 *
 * Le rôle REMPLACE celui du compte, et c'est le piège de cette action : la
 * passer sur un journaliste lui ferait perdre sa carte de presse. On ne
 * l'accorde donc qu'aux comptes ordinaires — `reader` et `member` — et le
 * retrait rend `member`, jamais `reader` : quelqu'un qui a eu un accès
 * recruteur a un compte, il ne redevient pas un visiteur anonyme.
 *
 * Les motifs d'échec passent par l'URL : la page est rendue au serveur, sans
 * JavaScript, comme le reste du Studio.
 */
const ROLES_ELIGIBLES = ["reader", "member"];

export async function accorderRoleRecruteur(formData: FormData): Promise<void> {
  if (!(await exigerRole(ADMIN_ROLES))) return;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/admin/cvtheque?erreur=email_vide");

  const compte = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!compte) redirect("/admin/cvtheque?erreur=introuvable");
  if (compte.role === "recruteur") redirect("/admin/cvtheque?erreur=deja");
  if (!ROLES_ELIGIBLES.includes(compte.role)) redirect("/admin/cvtheque?erreur=role_superieur");

  await prisma.user.update({ where: { id: compte.id }, data: { role: "recruteur" } });
  revalidatePath("/admin/cvtheque");
}

export async function retirerRoleRecruteur(formData: FormData): Promise<void> {
  if (!(await exigerRole(ADMIN_ROLES))) return;
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const compte = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (compte?.role !== "recruteur") return; // déjà retiré, ou jamais accordé

  await prisma.user.update({ where: { id: userId }, data: { role: "member" } });
  revalidatePath("/admin/cvtheque");
}
