import { z } from "zod";
import { apiError } from "@/lib/api";
import { failPayment, fulfillPayment } from "@/lib/billing";

const WebhookInput = z.object({
  providerRef: z.string().min(1),
  status: z.enum(["succeeded", "failed"]),
});

/**
 * POST /api/v1/webhooks/payments/:provider — met à jour Subscription/Payment (contrat).
 * TODO(prod) : vérifier la signature du prestataire (PayDunya : PAYDUNYA-* headers,
 * Stripe : Stripe-Signature) avant tout traitement.
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!["mock", "paydunya", "cinetpay", "stripe", "paypal"].includes(provider)) {
    return apiError("unknown_provider", "Prestataire inconnu.", 404);
  }

  const parsed = WebhookInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Payload invalide.", 400);

  if (parsed.data.status === "succeeded") {
    const result = await fulfillPayment(parsed.data.providerRef);
    if (!result.ok) return apiError("fulfillment_failed", result.error, 422);
    return Response.json({ received: true, invoice: result.invoiceNumber });
  }

  await failPayment(parsed.data.providerRef);
  return Response.json({ received: true });
}
