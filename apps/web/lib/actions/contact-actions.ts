"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { adresseDesEntetes, limiter } from "@/lib/limite-debit";
import { auth, PUBLISH_ROLES } from "@/auth";
import { echapperHtml, emailConfigured, emailLayout, sendEmail } from "@/lib/email";

export type ContactResult = { ok: true } | { ok: false; error: string };

/** Soumission publique du formulaire de contact. */
export async function submitContactAction(_prev: ContactResult | undefined, formData: FormData): Promise<ContactResult> {
  // Plafond : ce formulaire était ouvert sans limite. Le pot de miel arrête
  // les robots naïfs, pas un script écrit pour nous.
  {
    const { autorise, attendre } = limiter(`contact:${adresseDesEntetes(await headers())}`, 5, 3600);
    if (!autorise) {
      return { ok: false, error: `Trop de messages envoyés. Réessayez dans ${Math.ceil(attendre / 60)} minutes.` };
    }
  }

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
  // Destinataires : la boîte d'envoi (no-reply) + la boîte de contact. Doublon
  // volontaire : le message reste lisible même si l'une des deux est purgée.
  // CONTACT_TO permet de changer l'adresse sans redéployer.
  if (emailConfigured) {
    const destinataires = [process.env.SMTP_USER, process.env.CONTACT_TO ?? "contact@abidjan4all.info"]
      .filter((a): a is string => Boolean(a))
      .filter((a, i, t) => t.indexOf(a) === i); // jamais deux fois la même adresse

    sendEmail({
      to: destinataires.join(", "),
      replyTo: email, // « Répondre » écrit à l'auteur du message, pas à no-reply
      subject: `[Contact] ${subject}`,
      html: emailLayout(
        `Nouveau message de ${name}`,
        // Quatre valeurs écrites par un inconnu, échappées avant d'entrer dans
        // le HTML. Les sauts de ligne deviennent des <br/> APRÈS échappement :
        // dans l'autre ordre, l'opération réintroduirait du balisage.
        `<p><b>De :</b> ${echapperHtml(name)} &lt;${echapperHtml(email)}&gt;</p>` +
          `<p><b>Objet :</b> ${echapperHtml(subject)}</p><hr/>` +
          `<p>${echapperHtml(body).replace(/\n/g, "<br/>")}</p>`
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
