import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RegisterForm } from "./register-form";
import { BoutonsSociaux } from "@/components/social-login";

export const metadata: Metadata = { title: "Créer un compte" };
export const dynamic = "force-dynamic";

export default async function InscriptionPage() {
  const session = await auth();
  if (session?.user) redirect("/espace-membre");

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[460px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <h1 className="mb-2 font-serif text-[24px] sm:text-[27px] lg:text-[30px] font-medium">Créer un compte</h1>
        <p className="mb-6 font-serif text-[15px] leading-[1.5] text-ink-2">
          Gratuit. Votre compte membre donne accès à votre espace, aux groupes, aux commentaires et au dépôt de petites
          annonces.
        </p>
        <div className="mb-6">
          <BoutonsSociaux action="inscription" />
        </div>
        <RegisterForm />
      </main>
      <SiteFooter />
    </div>
  );
}
