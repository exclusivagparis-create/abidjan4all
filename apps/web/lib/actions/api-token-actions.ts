"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";
import { creerJeton, SCOPE_IDS, type Scope } from "@/lib/api-auth";

export type JetonResult =
  | { ok: true; token: string; prefix: string; message: string }
  | { ok: false; error: string };

export type ActionSimple = { ok: true; message: string } | { ok: false; error: string };

/**
 * Seule l'administration délivre des jetons : un jeton agit au nom d'un compte
 * et ouvre l'API en écriture — la décision ne se délègue pas. Le rôle est relu
 * en base à chaque appel, jamais pris dans le jeton de session.
 */
async function exigerAdmin(): Promise<{ id: string } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  return user?.role === "admin" ? { id: user.id } : null;
}

export async function creerJetonAction(
  _prev: JetonResult | undefined,
  formData: FormData
): Promise<JetonResult> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, error: "Réservé à l'administration." };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 3) return { ok: false, error: "Donnez un nom d'au moins 3 caractères à ce jeton." };

  const scopes = formData
    .getAll("scopes")
    .map(String)
    .filter((s): s is Scope => (SCOPE_IDS as string[]).includes(s));
  if (scopes.length === 0) return { ok: false, error: "Cochez au moins une portée." };

  const brut = String(formData.get("jours") ?? "").trim();
  const jours = brut ? Number(brut) : 0;
  if (brut && (!Number.isFinite(jours) || jours < 1 || jours > 730)) {
    return { ok: false, error: "La durée doit être comprise entre 1 et 730 jours." };
  }

  // Le jeton appartient au compte qui le crée : ses actions apparaîtront
  // signées de ce nom dans le Studio.
  const { token, prefix } = await creerJeton({
    name,
    userId: admin.id,
    scopes,
    joursValidite: jours || undefined,
  });

  revalidatePath("/admin/api");
  return {
    ok: true,
    token,
    prefix,
    message: "Jeton créé. Copiez-le maintenant : il ne sera plus jamais affiché.",
  };
}

export async function revoquerJetonAction(
  _prev: ActionSimple | undefined,
  formData: FormData
): Promise<ActionSimple> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, error: "Réservé à l'administration." };

  const id = String(formData.get("id") ?? "");
  const jeton = await prisma.apiToken.findUnique({ where: { id }, select: { id: true, revokedAt: true } });
  if (!jeton) return { ok: false, error: "Jeton introuvable." };
  if (jeton.revokedAt) return { ok: false, error: "Ce jeton est déjà révoqué." };

  // On garde la ligne plutôt que de la supprimer : la trace de ce qui a existé,
  // et de quand il a servi pour la dernière fois, vaut mieux qu'un trou.
  await prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
  revalidatePath("/admin/api");
  return { ok: true, message: "Jeton révoqué. Il est refusé dès la prochaine requête." };
}

export async function supprimerJetonAction(
  _prev: ActionSimple | undefined,
  formData: FormData
): Promise<ActionSimple> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, error: "Réservé à l'administration." };

  const id = String(formData.get("id") ?? "");
  const jeton = await prisma.apiToken.findUnique({ where: { id }, select: { revokedAt: true } });
  if (!jeton) return { ok: false, error: "Jeton introuvable." };
  if (!jeton.revokedAt) {
    return { ok: false, error: "Révoquez le jeton avant de le supprimer de la liste." };
  }

  await prisma.apiToken.delete({ where: { id } });
  revalidatePath("/admin/api");
  return { ok: true, message: "Jeton supprimé de la liste." };
}
