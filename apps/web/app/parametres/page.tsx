import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProfileSettings } from "@/components/profile-settings";

export const metadata: Metadata = { title: "Paramètres du profil" };
export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/parametres");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });
  if (!user) redirect("/login?next=/parametres");

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[720px] px-8 pb-20 pt-10">
        <nav className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
          <Link href="/espace-membre" className="hover:text-ink">
            Espace membre
          </Link>
          <span className="mx-2">›</span>
          <span>Paramètres</span>
        </nav>
        <h1 className="mb-8 border-b-2 border-ink pb-5 font-serif text-[32px] font-medium">Paramètres du profil</h1>
        <ProfileSettings name={user.name} email={user.email} />
      </main>
      <SiteFooter />
    </div>
  );
}
