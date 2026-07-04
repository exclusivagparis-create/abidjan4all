"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";

/** Session dont l'utilisateur existe toujours en base (un re-seed dev invalide les JWT). */
async function requireFreshUser(nextPath: string) {
  const session = await auth();
  if (!session?.user) redirect(`/login?next=${nextPath}`);
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } });
  if (!user) redirect(`/login?next=${nextPath}`);
  return user;
}

function revalidateCommunity(userId: string) {
  revalidatePath("/groupes");
  revalidatePath("/espace-membre");
  revalidatePath(`/membre/${userId}`);
}

/** Rejoint un groupe ; le compteur marketing suit les adhésions réelles. */
export async function joinGroupAction(groupSlug: string): Promise<void> {
  const user = await requireFreshUser("/groupes");

  const group = await prisma.group.findUnique({
    where: { slug: groupSlug },
    include: { members: { where: { id: user.id }, select: { id: true } } },
  });
  if (!group) redirect("/groupes");
  if (group.members.length > 0) return; // déjà membre — pas de double incrément

  await prisma.group.update({
    where: { id: group.id },
    data: { members: { connect: { id: user.id } }, membersCount: { increment: 1 } },
  });
  revalidateCommunity(user.id);
}

/** Quitte un groupe. */
export async function leaveGroupAction(groupSlug: string): Promise<void> {
  const user = await requireFreshUser("/groupes");

  const group = await prisma.group.findUnique({
    where: { slug: groupSlug },
    include: { members: { where: { id: user.id }, select: { id: true } } },
  });
  if (!group) redirect("/groupes");
  if (group.members.length === 0) return;

  await prisma.group.update({
    where: { id: group.id },
    data: { members: { disconnect: { id: user.id } }, membersCount: { decrement: 1 } },
  });
  revalidateCommunity(user.id);
}

/** Met à jour le profil public (PATCH /me du contrat — champs communauté). */
export async function updateProfileAction(formData: FormData): Promise<void> {
  const user = await requireFreshUser("/espace-membre");

  const bio = String(formData.get("bio") ?? "").trim().slice(0, 400);
  const country = String(formData.get("country") ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 2);

  await prisma.user.update({
    where: { id: user.id },
    data: { bio: bio || null, country: /^[A-Z]{2}$/.test(country) ? country : null },
  });
  revalidateCommunity(user.id);
}
