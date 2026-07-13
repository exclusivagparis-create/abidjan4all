"use server";

import { hash } from "bcryptjs";
import { prisma } from "@a4a/db";

export type SetPasswordResult = { ok: true } | { ok: false; error: string };

/** Définit le mot de passe via un jeton d'invitation à usage unique. */
export async function setPasswordWithTokenAction(
  _prev: SetPasswordResult | undefined,
  formData: FormData
): Promise<SetPasswordResult> {
  const token = String(formData.get("token") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 8) return { ok: false, error: "Le mot de passe doit faire au moins 8 caractères." };
  if (next !== confirm) return { ok: false, error: "La confirmation ne correspond pas." };

  const record = await prisma.passwordSetToken.findUnique({ where: { token } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, error: "Lien invalide ou expiré — demandez un nouveau lien à l'administration." };
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hash(next, 10) } }),
    prisma.passwordSetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // invalide les autres jetons éventuels du même compte
    prisma.passwordSetToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);
  return { ok: true };
}
