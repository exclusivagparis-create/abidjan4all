"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { METHODS, type PaymentMethodId } from "@a4a/payments";
import { auth, signOut } from "@/auth";
import { CompteIntrouvableError, failPayment, fulfillPayment, startCheckout } from "@/lib/billing";
import { offreParId } from "@/lib/offres";

/** Depuis /abonnement : crée le paiement et redirige vers la page du PSP. */
export async function subscribeAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/abonnement");

  const plan = String(formData.get("plan"));
  const method = String(formData.get("method")) as PaymentMethodId;

  // L'offre est revalidée en base, pas contre une liste figée : une offre
  // désactivée entre l'affichage de la page et l'envoi du formulaire ne doit
  // pas pouvoir être souscrite.
  const offre = await offreParId(plan);
  if (!offre || !offre.active || offre.prixCatalogue <= 0 || !METHODS.some((m) => m.id === method)) {
    redirect("/abonnement"); // saisie hors formulaire officiel, ou offre retirée
  }

  // Un refus du PSP (moyen non activé, panne…) ne doit pas finir en 500 :
  // retour à /abonnement avec un message. redirect() lance une exception
  // interne Next — il reste hors du try.
  let checkoutUrl: string | null = null;
  let sessionMorte = false;
  try {
    ({ checkoutUrl } = await startCheckout(
      session.user.id,
      session.user.email ?? "",
      plan,
      method
    ));
  } catch (e) {
    // Compte disparu : ce n'est PAS un problème de paiement. Le dire comme
    // tel, sinon l'abonné essaie chaque moyen l'un après l'autre en vain.
    if (e instanceof CompteIntrouvableError) {
      console.warn(`[billing] session orpheline (compte supprimé) — déconnexion.`);
      sessionMorte = true;
    } else {
      console.error(`[billing] checkout ${method} refusé :`, e);
    }
  }

  if (sessionMorte) {
    // Purge le jeton devenu invalide, sinon l'abonné boucle sur la même erreur.
    await signOut({ redirect: false });
    redirect("/login?next=/abonnement&raison=session_expiree");
  }
  if (!checkoutUrl) redirect(`/abonnement?indisponible=${method}`);
  redirect(checkoutUrl);
}

/** Page mock PSP : simule l'issue du paiement puis revient sur le site. */
export async function settleMockPayment(paymentId: string, outcome: "paid" | "failed") {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) redirect("/abonnement");

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
