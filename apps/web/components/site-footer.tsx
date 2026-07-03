import Link from "next/link";
import { prisma } from "@a4a/db";

export async function SiteFooter() {
  const rubriques = await prisma.rubrique.findMany({ orderBy: { order: "asc" } });
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto max-w-[1200px] px-8 py-10">
        <div className="flex flex-wrap items-center gap-4">
          <img src="/logo-light.png" alt="Abidjan4All" className="h-8 [display:var(--show-light)]" />
          <img src="/logo-dark.png" alt="" aria-hidden className="h-8 [display:var(--show-dark)]" />
          <span className="text-[13px] text-ink-3">
            Média numérique de la Côte d&apos;Ivoire et de la diaspora
          </span>
        </div>
        <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] font-semibold text-ink-2">
          {rubriques.map((r) => (
            <Link key={r.slug} href={`/${r.slug}`} className="hover:text-ink">
              {r.name}
            </Link>
          ))}
        </nav>
        <nav className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line-2 pt-4 text-[12.5px] font-semibold text-ink-2">
          <Link href="/en-direct" className="hover:text-ink">Nos directs</Link>
          <Link href="/podcasts" className="hover:text-ink">Podcasts</Link>
          <Link href="/formation" className="hover:text-ink">A4A Formation</Link>
          <Link href="/recherche" className="hover:text-ink">Recherche</Link>
          <Link href="/abonnement" className="hover:text-ink">S&apos;abonner à A4A+</Link>
        </nav>
        <div className="mt-6 border-t border-line-2 pt-5 text-xs text-ink-3">
          © 2026 Abidjan4All · Exclusiv&apos;AG — Tous droits réservés
        </div>
      </div>
    </footer>
  );
}
