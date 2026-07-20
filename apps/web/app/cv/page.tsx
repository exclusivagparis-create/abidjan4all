import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { initials } from "@/lib/format";

export const metadata: Metadata = {
  title: "Banque de CV — recruter en Côte d'Ivoire",
  description: "Consultez les CV en ligne des membres d'Abidjan4All : profils disponibles en Côte d'Ivoire et dans la diaspora.",
  alternates: { canonical: "/cv" },
};
export const dynamic = "force-dynamic";

export default async function BanqueCvPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q }, session] = await Promise.all([searchParams, auth()]);
  const terme = (q ?? "").trim();

  const cvs = await prisma.cvProfile.findMany({
    where: {
      isPublic: true,
      ...(terme
        ? {
            OR: [
              { headline: { contains: terme, mode: "insensitive" } },
              { location: { contains: terme, mode: "insensitive" } },
              { skills: { has: terme } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 60,
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <div className="mb-3 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="h-[5px] w-[34px] rounded-[3px] bg-green" />
          <h1 className="font-serif text-[27px] font-medium leading-none sm:text-[33px] lg:text-[40px]">Banque de CV</h1>
        </div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-[54ch] font-serif text-[15px] text-ink-2">
            Les profils des membres d&apos;Abidjan4All, disponibles pour un emploi ou une mission.
          </p>
          <Link href="/espace-membre/cv" className="rounded-pill bg-red px-4 py-2 text-[12.5px] font-bold text-white">
            {session?.user ? "Gérer mon CV" : "Déposer mon CV"}
          </Link>
        </div>

        <form className="mb-6">
          <input
            name="q"
            defaultValue={terme}
            placeholder="Rechercher un métier, une compétence, une ville…"
            className="w-full rounded-[10px] border border-line bg-surface px-4 py-2.5 text-[14px] outline-none focus:border-ink-3"
          />
        </form>

        {cvs.length === 0 ? (
          <p className="py-16 text-center font-serif text-lg text-ink-3">
            {terme ? "Aucun CV ne correspond à cette recherche." : "Aucun CV publié pour l'instant — soyez le premier."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cvs.map((cv) => (
              <Link
                key={cv.id}
                href={`/cv/${cv.user.id}`}
                className="flex items-center gap-3.5 rounded-[12px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)] hover:border-ink-3"
              >
                {cv.user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cv.user.avatarUrl} alt="" className="h-12 w-12 flex-none rounded-pill object-cover" />
                ) : (
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded-pill bg-[#006633] text-[15px] font-bold text-white">
                    {initials(cv.user.name)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block font-serif text-[16px] font-semibold leading-tight">{cv.user.name}</span>
                  <span className="block truncate text-[13.5px] text-ink-2">{cv.headline}</span>
                  {cv.location ? <span className="block text-[11.5px] text-ink-3">{cv.location}</span> : null}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
