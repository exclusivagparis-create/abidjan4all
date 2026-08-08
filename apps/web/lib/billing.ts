import { prisma } from "@a4a/db";
import { getProviderForMethod, planById, PLANS, type PaymentMethodId, type PlanId } from "@a4a/payments";

/**
 * Abonnement payant en cours de validité (paywall, espace membre).
 * Un abonnement résilié garde l'accès jusqu'à la fin de la période payée.
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub || sub.plan === "free") return false;
  const inPeriod = !sub.currentPeriodEnd || sub.currentPeriodEnd > new Date();
  if (sub.status === "active") return inPeriod;
  if (sub.status === "canceled") return Boolean(sub.currentPeriodEnd && sub.currentPeriodEnd > new Date());
  return false;
}

/**
 * Le compte de la session n'existe plus en base : jeton signé encore valide
 * mais utilisateur supprimé depuis. Distinguée d'un refus du prestataire,
 * sinon l'abonné voit « moyen de paiement indisponible » et essaie en vain
 * tous les moyens — le paiement n'a en réalité jamais été tenté.
 */
export class CompteIntrouvableError extends Error {
  constructor() {
    super("Le compte de cette session n'existe plus.");
    this.name = "CompteIntrouvableError";
  }
}

/**
 * Démarre un checkout : Subscription (sans toucher au plan actif) + Payment
 * `pending`, puis session chez le prestataire. Retourne l'URL de paiement.
 */
export async function startCheckout(
  userId: string,
  email: string,
  planId: PlanId,
  method: PaymentMethodId
): Promise<{ checkoutUrl: string }> {
  const plan = planById(planId);
  if (!plan?.price) throw new Error("Offre invalide.");

  // Contrôle avant écriture : sans lui, l'upsert viole la clé étrangère
  // Subscription_userId_fkey et l'erreur remonte en « refus du prestataire ».
  const compte = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!compte) throw new CompteIntrouvableError();

  const subscription = await prisma.subscription.upsert({
    where: { userId },
    create: { userId, plan: "free", status: "active", method },
    update: { method },
  });

  const provider = getProviderForMethod(method);
  const payment = await prisma.payment.create({
    data: {
      subscriptionId: subscription.id,
      amount: plan.price,
      currency: "XOF",
      provider: provider.id,
      providerRef: "", // renseignée juste après par la session prestataire
      status: "pending",
    },
  });

  const session = await provider.createCheckout({
    paymentId: payment.id,
    amount: plan.price,
    currency: "XOF",
    method,
    customerEmail: email,
    returnUrl: "/espace-membre?bienvenue=1",
  });

  // le plan payé est retrouvé au fulfillment à partir du montant
  await prisma.payment.update({
    where: { id: payment.id },
    data: { providerRef: session.providerRef, provider: session.provider },
  });

  return { checkoutUrl: session.checkoutUrl };
}

/**
 * Retrouve l'offre payée à partir du montant encaissé. Dérivé de PLANS et non
 * d'une liste écrite à la main : à l'ajout de « Diaspora », une liste figée
 * aurait laissé le paiement sans offre correspondante — encaissé, jamais activé.
 */
function planForAmount(amount: number): PlanId | null {
  return PLANS.find((p) => p.price === amount)?.id ?? null;
}

/**
 * Confirme un paiement (webhook prestataire ou page mock) : Payment
 * `succeeded`, Subscription activée un mois, Invoice numérotée.
 * Idempotent : rejouer le webhook ne crée rien de plus.
 */
export async function fulfillPayment(
  providerRef: string
): Promise<{ ok: true; invoiceNumber: string } | { ok: false; error: string }> {
  const payment = await prisma.payment.findFirst({
    where: { providerRef },
    include: { subscription: true, invoice: true },
  });
  if (!payment) return { ok: false, error: "Paiement inconnu." };
  if (payment.status === "succeeded" && payment.invoice) {
    return { ok: true, invoiceNumber: payment.invoice.number }; // déjà traité
  }

  const plan = planForAmount(payment.amount);
  if (!plan) return { ok: false, error: "Montant sans offre correspondante." };

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const year = new Date().getFullYear();
  const count = await prisma.invoice.count();
  const invoiceNumber = `A4A-${year}-${String(count + 1).padStart(6, "0")}`;

  await prisma.$transaction([
    prisma.payment.update({ where: { id: payment.id }, data: { status: "succeeded" } }),
    prisma.subscription.update({
      where: { id: payment.subscriptionId },
      data: { plan, status: "active", currentPeriodEnd: periodEnd },
    }),
    prisma.invoice.create({
      data: {
        paymentId: payment.id,
        number: invoiceNumber,
        url: `/invoices/${invoiceNumber}.pdf`, // génération PDF : à venir
      },
    }),
  ]);

  return { ok: true, invoiceNumber };
}

/** Échec/abandon chez le prestataire. */
export async function failPayment(providerRef: string): Promise<void> {
  await prisma.payment.updateMany({
    where: { providerRef, status: "pending" },
    data: { status: "failed" },
  });
}
