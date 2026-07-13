"use server";

import { compare, hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";

async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/parametres");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login?next=/parametres");
  return user;
}

export type ProfileResult = { ok: true; message: string } | { ok: false; error: string };

/** Met à jour le nom affiché (l'e-mail n'est jamais modifiable). */
export async function updateOwnNameAction(_prev: ProfileResult | undefined, formData: FormData): Promise<ProfileResult> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (name.length < 2) return { ok: false, error: "Le nom doit faire au moins 2 caractères." };

  await prisma.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/parametres");
  revalidatePath("/espace-membre");
  revalidatePath(`/membre/${user.id}`);
  return { ok: true, message: "Nom mis à jour." };
}

/** Change le mot de passe après vérification de l'actuel. */
export async function changeOwnPasswordAction(
  _prev: ProfileResult | undefined,
  formData: FormData
): Promise<ProfileResult> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!user.passwordHash) return { ok: false, error: "Ce compte n'utilise pas de mot de passe." };
  if (!(await compare(current, user.passwordHash))) return { ok: false, error: "Mot de passe actuel incorrect." };
  if (next.length < 8) return { ok: false, error: "Le nouveau mot de passe doit faire au moins 8 caractères." };
  if (next !== confirm) return { ok: false, error: "La confirmation ne correspond pas." };

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hash(next, 10) } });
  return { ok: true, message: "Mot de passe modifié." };
}
