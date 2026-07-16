import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-ink">
      <Link href="/" className="mb-8">
        <img src="/logo-light.png" alt="Abidjan4All" className="h-10 [display:var(--show-light)]" />
        <img src="/logo-dark.png" alt="" aria-hidden className="h-10 [display:var(--show-dark)]" />
      </Link>

      <div className="w-full max-w-[400px] rounded-lg border border-line bg-surface p-8 shadow-[var(--shadow-md)]">
        <h1 className="mb-1 font-serif text-[28px] font-medium">Connexion</h1>
        <p className="mb-6 text-[13px] text-ink-3">
          Espace membre et studio éditorial Abidjan4All.
        </p>
        <LoginForm next={next} />
      </div>
      {/* Les identifiants de démonstration du seed ne sont plus affichés ici :
          en production, cette page publique invitait à essayer un compte de
          la rédaction avec son mot de passe. */}
    </div>
  );
}
