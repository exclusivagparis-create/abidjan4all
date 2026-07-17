"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { sanitizeArticleHtml } from "@/lib/sanitize-html";
import { emailConfigured, sendEmail } from "@/lib/email";
import { buildEditionHtml, unsubUrl } from "@/lib/newsletter";

async function requirePublisher() {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    redirect("/login?next=/admin/newsletters");
  }
}

/** Crée une édition (brouillon) pour une newsletter. */
export async function createEditionAction(formData: FormData): Promise<void> {
  await requirePublisher();
  const newsletterId = String(formData.get("newsletterId") ?? "");
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 160);
  const introHtml = sanitizeArticleHtml(String(formData.get("introHtml") ?? ""));
  const articleIds = formData.getAll("articleIds").map((s) => String(s)).slice(0, 12);

  const nl = await prisma.newsletter.findUnique({ where: { id: newsletterId } });
  if (!nl || subject.length < 2) redirect("/admin/newsletters?erreur=1");

  const edition = await prisma.newsletterEdition.create({
    data: { newsletterId, subject, introHtml, articleIds },
  });
  revalidatePath("/admin/newsletters");
  redirect(`/admin/newsletters/${edition.id}`);
}

export async function updateEditionAction(id: string, formData: FormData): Promise<void> {
  await requirePublisher();
  const edition = await prisma.newsletterEdition.findUnique({ where: { id } });
  if (!edition || edition.status === "sent") redirect(`/admin/newsletters/${id}`);

  const subject = String(formData.get("subject") ?? "").trim().slice(0, 160);
  const introHtml = sanitizeArticleHtml(String(formData.get("introHtml") ?? ""));
  const articleIds = formData.getAll("articleIds").map((s) => String(s)).slice(0, 12);
  if (subject.length < 2) redirect(`/admin/newsletters/${id}?erreur=1`);

  await prisma.newsletterEdition.update({ where: { id }, data: { subject, introHtml, articleIds } });
  revalidatePath(`/admin/newsletters/${id}`);
  redirect(`/admin/newsletters/${id}?ok=1`);
}

/**
 * Choix des destinataires d'une édition (cases à cocher).
 *
 * Tout coché = liste vide en base : l'édition suivra alors automatiquement la
 * liste des inscrits, y compris ceux arrivés après ce réglage. Une sélection
 * partielle est figée sur les adresses retenues.
 */
export async function setRecipientsAction(id: string, formData: FormData): Promise<void> {
  await requirePublisher();
  const edition = await prisma.newsletterEdition.findUnique({ where: { id } });
  if (!edition || edition.status === "sent") redirect(`/admin/newsletters/${id}`);

  const choisis = formData.getAll("recipients").map((s) => String(s));
  const tous = await prisma.newsletterSubscription.findMany({
    where: { newsletterId: edition.newsletterId, confirmed: true },
    select: { email: true },
  });
  const toutSelectionne = choisis.length === tous.length;

  await prisma.newsletterEdition.update({
    where: { id },
    data: { recipientEmails: toutSelectionne ? [] : choisis },
  });
  revalidatePath(`/admin/newsletters/${id}`);
  redirect(`/admin/newsletters/${id}?dest=${choisis.length}`);
}

export async function deleteEditionAction(id: string): Promise<void> {
  await requirePublisher();
  await prisma.newsletterEdition.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/newsletters");
  redirect("/admin/newsletters");
}

/**
 * Envoie l'édition aux abonnés confirmés de la newsletter. Envoi par lots
 * (SMTP mutualisé), lien de désabonnement par destinataire. Idempotent : une
 * édition déjà « sent » n'est pas réexpédiée.
 */
export async function sendEditionAction(id: string): Promise<void> {
  await requirePublisher();
  if (!emailConfigured) redirect(`/admin/newsletters/${id}?erreur=smtp`);

  const edition = await prisma.newsletterEdition.findUnique({
    where: { id },
    include: { newsletter: true },
  });
  if (!edition || edition.status === "sent") redirect(`/admin/newsletters/${id}`);

  const ids = Array.isArray(edition.articleIds) ? (edition.articleIds as string[]) : [];
  const articlesRaw = ids.length
    ? await prisma.article.findMany({
        where: { id: { in: ids }, status: "published", hidden: false },
        select: { id: true, slug: true, title: true, dek: true, rubrique: { select: { slug: true, name: true, color: true } } },
      })
    : [];
  // conserver l'ordre choisi
  const articles = ids.map((aid) => articlesRaw.find((a) => a.id === aid)).filter(Boolean) as typeof articlesRaw;

  // Destinataires : la sélection de l'édition si elle existe, sinon tous les
  // inscrits confirmés. Le filtre sur les inscrits reste appliqué dans les deux
  // cas : une adresse désinscrite entre-temps ne doit pas recevoir l'envoi.
  const choisis = Array.isArray(edition.recipientEmails) ? (edition.recipientEmails as string[]) : [];
  const subs = await prisma.newsletterSubscription.findMany({
    where: {
      newsletterId: edition.newsletterId,
      confirmed: true,
      ...(choisis.length > 0 ? { email: { in: choisis } } : {}),
    },
    select: { email: true },
  });

  let sent = 0;
  for (const s of subs) {
    const html = buildEditionHtml({
      newsletterName: edition.newsletter.name,
      subject: edition.subject,
      introHtml: edition.introHtml,
      articles,
      unsubscribeUrl: unsubUrl(edition.newsletterId, s.email),
    });
    const ok = await sendEmail({ to: s.email, subject: edition.subject, html });
    if (ok) sent += 1;
  }

  await prisma.newsletterEdition.update({
    where: { id },
    data: { status: "sent", sentAt: new Date(), recipientCount: sent },
  });
  console.log(`[newsletter] « ${edition.subject} » envoyée à ${sent}/${subs.length} abonnés`);
  revalidatePath("/admin/newsletters");
  redirect(`/admin/newsletters/${id}?envoye=${sent}`);
}
