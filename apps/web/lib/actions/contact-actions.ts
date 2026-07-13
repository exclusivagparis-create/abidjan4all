"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { emailConfigured, emailLayout, sendEmail } from "@/lib/email";

export type ContactResult = { ok: true } | { ok: false; error: string };

/** Soumission publique du formulaire de contact. */
export async function submitContactAction(_prev: ContactResult | undefined, formData: FormData): Promise<ContactResult> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 140);
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  // pot de miel anti-spam : un bot remplit ce champ caché
  if (String(formData.get("website") ?? "")) return { ok: true };

  if (name.length < 2) return { ok: false, error: "Votre nom est requis." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Adresse e-mail invalide." };
  if (subject.length < 2 || body.length < 5) return { ok: false, error: "Objet et message requis." };

  const msg = await prisma.contactMessage.create({ data: { name, email, subject, body } });

  // Notification à la rédaction (si SMTP configuré) — répondable directement.
  if (emailConfigured) {
    sendEmail({
      to: process.env.SMTP_USER!,
      subject: `[Contact] ${subject}`,
      html: emailLayout(
        `Nouveau message de ${name}`,
        `<p><b>De :</b> ${name} &lt;${email}&gt;</p><p><b>Objet :</b> ${subject}</p><hr/><p>${body.replace(/\n/g, "<br/>")}</p>`
      ),
      text: `De: ${name} <${email}>\nObjet: ${subject}\n\n${body}`,
    }).catch(() => {});
  }

  revalidatePath("/admin/contact");
  void msg;
  return { ok: true };
}

async function requirePublisher() {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    redirect("/login?next=/admin/contact");
  }
}

export async function toggleContactHandledAction(id: string): Promise<void> {
  await requirePublisher();
  const m = await prisma.contactMessage.findUnique({ where: { id }, select: { handled: true } });
  if (!m) return;
  await prisma.contactMessage.update({ where: { id }, data: { handled: !m.handled } });
  revalidatePath("/admin/contact");
}

export async function deleteContactAction(id: string): Promise<void> {
  await requirePublisher();
  await prisma.contactMessage.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/contact");
}
