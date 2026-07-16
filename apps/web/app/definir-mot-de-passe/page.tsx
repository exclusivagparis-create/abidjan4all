import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Définir mon mot de passe", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const record = token
    ? await prisma.passwordSetToken.findUnique({ where: { token }, include: { user: { select: { name: true, email: true } } } })
    : null;
  const valid = record && !record.usedAt && record.expiresAt > new Date();

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[460px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <h1 className="mb-2 font-serif text-[24px] sm:text-[27px] lg:text-[30px] font-medium">Activez votre compte</h1>
        {valid ? (
          <>
            <p className="mb-6 font-serif text-[15px] text-ink-2">
              Bienvenue {record!.user.name} — choisissez un mot de passe pour <b>{record!.user.email}</b>.
            </p>
            <SetPasswordForm token={token} />
          </>
        ) : (
          <div className="rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
            <p className="mb-4 font-serif text-[15px] text-ink-2">
              Ce lien d&apos;activation est invalide ou a expiré. Contactez l&apos;administration d&apos;Abidjan4All
              pour recevoir un nouveau lien.
            </p>
            <Link href="/" className="text-sm font-semibold text-blue">
              Retour à l&apos;accueil
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
