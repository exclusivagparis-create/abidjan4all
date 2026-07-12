import { prisma } from "@a4a/db";
import { getProviderForMethod, planById, type PaymentMethodId, type PlanId } from "@a4a/payments";

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
 * Démarre un checkout : Subscription (sans toucher au plan actif) + Payment
 * `pending`, puis session chez le prestataire. Retourne l'URL de paiement.
 */
export async function startCheckout(
  userId: string,
  email: string,
  planId: Exclude<PlanId, "corporate">,
  method: PaymentMethodId
): Promise<{ checkoutUrl: string }> {
  const plan = planById(planId);
  if (!plan?.price) throw new Error("Offre invalide.");

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

function planForAmount(amount: number): Exclude<PlanId, "corporate"> | null {
  const plan = ["essentiel", "pro"].find((p) => planById(p)?.price === amount);
  return (plan as Exclude<PlanId, "corporate">) ?? null;
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
