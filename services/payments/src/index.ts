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
