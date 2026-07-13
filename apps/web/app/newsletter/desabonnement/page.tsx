import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { verifyUnsubToken } from "@/lib/newsletter";

export const metadata: Metadata = { title: "Désabonnement", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Désabonnement en un clic depuis le lien de la newsletter. Le jeton HMAC
 * garantit que seule la personne ayant reçu l'e-mail peut se désabonner.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ nl?: string; email?: string; t?: string }>;
}) {
  const { nl = "", email = "", t = "" } = await searchParams;
  const valid = nl && email && t && verifyUnsubToken(nl, email, t);
  let done = false;

  if (valid) {
    const deleted = await prisma.newsletterSubscription.deleteMany({ where: { newsletterId: nl, email } });
    if (deleted.count > 0) {
      await prisma.newsletter
        .update({ where: { id: nl }, data: { subscribersCount: { decrement: deleted.count } } })
        .catch(() => {});
    }
    done = true;
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[560px] px-8 pb-24 pt-16 text-center">
        {done ? (
          <>
            <h1 className="mb-3 font-serif text-[30px] font-medium">Désabonnement confirmé</h1>
            <p className="font-serif text-[15px] text-ink-2">
              L&apos;adresse <b>{email}</b> ne recevra plus cette newsletter. Vous pouvez vous réabonner à tout
              moment depuis le site.
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-3 font-serif text-[30px] font-medium">Lien invalide</h1>
            <p className="font-serif text-[15px] text-ink-2">
              Ce lien de désabonnement est invalide ou incomplet.
            </p>
          </>
        )}
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-blue">
          Retour à l&apos;accueil
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
