"use server";

import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { prisma } from "@a4a/db";
import { emailLayout, sendEmail } from "@/lib/email";
import { rattacherInscriptionsNewsletter } from "@/lib/newsletter-rattachement";

const JOURS_VALIDITE = 3;

function siteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

function jeton(): string {
  return randomBytes(32).toString("hex");
}

/** Contrôle d'adresse volontairement simple : la preuve, c'est le lien reçu. */
function emailPlausible(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email);
}

export type RegisterResult = { ok: true; email: string } | { ok: false; error: string };

/**
 * Inscription libre. Le compte est créé en `member` mais SANS e-mail validé :
 * la connexion reste refusée jusqu'au clic sur le lien envoyé.
 *
 * Anti-énumération : si l'adresse est déjà prise, on renvoie le même message
 * de succès que pour une inscription réussie — sinon ce formulaire dirait à
 * n'importe qui si telle personne a un compte sur le site.
 */
export async function registerAction(
  _prev: RegisterResult | undefined,
  formData: FormData
): Promise<RegisterResult> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  // Pot de miel : rempli uniquement par un robot.
  if (String(formData.get("site") ?? "")) return { ok: true, email };

  if (name.length < 2) return { ok: false, error: "Indiquez votre nom." };
  if (!emailPlausible(email)) return { ok: false, error: "Cette adresse e-mail ne semble pas valide." };
  if (password.length < 8) return { ok: false, error: "Le mot de passe doit faire au moins 8 caractères." };
  if (password !== confirm) return { ok: false, error: "La confirmation ne correspond pas." };

  const existant = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });

  if (existant) {
    // Compte déjà validé : on ne crée rien et on ne le dit pas. La personne
    // qui possède réellement l'adresse reçoit un rappel par e-mail.
    if (existant.emailVerified) {
      await sendEmail({
        to: email,
        subject: "Vous avez déjà un compte Abidjan4All",
        html: emailLayout(
          "Vous avez déjà un compte",
          `<p>Une inscription vient d'être tentée avec cette adresse. Vous possédez déjà un compte Abidjan4All.</p>
           <p>Si vous avez oublié votre mot de passe, vous pouvez le réinitialiser.</p>`,
          { label: "Mot de passe oublié", url: siteUrl("/mot-de-passe-oublie") }
        ),
      });
      return { ok: true, email };
    }
    // Inscription restée en attente : on renvoie simplement un nouveau lien.
    await envoyerLienValidation(existant.id, email, name);
    return { ok: true, email };
  }

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hash(password, 10), role: "member" },
    select: { id: true },
  });
  // Une adresse peut avoir été inscrite à une newsletter avant que son
  // titulaire n'ait un compte : on les réunit dès la création.
  await rattacherInscriptionsNewsletter(user.id, email);
  await envoyerLienValidation(user.id, email, name);
  return { ok: true, email };
}

async function envoyerLienValidation(userId: string, email: string, name: string) {
  const token = jeton();
  const expiresAt = new Date(Date.now() + JOURS_VALIDITE * 24 * 3600 * 1000);
  // Les liens précédents non utilisés sont annulés : un seul lien vivant.
  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.emailVerificationToken.create({ data: { token, userId, expiresAt } }),
  ]);

  await sendEmail({
    to: email,
    subject: "Confirmez votre adresse — Abidjan4All",
    html: emailLayout(
      "Bienvenue sur Abidjan4All",
      `<p>Bonjour ${name},</p>
       <p>Confirmez votre adresse pour activer votre compte membre : accès à votre espace, aux groupes,
       aux commentaires et aux petites annonces.</p>
       <p style="color:#777;font-size:13px">Ce lien est valable ${JOURS_VALIDITE} jours. Si vous n'êtes pas à
       l'origine de cette inscription, ignorez simplement cet e-mail.</p>`,
      { label: "Confirmer mon adresse", url: siteUrl(`/verification-email?token=${token}`) }
    ),
  });
}

export type VerifyResult = { ok: true; name: string } | { ok: false; error: string };

/** Valide l'adresse à partir du jeton reçu par e-mail (usage unique). */
export async function verifyEmailToken(token: string): Promise<VerifyResult> {
  if (!token) return { ok: false, error: "Lien incomplet." };
  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, name: true, emailVerified: true } } },
  });
  if (!record) return { ok: false, error: "Ce lien de confirmation est invalide." };
  if (record.user.emailVerified) return { ok: true, name: record.user.name }; // déjà fait : on ne punit pas un second clic
  if (record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, error: "Ce lien a expiré. Recommencez votre inscription pour en recevoir un nouveau." };
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  return { ok: true, name: record.user.name };
}

export type ResetResult = { ok: true } | { ok: false; error: string };

/**
 * Demande de réinitialisation. Réutilise PasswordSetToken et la page
 * /definir-mot-de-passe déjà en place pour les comptes créés par l'admin.
 *
 * Anti-énumération : réponse identique que l'adresse existe ou non.
 */
export async function requestPasswordResetAction(
  _prev: ResetResult | undefined,
  formData: FormData
): Promise<ResetResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  if (!emailPlausible(email)) return { ok: false, error: "Cette adresse e-mail ne semble pas valide." };

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (user) {
    const token = jeton();
    await prisma.$transaction([
      prisma.passwordSetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.passwordSetToken.create({
        data: { token, userId: user.id, expiresAt: new Date(Date.now() + 2 * 3600 * 1000) },
      }),
    ]);
    await sendEmail({
      to: email,
      subject: "Réinitialiser votre mot de passe — Abidjan4All",
      html: emailLayout(
        "Réinitialiser votre mot de passe",
        `<p>Bonjour ${user.name},</p>
         <p>Vous avez demandé à changer votre mot de passe. Ce lien est valable 2 heures et ne fonctionne qu'une fois.</p>
         <p style="color:#777;font-size:13px">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail :
         votre mot de passe actuel reste valable.</p>`,
        { label: "Choisir un nouveau mot de passe", url: siteUrl(`/definir-mot-de-passe?token=${token}`) }
      ),
    });
  }
  return { ok: true };
}
