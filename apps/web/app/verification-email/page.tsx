import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { verifyEmailToken } from "@/lib/actions/register-actions";

export const metadata: Metadata = { title: "Confirmation de votre adresse", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function VerificationEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const result = await verifyEmailToken(token);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[460px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        {result.ok ? (
          <>
            <h1 className="mb-2 font-serif text-[24px] sm:text-[27px] lg:text-[30px] font-medium">Compte activé</h1>
            <p className="mb-6 font-serif text-[15px] leading-[1.5] text-ink-2">
              Bienvenue {result.name} — votre adresse est confirmée. Vous pouvez maintenant vous connecter.
            </p>
            <Link href="/login" className="inline-block rounded-pill bg-red px-6 py-3 text-sm font-bold text-white">
              Se connecter
            </Link>
          </>
        ) : (
          <>
            <h1 className="mb-2 font-serif text-[24px] sm:text-[27px] lg:text-[30px] font-medium">Lien invalide</h1>
            <div className="rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
              <p className="mb-4 font-serif text-[15px] leading-[1.5] text-ink-2">{result.error}</p>
              <Link href="/inscription" className="text-sm font-semibold text-blue hover:underline">
                Recommencer l&apos;inscription ›
              </Link>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
