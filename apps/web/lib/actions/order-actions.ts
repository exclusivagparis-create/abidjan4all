"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import type { PaymentMethodId } from "@a4a/payments";
import { auth } from "@/auth";
import { startOrderCheckout, fulfillOrder, failOrder } from "@/lib/order-billing";
import { trouverPalier, TARIFS_WHATSAPP } from "@/lib/tarifs";

const METHODS: PaymentMethodId[] = ["momo", "orange", "wave", "moov", "djamo", "card", "paypal"];

/** Page mock PSP (commandes one-off) : simule l'issue puis revient sur le site. */
export async function settleMockOrder(orderId: string, outcome: "paid" | "failed") {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) redirect("/annonces");

  if (outcome === "paid") {
    await fulfillOrder(order.providerRef);
    revalidatePath("/", "layout");
    redirect(order.kind === "whatsapp" ? "/club?ok=1" : "/annonces?depot=paye");
  } else {
    await failOrder(order.providerRef);
    redirect(order.kind === "whatsapp" ? "/club?echec=1" : "/annonces?echec=1");
  }
}

/** Démarre le paiement d'une adhésion WhatsApp Club (palier + moyen). */
export async function startWhatsappCheckoutAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/club");

  const tierId = String(formData.get("tier") ?? "");
  const method = String(formData.get("method") ?? "") as PaymentMethodId;
  if (!trouverPalier(TARIFS_WHATSAPP, tierId) || !METHODS.includes(method)) redirect("/club?echec=saisie");

  const result = await startOrderCheckout({
    userId: session.user.id,
    email: session.user.email ?? "",
    kind: "whatsapp",
    tierId,
    method,
  });
  if (!result.ok) redirect(`/club?indisponible=1`);
  redirect(result.checkoutUrl);
}
