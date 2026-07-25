"use server";

import { randomBytes } from "node:crypto";
import { hashSync } from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type Role } from "@a4a/db";
import { auth } from "@/auth";
import { emailConfigured, emailLayout, sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/seo";

/** Jeton de définition de mot de passe (valide 7 jours) + e-mail d'invitation. */
async function inviteToSetPassword(userId: string, name: string, email: string): Promise<boolean> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await prisma.passwordSetToken.create({ data: { token, userId, expiresAt } });

  const url = `${SITE_URL}/definir-mot-de-passe?token=${token}`;
  return sendEmail({
    to: email,
    subject: "Bienvenue sur Abidjan4All — activez votre compte",
    html: emailLayout(
      `Bonjour ${name},`,
      `<p>Un compte vient d'être créé pour vous sur <b>Abidjan4All</b> (${email}).</p>
       <p>Pour l'activer, définissez votre mot de passe personnel en cliquant sur le bouton ci-dessous. Ce lien est valable 7 jours.</p>`,
      { label: "Définir mon mot de passe", url }
    ),
    text: `Bonjour ${name}, un compte a été créé pour vous sur Abidjan4All (${email}). Définissez votre mot de passe ici (valable 7 jours) : ${url}`,
  });
}

const ASSIGNABLE_ROLES: Role[] = ["reader", "member", "journalist", "editor", "admin", "partner", "ad_manager"];

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

export type CreateUserResult =
  | { ok: true; email: string; password?: string; invited: boolean }
  | { ok: false; error: string };

/**
 * Crée un compte (rédaction, partenaire…) avec un mot de passe initial
 * généré — affiché UNE seule fois à l'admin, stocké uniquement hashé.
 */
export async function createUserAction(
  _prev: CreateUserResult | undefined,
  formData: FormData
): Promise<CreateUserResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Session expirée." };
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (me?.role !== "admin") return { ok: false, error: "Réservé à l'administration." };

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "reader");
  if (name.length < 2) return { ok: false, error: "Nom trop court." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Email invalide." };
  if (!ASSIGNABLE_ROLES.includes(role as Role)) return { ok: false, error: "Rôle invalide." };
  if (await prisma.user.findUnique({ where: { email } })) {
    return { ok: false, error: "Un compte existe déjà avec cet email." };
  }

  // Mot de passe initial aléatoire : le compte est valide même sans e-mail,
  // et l'utilisateur le remplacera via le lien d'invitation.
  const password = randomBytes(9).toString("base64url"); // 12 caractères
  const user = await prisma.user.create({
    data: { name, email, role: role as Role, passwordHash: hashSync(password, 10) },
  });
  revalidatePath("/admin/users");

  // E-mail d'invitation si le SMTP est configuré ; sinon repli : mot de passe
  // initial affiché à l'admin (comportement précédent).
  const invited = emailConfigured ? await inviteToSetPassword(user.id, name, email) : false;
  return { ok: true, email, invited, ...(invited ? {} : { password }) };
}

export type DeleteUserResult = { ok: true } | { ok: false; error: string };

/**
 * Supprime un compte — protégé : bloqué si le compte a signé des articles,
 * téléversé des médias, publié des annonces, ou détient un abonnement payant
 * ou des paiements. Ses commentaires et inscriptions partent avec lui.
 */
export async function deleteUserAction(userId: string): Promise<DeleteUserResult> {
  const me = await requireAdmin();
  if (userId === me.id) return { ok: false, error: "Impossible de supprimer votre propre compte." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: { include: { _count: { select: { payments: true } } } },
      _count: {
        select: {
          articles: true,
          coauthoredArticles: true,
          mediaAssets: true,
          listings: true,
          comments: true,
        },
      },
    },
  });
  if (!user) return { ok: false, error: "Compte introuvable." };

  if (user._count.articles > 0 || user._count.coauthoredArticles > 0) {
    return { ok: false, error: "Ce compte signe des articles — réattribuer d'abord." };
  }
  if (user._count.mediaAssets > 0) {
    return { ok: false, error: "Ce compte a téléversé des médias — les supprimer d'abord." };
  }
  if (user._count.listings > 0) {
    return { ok: false, error: "Ce compte a des annonces marketplace." };
  }
  if (user.subscription && (user.subscription.plan !== "free" || user.subscription._count.payments > 0)) {
    return { ok: false, error: "Ce compte a un abonnement ou des paiements — historique comptable à conserver." };
  }

  const commentIds = (
    await prisma.comment.findMany({ where: { userId }, select: { id: true } })
  ).map((c) => c.id);

  await prisma.$transaction([
    // les réponses d'autres lecteurs à ses commentaires deviennent racines
    prisma.comment.updateMany({ where: { parentId: { in: commentIds } }, data: { parentId: null } }),
    prisma.comment.deleteMany({ where: { userId } }),
    prisma.enrollment.deleteMany({ where: { userId } }),
    prisma.newsletterSubscription.deleteMany({ where: { userId } }),
    ...(user.subscription ? [prisma.subscription.delete({ where: { userId } })] : []),
    prisma.user.delete({ where: { id: userId } }), // push subs en cascade, m2m auto
  ]);
  revalidatePath("/admin/users");
  return { ok: true };
}

/** Bascule le statut vérifié (coche publique du profil). */
export async function toggleVerifiedAction(userId: string): Promise<void> {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { verified: true } });
  if (!user) return;
  await prisma.user.update({ where: { id: userId }, data: { verified: !user.verified } });
  revalidatePath("/admin/users");
}
