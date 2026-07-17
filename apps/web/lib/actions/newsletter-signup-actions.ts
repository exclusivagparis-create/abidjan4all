"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";
import { emailConfigured, emailLayout, sendEmail } from "@/lib/email";
import { unsubUrl } from "@/lib/newsletter";

export type SignupResult = { ok: true; email: string } | { ok: false; error: string };

/** Newsletter visée par le formulaire public : la principale, sinon la première. */
async function newsletterParDefaut() {
  return (
    (await prisma.newsletter.findUnique({ where: { slug: "essentiel-du-matin" } })) ??
    (await prisma.newsletter.findFirst({ orderBy: { slug: "asc" } }))
  );
}

/**
 * Inscription à la newsletter depuis le site public.
 *
 * Consentement simple : l'inscrit est actif immédiatement (`confirmed`), car
 * l'envoi ne s'adresse qu'aux inscrits confirmés — une double confirmation
 * laisserait la liste vide tant que la délivrabilité n'est pas parfaite
 * (DKIM non encore publié). Chaque envoi porte un lien de désabonnement.
 *
 * Anti-énumération : la réponse est identique que l'adresse soit déjà inscrite
 * ou non — sinon ce formulaire dirait qui est abonné.
 */
export async function subscribeNewsletterAction(
  _prev: SignupResult | undefined,
  formData: FormData
): Promise<SignupResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  // Pot de miel : rempli uniquement par un robot.
  if (String(formData.get("site") ?? "")) return { ok: true, email };

  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
    return { ok: false, error: "Cette adresse e-mail ne semble pas valide." };
  }

  const lettre = await newsletterParDefaut();
  if (!lettre) return { ok: false, error: "Aucune newsletter n'est disponible pour l'instant." };

  const dejaInscrit = await prisma.newsletterSubscription.findUnique({
    where: { newsletterId_email: { newsletterId: lettre.id, email } },
    select: { id: true },
  });

  if (!dejaInscrit) {
    // Rattache l'inscription au compte si la personne est connectée.
    const session = await auth();
    const userId = session?.user?.id
      ? (await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } }))?.id
      : undefined;

    await prisma.$transaction([
      prisma.newsletterSubscription.create({
        data: { newsletterId: lettre.id, email, confirmed: true, userId },
      }),
      prisma.newsletter.update({
        where: { id: lettre.id },
        data: { subscribersCount: { increment: 1 } },
      }),
    ]);

    if (emailConfigured) {
      sendEmail({
        to: email,
        subject: `Bienvenue dans « ${lettre.name} »`,
        html: emailLayout(
          `Vous êtes inscrit à « ${lettre.name} »`,
          `<p>Merci — vous recevrez désormais ${lettre.name} d'Abidjan4All.</p>
           <p style="color:#777;font-size:13px">Vous pouvez vous désinscrire à tout moment,
           en un clic, depuis le lien présent en bas de chaque envoi.</p>`,
          { label: "Me désinscrire", url: unsubUrl(lettre.id, email) }
        ),
      }).catch(() => {});
    }
  }

  revalidatePath("/admin/newsletters");
  return { ok: true, email };
}
