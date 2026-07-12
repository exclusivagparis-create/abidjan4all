/**
 * @a4a/payments — offres A4A+ et abstraction des prestataires de paiement.
 * DF-03 : PayDunya/CinetPay (MoMo, Orange Money, carte) + Stripe/PayPal (international).
 */

export type PlanId = "essentiel" | "pro" | "corporate";
export type PaymentMethodId = "momo" | "orange" | "card" | "paypal";

export interface Plan {
  id: PlanId;
  name: string;
  /** XOF / mois — null : sur devis */
  price: number | null;
  tagline: string;
  features: string[];
  highlight?: boolean;
}

/** Offres A4A+ (DATA_MODEL.md : Essentiel 2 000 · Pro 4 000 · Corporate sur devis). */
export const PLANS: Plan[] = [
  {
    id: "essentiel",
    name: "Essentiel",
    price: 2000,
    tagline: "Tout le journal, sans publicité.",
    features: [
      "Articles premium en illimité",
      "Archives complètes",
      "Sans publicité",
      "Newsletter abonnés",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 4000,
    tagline: "Pour décider : data et rapports.",
    highlight: true,
    features: [
      "Tout Essentiel",
      "Rapports Business & Cacao",
      "Données et indicateurs exportables",
      "5 articles cadeaux / mois",
    ],
  },
  {
    id: "corporate",
    name: "Corporate",
    price: null,
    tagline: "Accès multi-comptes pour votre organisation.",
    features: [
      "Tout Pro",
      "Licences multi-utilisateurs",
      "Veille sectorielle dédiée",
      "Facturation centralisée",
    ],
  },
];

export const METHODS: { id: PaymentMethodId; label: string }[] = [
  { id: "momo", label: "MTN Mobile Money" },
  { id: "orange", label: "Orange Money" },
  { id: "card", label: "Carte bancaire" },
  { id: "paypal", label: "PayPal" },
];

export function planById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

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

/** Sélection du prestataire actif (PAYMENT_PROVIDER=paydunya | mock). */
export function getProvider(): PaymentProvider {
  if (process.env.PAYMENT_PROVIDER?.toLowerCase() === "paydunya") return paydunyaProvider;
  return mockProvider;
}
// TODO(DF-03 prod) : stripeProvider (STRIPE_SECRET_KEY, Checkout Sessions)
// pour les paiements internationaux hors zone XOF.

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
