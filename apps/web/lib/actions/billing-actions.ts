"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { METHODS, PLANS, type PaymentMethodId, type PlanId } from "@a4a/payments";
import { auth } from "@/auth";
import { failPayment, fulfillPayment, startCheckout } from "@/lib/billing";

/** Depuis /abonnement : crée le paiement et redirige vers la page du PSP. */
export async function subscribeAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/abonnement");

  const plan = String(formData.get("plan"));
  const method = String(formData.get("method")) as PaymentMethodId;
  if (!PLANS.some((p) => p.id === plan && p.price) || !METHODS.some((m) => m.id === method)) {
    redirect("/abonnement"); // saisie hors formulaire officiel
  }

  const { checkoutUrl } = await startCheckout(
    session.user.id,
    session.user.email ?? "",
    plan as Exclude<PlanId, "corporate">,
    method
  );
  redirect(checkoutUrl);
}

/** Page mock PSP : simule l'issue du paiement puis revient sur le site. */
export async function settleMockPayment(paymentId: string, outcome: "paid" | "failed") {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) redirect("/abonnement");

  // Sécurité : Interdire le contournement en simulant un paiement réel
  if (payment.provider !== "mock") {
    redirect("/abonnement?echec=securite");
  }

  if (outcome === "paid") {
    const result = await fulfillPayment(payment.providerRef);
    if (!result.ok) redirect("/abonnement");
    revalidatePath("/", "layout");
    redirect("/espace-membre?bienvenue=1");
  } else {
    await failPayment(payment.providerRef);
    redirect("/abonnement?echec=1");
  }
}

/** POST /subscriptions/cancel (contrat) — fin d'accès à la fin de la période. */
export async function cancelSubscriptionAction() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await prisma.subscription.updateMany({
    where: { userId: session.user.id, status: "active", plan: { not: "free" } },
    data: { status: "canceled" },
  });
  revalidatePath("/espace-membre");
  redirect("/espace-membre");
}
