import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProfileSettings } from "@/components/profile-settings";
import { ComptesLies, MESSAGES_LIEN } from "@/components/comptes-lies";

export const metadata: Metadata = { title: "Paramètres du profil" };
export const dynamic = "force-dynamic";

export default async function ParametresPage({
  searchParams,
}: {
  searchParams: Promise<{ lien?: string }>;
}) {
  const [{ lien }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user) redirect("/login?next=/parametres");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      passwordHash: true,
      accounts: { select: { provider: true, createdAt: true } },
    },
  });
  if (!user) redirect("/login?next=/parametres");

  const message = lien ? MESSAGES_LIEN[lien] : undefined;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[720px] px-4 sm:px-6 lg:px-8 pb-20 pt-10">
        <nav className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
          <Link href="/espace-membre" className="hover:text-ink">
            Espace membre
          </Link>
          <span className="mx-2">›</span>
          <span>Paramètres</span>
        </nav>
        <h1 className="mb-8 border-b-2 border-ink pb-5 font-serif text-[24px] sm:text-[28px] lg:text-[32px] font-medium">Paramètres du profil</h1>
        {message ? (
          <p
            className={`mb-6 rounded-[8px] px-4 py-3 text-[13px] font-semibold leading-[1.5] ${
              message.ton === "ok"
                ? "bg-[rgba(46,139,87,0.1)] text-green"
                : "bg-[rgba(232,100,26,0.1)] text-orange"
            }`}
          >
            {message.texte}
          </p>
        ) : null}

        <div className="grid gap-6">
          <ProfileSettings name={user.name} email={user.email} />
          <ComptesLies liens={user.accounts} aUnMotDePasse={!!user.passwordHash} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
