import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function MotDePasseOubliePage() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[460px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <h1 className="mb-2 font-serif text-[24px] sm:text-[27px] lg:text-[30px] font-medium">Mot de passe oublié</h1>
        <p className="mb-6 font-serif text-[15px] leading-[1.5] text-ink-2">
          Indiquez l&apos;adresse de votre compte : nous vous envoyons un lien pour en choisir un nouveau.
        </p>
        <ResetForm />
        <p className="mt-5 text-center text-[12.5px] text-ink-3">
          <Link href="/login" className="font-semibold text-blue hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
