import { z } from "zod";
import {
  confirmPaydunyaInvoice,
  verifyPaydunyaHash,
  verifyStripeSignature,
  verifyWebhookSignature,
} from "@a4a/payments";
import { apiError } from "@/lib/api";
import { failPayment, fulfillPayment } from "@/lib/billing";

const WebhookInput = z.object({
  providerRef: z.string().min(1),
  status: z.enum(["succeeded", "failed"]),
});

/**
 * POST /api/v1/webhooks/payments/:provider — met à jour Subscription/Payment (contrat).
 *
 * - `paydunya` : IPN form-encodé (`data[...]`), hash SHA-512 du master key
 *   vérifié, puis statut TOUJOURS reconfirmé serveur-à-serveur via l'API
 *   confirm/:token — l'IPN seul ne fait jamais foi.
 * - autres : schéma générique HMAC-SHA256 (`x-a4a-signature` sur
 *   `${x-a4a-timestamp}.${corps brut}`, anti-rejeu 5 min) exigé dès que
 *   PAYMENTS_WEBHOOK_SECRET est renseigné. TODO(prod) : Stripe-Signature.
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!["mock", "paydunya", "cinetpay", "stripe", "paypal"].includes(provider)) {
    return apiError("unknown_provider", "Prestataire inconnu.", 404);
  }

  const rawBody = await request.text();

  if (provider === "paydunya") return handlePaydunyaIpn(rawBody);
  if (provider === "stripe") return handleStripeEvent(rawBody, request.headers.get("stripe-signature"));

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

/** IPN PayDunya : form-encodé `data[hash]`, `data[invoice][token]`, `data[status]`… */
async function handlePaydunyaIpn(rawBody: string) {
  const form = new URLSearchParams(rawBody);
  const hash = form.get("data[hash]") ?? form.get("hash");
  if (!verifyPaydunyaHash(hash)) {
    console.warn("[webhook:paydunya] rejeté — hash SHA-512 du master key invalide ou absent");
    return apiError("invalid_signature", "Signature IPN invalide.", 401);
  }

  const token = form.get("data[invoice][token]") ?? form.get("data[token]") ?? form.get("invoice[token]");
  if (!token) return apiError("invalid_input", "Token de facture absent de l'IPN.", 400);

  // Vérité serveur-à-serveur : on ne croit pas le statut porté par l'IPN.
  const confirmation = await confirmPaydunyaInvoice(token);

  if (confirmation.status === "completed") {
    const result = await fulfillPayment(token);
    if (!result.ok) return apiError("fulfillment_failed", result.error, 422);
    console.log(`[webhook:paydunya] paiement confirmé — facture ${result.invoiceNumber}`);
    return Response.json({ received: true, invoice: result.invoiceNumber });
  }
  if (confirmation.status === "cancelled") {
    await failPayment(token);
    return Response.json({ received: true });
  }
  // pending : on accuse réception, l'IPN final arrivera plus tard
  return Response.json({ received: true, pending: true });
}

/** Événements Stripe : signature obligatoire, fulfillment sur session complétée. */
async function handleStripeEvent(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[webhook:stripe] STRIPE_WEBHOOK_SECRET absent — événement refusé");
    return apiError("not_configured", "Webhook Stripe non configuré.", 503);
  }
  const verdict = verifyStripeSignature(rawBody, signatureHeader, secret);
  if (!verdict.ok) {
    console.warn(`[webhook:stripe] rejeté — ${verdict.reason}`);
    return apiError("invalid_signature", "Signature Stripe invalide.", 401);
  }

  let event: { type?: string; data?: { object?: { id?: string } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return apiError("invalid_input", "Événement illisible.", 400);
  }
  const sessionId = event.data?.object?.id;
  if (!event.type || !sessionId) return apiError("invalid_input", "Événement incomplet.", 400);

  if (event.type === "checkout.session.completed") {
    const result = await fulfillPayment(sessionId);
    if (!result.ok) return apiError("fulfillment_failed", result.error, 422);
    console.log(`[webhook:stripe] paiement confirmé — facture ${result.invoiceNumber}`);
    return Response.json({ received: true, invoice: result.invoiceNumber });
  }
  if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    await failPayment(sessionId);
    return Response.json({ received: true });
  }
  // autres événements : accusé de réception sans action
  return Response.json({ received: true, ignored: event.type });
}
