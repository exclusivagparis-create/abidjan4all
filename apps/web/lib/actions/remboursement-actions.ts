"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type RefundStatus } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { auth, PUBLISH_ROLES } from "@/auth";
import { exigerRoleOuRediriger } from "@/lib/garde-role";
import { echapperHtml, emailConfigured, emailLayout, sendEmail } from "@/lib/email";
import { ETATS, MOTIF_MAX, MOTIF_MIN, contestable, estEtat } from "@/lib/remboursement";

/**
 * Dépose une demande de remboursement.
 *
 * Elle n'engage aucun mouvement d'argent : le remboursement se fait ensuite à
 * la main chez le prestataire. Ce que l'action garantit, c'est que la demande
 * est enregistrée, datée, et qu'elle apparaîtra au Studio.
 */
export async function demanderRemboursementAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/espace-membre");

  const paymentId = String(formData.get("paymentId") ?? "");
  const motif = String(formData.get("motif") ?? "").trim().slice(0, MOTIF_MAX);
  if (motif.length < MOTIF_MIN) redirect("/espace-membre?remb=motif");

  // Le paiement doit appartenir au demandeur : l'identifiant vient d'un
  // formulaire, il ne prouve rien par lui-même.
  const paiement = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      amount: true,
      status: true,
      createdAt: true,
      subscription: { select: { userId: true } },
      refundRequests: { select: { id: true } },
    },
  });
  if (!paiement || paiement.subscription.userId !== session.user.id) redirect("/espace-membre?remb=introuvable");

  const ouvert = contestable({
    id: paiement.id,
    createdAt: paiement.createdAt,
    status: paiement.status,
    dejaDemande: paiement.refundRequests.length > 0,
  });
  if (!ouvert) redirect("/espace-membre?remb=hors-delai");

  await prisma.refundRequest.create({
    data: { userId: session.user.id, paymentId: paiement.id, reason: motif },
  });

  // Accusé de réception : une demande d'argent sans réponse immédiate
  // inquiète, et l'inquiétude se transforme en relance téléphonique.
  if (emailConfigured && session.user.email) {
    await sendEmail({
      to: session.user.email,
      subject: "Votre demande de remboursement — Abidjan4All",
      html: emailLayout(
        "Demande enregistrée",
        `<p>Nous avons bien reçu votre demande de remboursement portant sur un paiement de <b>${formatXOF(paiement.amount)}</b>.</p>
         <p>La rédaction l'examine et vous répondra par e-mail. Le remboursement, s'il est accordé, est effectué par le prestataire de paiement d'origine et peut prendre quelques jours à apparaître sur votre compte.</p>`
      ),
      text: `Votre demande de remboursement de ${formatXOF(paiement.amount)} a bien été reçue. La rédaction vous répondra par e-mail.`,
    });
  }

  revalidatePath("/espace-membre");
  revalidatePath("/admin/remboursements");
  redirect("/espace-membre?remb=recue");
}

async function requireAdmin() {
  return exigerRoleOuRediriger(PUBLISH_ROLES, "/admin/remboursements");
}

/**
 * Tranche une demande : acceptée, refusée, ou remboursée une fois le virement
 * fait chez le prestataire.
 *
 * Le site ne rembourse pas lui-même — il enregistre la décision, son auteur
 * et sa date, et prévient le demandeur. Confondre « acceptée » et
 * « remboursée » ferait croire l'argent reparti alors que personne ne l'a
 * encore renvoyé : les deux états restent distincts pour cette raison.
 */
export async function traiterRemboursementAction(id: string, formData: FormData): Promise<void> {
  const moi = await requireAdmin();

  const etat = String(formData.get("statut") ?? "");
  if (!estEtat(etat)) redirect("/admin/remboursements");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);

  const demande = await prisma.refundRequest.update({
    where: { id },
    data: {
      status: etat as RefundStatus,
      note: note || null,
      handledById: moi.id,
      handledAt: new Date(),
    },
    include: {
      user: { select: { name: true, email: true } },
      payment: { select: { amount: true } },
    },
  });

  if (emailConfigured && demande.user.email && etat !== "en_attente") {
    const corps: Record<string, string> = {
      acceptee: `<p>Votre demande de remboursement de <b>${formatXOF(demande.payment.amount)}</b> est acceptée.</p>
                 <p>Le virement sera effectué par le prestataire de paiement d'origine ; comptez quelques jours avant de le voir apparaître.</p>`,
      refusee: `<p>Après examen, votre demande de remboursement de <b>${formatXOF(demande.payment.amount)}</b> ne peut être acceptée.</p>`,
      remboursee: `<p>Votre remboursement de <b>${formatXOF(demande.payment.amount)}</b> a été effectué auprès de votre prestataire de paiement.</p>
                   <p>Le délai d'apparition sur votre compte dépend de lui, en général quelques jours ouvrés.</p>`,
    };
    await sendEmail({
      to: demande.user.email,
      subject: `Votre demande de remboursement — ${ETATS[etat].label.toLowerCase()}`,
      html: emailLayout(
        `Bonjour ${demande.user.name},`,
        `${corps[etat] ?? ""}${note ? `<p><b>Précision de la rédaction :</b> ${echapperHtml(note)}</p>` : ""}`
      ),
      text: `Votre demande de remboursement est ${ETATS[etat].label.toLowerCase()}.${note ? ` ${note}` : ""}`,
    });
  }

  revalidatePath("/admin/remboursements");
  revalidatePath("/espace-membre");
  redirect("/admin/remboursements?ok=1");
}
