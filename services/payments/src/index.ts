/**
 * @a4a/payments — abstraction des prestataires de paiement.
 * DF-03 : PayDunya/CinetPay (MoMo, Orange Money, carte) + Stripe/PayPal (international).
 *
 * La grille tarifaire A4A+ ne vit plus ici : elle est administrable en base
 * (modèle `Offer`, lu par `apps/web/lib/offres.ts`). Une constante figée
 * imposait un déploiement pour changer un prix, et surtout elle ne pouvait
 * pas porter de remise.
 */

export type PaymentMethodId = "momo" | "orange" | "wave" | "moov" | "djamo" | "card" | "paypal";

/**
 * Moyens proposés à l'abonné. Côté PayDunya, le choix fait ici n'impose PAS
 * le canal : PayDunya affiche sa propre page où le client choisit son
 * opérateur (vérifié sur le compte : Orange Money, Wave, MTN, Moov, Djamo).
 * Ce champ sert donc à orienter le client et à router vers le bon prestataire.
 */
export const METHODS: { id: PaymentMethodId; label: string }[] = [
  { id: "momo", label: "MTN Mobile Money" },
  { id: "orange", label: "Orange Money" },
  { id: "wave", label: "Wave" },
  { id: "moov", label: "Moov Money" },
  { id: "djamo", label: "Djamo" },
  { id: "card", label: "Carte bancaire" },
  { id: "paypal", label: "PayPal" },
];


export function formatXOF(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

// ---------------------------------------------------------------------------
// Prestataires
// ---------------------------------------------------------------------------

export interface CheckoutRequest {
  paymentId: string;
  amount: number;
  currency: "XOF";
  method: PaymentMethodId;
  customerEmail: string;
  /** URL de retour après paiement */
  returnUrl: string;
}

export interface CheckoutSession {
  provider: string;
  /** référence chez le prestataire (reçue ensuite par le webhook) */
  providerRef: string;
  /** page de paiement vers laquelle rediriger l'utilisateur */
  checkoutUrl: string;
}

export interface PaymentProvider {
  readonly id: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
}

/**
 * Prestataire simulé (développement) : la « page de paiement » est servie par
 * l'app elle-même (/paiement/mock/:paymentId) et déclenche la même logique de
 * fulfillment que le webhook réel.
 */
export const mockProvider: PaymentProvider = {
  id: "mock",
  async createCheckout(request) {
    return {
      provider: "mock",
      providerRef: `MOCK-${request.paymentId}`,
      checkoutUrl: `/paiement/mock/${request.paymentId}`,
    };
  },
};

// ---------------------------------------------------------------------------
// PayDunya — API Checkout-invoice (MoMo / Orange Money / carte, XOF)
// Format d'après la librairie officielle paydunya-node : en-têtes
// PAYDUNYA-MASTER-KEY / PAYDUNYA-PRIVATE-KEY / PAYDUNYA-TOKEN,
// POST {base}/checkout-invoice/create, GET {base}/checkout-invoice/confirm/:token.
// ---------------------------------------------------------------------------

function paydunyaBase(): string {
  return process.env.PAYDUNYA_MODE?.toLowerCase() === "test"
    ? "https://app.paydunya.com/sandbox-api/v1"
    : "https://app.paydunya.com/api/v1";
}

function paydunyaHeaders(): Record<string, string> {
  const master = process.env.PAYDUNYA_MASTER_KEY;
  const priv = process.env.PAYDUNYA_PRIVATE_KEY;
  const token = process.env.PAYDUNYA_TOKEN;
  if (!master || !priv || !token) {
    throw new Error("PAYDUNYA_MASTER_KEY / PAYDUNYA_PRIVATE_KEY / PAYDUNYA_TOKEN manquants.");
  }
  return {
    "PAYDUNYA-MASTER-KEY": master,
    "PAYDUNYA-PRIVATE-KEY": priv,
    "PAYDUNYA-TOKEN": token,
    "Content-Type": "application/json",
  };
}

/** Domaine public absolu — PayDunya exige des URLs complètes. */
function publicUrl(path: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (!site) throw new Error("NEXT_PUBLIC_SITE_URL requis pour les URLs de retour PayDunya.");
  return path.startsWith("http") ? path : `${site}${path}`;
}

export const paydunyaProvider: PaymentProvider = {
  id: "paydunya",
  async createCheckout(request) {
    const body = {
      invoice: {
        total_amount: request.amount,
        description: `Abonnement A4A+ — Abidjan4All (${request.customerEmail})`,
      },
      store: {
        name: "Abidjan4All — Exclusiv'AG",
        website_url: publicUrl("/"),
      },
      actions: {
        return_url: publicUrl(request.returnUrl),
        cancel_url: publicUrl("/abonnement"),
        callback_url: publicUrl("/api/v1/webhooks/payments/paydunya"),
      },
      custom_data: { paymentId: request.paymentId, method: request.method },
    };

    const res = await fetch(`${paydunyaBase()}/checkout-invoice/create`, {
      method: "POST",
      headers: paydunyaHeaders(),
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      response_code?: string;
      response_text?: string;
      description?: string;
      token?: string;
    };
    if (!res.ok || json.response_code !== "00" || !json.token || !json.response_text) {
      throw new Error(
        `PayDunya create a échoué (HTTP ${res.status}, code ${json.response_code ?? "?"}) : ${json.response_text ?? json.description ?? "réponse inattendue"}`
      );
    }
    return {
      provider: "paydunya",
      providerRef: json.token, // le token de facture — reçu ensuite par l'IPN
      checkoutUrl: json.response_text, // page de paiement hébergée PayDunya
    };
  },
};

export type PaydunyaConfirmation = {
  status: "completed" | "pending" | "cancelled";
  totalAmount: number;
  receiptUrl?: string;
};

/**
 * Vérité serveur-à-serveur sur une facture PayDunya : l'IPN ne fait jamais
 * foi seul, le statut est toujours confirmé auprès de l'API.
 */
export async function confirmPaydunyaInvoice(token: string): Promise<PaydunyaConfirmation> {
  const res = await fetch(`${paydunyaBase()}/checkout-invoice/confirm/${encodeURIComponent(token)}`, {
    headers: paydunyaHeaders(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    response_code?: string;
    status?: string;
    invoice?: { total_amount?: number | string };
    receipt_url?: string;
  };
  if (!res.ok || json.response_code !== "00" || !json.status) {
    throw new Error(`PayDunya confirm a échoué (HTTP ${res.status}, code ${json.response_code ?? "?"}).`);
  }
  const status = json.status === "completed" || json.status === "cancelled" ? json.status : "pending";
  return {
    status,
    totalAmount: Number(json.invoice?.total_amount ?? 0),
    receiptUrl: json.receipt_url,
  };
}

/** L'IPN PayDunya signe avec data[hash] = SHA-512 hexadécimal du master key. */
export function verifyPaydunyaHash(hash: string | null | undefined): boolean {
  const master = process.env.PAYDUNYA_MASTER_KEY;
  if (!master || !hash) return false;
  const expected = createHash("sha512").update(master).digest("hex");
  return hash.trim().toLowerCase() === expected.toLowerCase();
}

// ---------------------------------------------------------------------------
// Stripe — Checkout Sessions (carte / PayPal, diaspora hors zone Mobile Money)
// Appels REST directs (pas de SDK) : XOF est une devise zéro-décimale chez
// Stripe, le montant part tel quel.
// ---------------------------------------------------------------------------

/** Parité fixe UEMOA : 1 EUR = 655,957 XOF (le XOF est arrimé à l'euro). */
export const XOF_PER_EUR = 655.957;

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  async createCheckout(request) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY manquante.");

    // PayPal ne supporte pas le XOF : la session part en euros à la parité
    // fixe (Payment.amount reste en XOF, le fulfillment n'y voit que du feu).
    const paypal = request.method === "paypal";
    const currency = paypal ? "eur" : "xof";
    const unitAmount = paypal
      ? Math.round((request.amount / XOF_PER_EUR) * 100) // centimes d'euro
      : request.amount; // XOF : zéro-décimale

    const form = new URLSearchParams({
      mode: "payment",
      customer_email: request.customerEmail,
      success_url: publicUrl(request.returnUrl),
      cancel_url: publicUrl("/abonnement"),
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": currency,
      "line_items[0][price_data][unit_amount]": String(unitAmount),
      "line_items[0][price_data][product_data][name]": `Abonnement A4A+ — Abidjan4All (${formatXOF(request.amount)})`,
      "metadata[paymentId]": request.paymentId,
      "metadata[method]": request.method,
      "metadata[amount_xof]": String(request.amount),
    });
    if (paypal) form.set("payment_method_types[0]", "paypal");

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };
    if (!res.ok || !json.id || !json.url) {
      throw new Error(`Stripe create a échoué (HTTP ${res.status}) : ${json.error?.message ?? "réponse inattendue"}`);
    }
    return { provider: "stripe", providerRef: json.id, checkoutUrl: json.url };
  },
};

/**
 * Vérifie l'en-tête Stripe-Signature (`t=…,v1=…`) : HMAC-SHA256 de
 * `${t}.${corps brut}` avec STRIPE_WEBHOOK_SECRET, anti-rejeu 5 min.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowS = Math.floor(Date.now() / 1000)
): WebhookVerification {
  if (!header) return { ok: false, reason: "en-tête Stripe-Signature absent" };
  const parts = new Map(
    header.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k?.trim() ?? "", v.join("=")] as const;
    })
  );
  const t = Number(parts.get("t"));
  const v1 = parts.get("v1");
  if (!Number.isFinite(t) || !v1) return { ok: false, reason: "en-tête Stripe-Signature illisible" };
  if (Math.abs(nowS - t) > WEBHOOK_TOLERANCE_S) return { ok: false, reason: "timestamp hors fenêtre (rejeu ?)" };

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(v1, "hex");
  } catch {
    return { ok: false, reason: "signature illisible" };
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: "signature invalide" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sélection du prestataire
// ---------------------------------------------------------------------------

/** Prestataire par défaut (PAYMENT_PROVIDER=paydunya | mock). */
export function getProvider(): PaymentProvider {
  if (process.env.PAYMENT_PROVIDER?.toLowerCase() === "paydunya") return paydunyaProvider;
  return mockProvider;
}

/**
 * Routage par moyen de paiement : MoMo/Orange/Wave/Moov/Djamo → PayDunya ;
 * carte/PayPal → Stripe dès que STRIPE_SECRET_KEY est configurée (diaspora
 * hors zone FCFA), sinon PayDunya prend aussi la carte. Sans PAYMENT_PROVIDER :
 * mock (dev).
 */
export function getProviderForMethod(method: PaymentMethodId): PaymentProvider {
  const base = getProvider();
  if (base.id === "mock") return base;
  if ((method === "card" || method === "paypal") && process.env.STRIPE_SECRET_KEY) {
    return stripeProvider;
  }
  return base;
}

// ---------------------------------------------------------------------------
// Signature des webhooks
// ---------------------------------------------------------------------------

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Fenêtre de validité d'un webhook signé (anti-rejeu). */
export const WEBHOOK_TOLERANCE_S = 300;

/**
 * Signe un corps de webhook — schéma générique style Stripe :
 * HMAC-SHA256(`${timestamp}.${rawBody}`) en hexadécimal.
 * Sert au simulateur de PSP et aux tests d'intégration.
 */
export function signWebhookPayload(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): {
  timestamp: number;
  signature: string;
} {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return { timestamp, signature };
}

export type WebhookVerification = { ok: true } | { ok: false; reason: string };

/**
 * Vérifie la signature générique (en-têtes x-a4a-signature / x-a4a-timestamp)
 * en temps constant, avec fenêtre anti-rejeu.
 *
 * TODO(prod) : chaque PSP a son schéma natif à brancher dans son adaptateur —
 * PayDunya : hash SHA-512 du master key dans le payload ; Stripe :
 * en-tête Stripe-Signature (t=…,v1=…) sur le corps brut.
 */
export function verifyWebhookSignature(
  rawBody: string,
  headers: { signature: string | null; timestamp: string | null },
  secret: string,
  nowS = Math.floor(Date.now() / 1000)
): WebhookVerification {
  if (!headers.signature || !headers.timestamp) {
    return { ok: false, reason: "en-têtes x-a4a-signature / x-a4a-timestamp manquants" };
  }
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "timestamp invalide" };
  if (Math.abs(nowS - ts) > WEBHOOK_TOLERANCE_S) return { ok: false, reason: "timestamp hors fenêtre (rejeu ?)" };

  const expected = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(headers.signature, "hex");
  } catch {
    return { ok: false, reason: "signature illisible" };
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: "signature invalide" };
  }
  return { ok: true };
}
