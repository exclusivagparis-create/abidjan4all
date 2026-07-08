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

/**
 * TODO(DF-03 prod) : paydunyaProvider (PAYDUNYA_MASTER_KEY/PRIVATE_KEY/TOKEN,
 * API Checkout-invoice) et stripeProvider (STRIPE_SECRET_KEY, Checkout Sessions).
 * Sélection par variable d'environnement PAYMENT_PROVIDER.
 */
export function getProvider(): PaymentProvider {
  return mockProvider;
}

// ---------------------------------------------------------------------------
// Signature des webhooks
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from "node:crypto";

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
