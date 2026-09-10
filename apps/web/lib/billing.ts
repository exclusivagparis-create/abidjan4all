import { prisma } from "@a4a/db";
import { getProviderForMethod, type PaymentMethodId } from "@a4a/payments";
import { offreParId } from "@/lib/offres";
import { finDePeriodeMensuelle } from "@/lib/periode";

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
 * Le compte de la session n'existe plus en base : jeton signé encore valide
 * mais utilisateur supprimé depuis. Distinguée d'un refus du prestataire,
 * sinon l'abonné voit « moyen de paiement indisponible » et essaie en vain
 * tous les moyens — le paiement n'a en réalité jamais été tenté.
 */
export class CompteIntrouvableError extends Error {
  constructor() {
    super("Le compte de cette session n'existe plus.");
    this.name = "CompteIntrouvableError";
  }
}

/**
 * Démarre un checkout : Subscription (sans toucher au plan actif) + Payment
 * `pending`, puis session chez le prestataire. Retourne l'URL de paiement.
 */
export async function startCheckout(
  userId: string,
  email: string,
  planId: string,
  method: PaymentMethodId
): Promise<{ checkoutUrl: string }> {
  const offre = await offreParId(planId);
  if (!offre || !offre.active || offre.prixCatalogue <= 0) throw new Error("Offre invalide.");

  // Contrôle avant écriture : sans lui, l'upsert viole la clé étrangère
  // Subscription_userId_fkey et l'erreur remonte en « refus du prestataire ».
  const compte = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!compte) throw new CompteIntrouvableError();

  const subscription = await prisma.subscription.upsert({
    where: { userId },
    create: { userId, plan: "free", status: "active", method },
    update: { method },
  });

  const provider = getProviderForMethod(method);
  const payment = await prisma.payment.create({
    data: {
      subscriptionId: subscription.id,
      // L'offre est inscrite ici et relue telle quelle au fulfillment. La
      // déduire du montant, comme avant, devenait faux dès la première
      // remise : le paiement était encaissé puis rejeté, faute d'offre au
      // prix correspondant.
      offerId: offre.id,
      amount: offre.prix,
      listAmount: offre.prixCatalogue,
      currency: "XOF",
      provider: provider.id,
      providerRef: "", // renseignée juste après par la session prestataire
      status: "pending",
    },
  });

  const session = await provider.createCheckout({
    paymentId: payment.id,
    amount: offre.prix,
    currency: "XOF",
    method,
    customerEmail: email,
    returnUrl: "/espace-membre?bienvenue=1",
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { providerRef: session.providerRef, provider: session.provider },
  });

  return { checkoutUrl: session.checkoutUrl };
}

/**
 * Repli pour les paiements antérieurs à la mise en base des offres : ils
 * n'ont pas d'`offerId`, seulement leur montant. Sans remise à l'époque, le
 * montant identifiait l'offre sans ambiguïté. Ne sert plus aux paiements neufs.
 */
async function offrePourMontant(amount: number): Promise<string | null> {
  const offres = await prisma.offer.findMany({
    where: { price: amount, id: { not: "free" } },
    select: { id: true },
  });
  // Deux offres au même prix rendraient le repli arbitraire : mieux vaut
  // renoncer que d'activer la mauvaise offre.
  const [seule] = offres;
  return offres.length === 1 && seule ? seule.id : null;
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

  const plan = payment.offerId ?? (await offrePourMontant(payment.amount));
  if (!plan) return { ok: false, error: "Paiement sans offre identifiable." };

  /**
   * Nouvelle échéance.
   *
   * Deux règles, chacune corrigeant un défaut constaté :
   *
   * — On repart de la fin de période en cours, pas de l'instant du paiement.
   *   Sans cela, renouveler trois jours avant l'échéance faisait perdre ces
   *   trois jours, déjà payés.
   *
   * — Le jour anniversaire vient de `since`, la date de souscription, et non
   *   de l'échéance précédente. Un mois court rabote la date (31 janvier →
   *   28 février) ; ancrer sur cette date rabotée l'aurait figée à 28 pour
   *   toujours. En repartant de `since`, le 31 revient dès mars.
   *
   * Un abonnement expiré redémarre à la date du paiement : lui rendre son
   * ancien jour anniversaire lui offrirait les semaines d'interruption.
   */
  const maintenant = new Date();
  const enCours = payment.subscription.currentPeriodEnd && payment.subscription.currentPeriodEnd > maintenant;
  const depart = enCours ? payment.subscription.currentPeriodEnd! : maintenant;
  const ancre = enCours ? payment.subscription.since : maintenant;
  const periodEnd = finDePeriodeMensuelle(depart, ancre);

  const year = new Date().getFullYear();
  const count = await prisma.invoice.count();
  const invoiceNumber = `A4A-${year}-${String(count + 1).padStart(6, "0")}`;

  await prisma.$transaction([
    prisma.payment.update({ where: { id: payment.id }, data: { status: "succeeded" } }),
    prisma.subscription.update({
      where: { id: payment.subscriptionId },
      // `since` est recalé quand un compte non payant s'abonne pour de bon :
      // la ligne Subscription naît dès la première tentative de checkout, si
      // bien qu'un essai abandonné en janvier aurait fixé le jour
      // anniversaire d'un abonnement réellement souscrit en mars.
      data: {
        plan,
        status: "active",
        currentPeriodEnd: periodEnd,
        ...(enCours ? {} : { since: maintenant }),
      },
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
