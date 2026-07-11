import { z } from "zod";
import { verifyWebhookSignature } from "@a4a/payments";
import { apiError } from "@/lib/api";
import { failPayment, fulfillPayment } from "@/lib/billing";

const WebhookInput = z.object({
  providerRef: z.string().min(1),
  status: z.enum(["succeeded", "failed"]),
});

/**
 * POST /api/v1/webhooks/payments/:provider — met à jour Subscription/Payment (contrat).
 *
 * Signature : schéma générique HMAC-SHA256 (`x-a4a-signature` hexadécimal sur
 * `${x-a4a-timestamp}.${corps brut}`, fenêtre anti-rejeu 5 min) exigé dès que
 * PAYMENTS_WEBHOOK_SECRET est renseigné ; sans secret (dev), passage avec
 * avertissement. TODO(prod) : brancher le schéma natif de chaque PSP dans son
 * adaptateur @a4a/payments (PayDunya : hash SHA-512 du master key ; Stripe :
 * en-tête Stripe-Signature).
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!["mock", "paydunya", "cinetpay", "stripe", "paypal"].includes(provider)) {
    return apiError("unknown_provider", "Prestataire inconnu.", 404);
  }

  const rawBody = await request.text();

  const secret = process.env.PAYMENTS_WEBHOOK_SECRET;
  if (secret) {
    const verdict = verifyWebhookSignature(
      rawBody,
      {
        signature: request.headers.get("x-a4a-signature"),
        timestamp: request.headers.get("x-a4a-timestamp"),
      },
      secret
    );
    if (!verdict.ok) {
      console.warn(`[webhook:${provider}] rejeté — ${verdict.reason}`);
      return apiError("invalid_signature", "Signature du webhook invalide.", 401);
    }
  } else {
    if (process.env.NODE_ENV === "production" && provider !== "mock") {
      console.error(`[webhook:${provider}] rejeté en production car PAYMENTS_WEBHOOK_SECRET n'est pas configuré.`);
      return apiError("invalid_signature", "Signature requise en production.", 500);
    }
    console.warn(`[webhook:${provider}] PAYMENTS_WEBHOOK_SECRET absent — signature NON vérifiée (dev uniquement)`);
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return apiError("invalid_input", "Payload invalide.", 400);
  }
  const parsed = WebhookInput.safeParse(json);
  if (!parsed.success) return apiError("invalid_input", "Payload invalide.", 400);

  if (parsed.data.status === "succeeded") {
    const result = await fulfillPayment(parsed.data.providerRef);
    if (!result.ok) return apiError("fulfillment_failed", result.error, 422);
    return Response.json({ received: true, invoice: result.invoiceNumber });
  }

  await failPayment(parsed.data.providerRef);
  return Response.json({ received: true });
}
