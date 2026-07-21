import Link from "next/link";
import { prisma } from "@a4a/db";
import { RESEAUX_ACTIFS } from "@/lib/reseaux";

export async function SiteFooter() {
  const [rubriques, pages] = await Promise.all([
    prisma.rubrique.findMany({ orderBy: { order: "asc" } }),
    prisma.page.findMany({ where: { published: true, inFooter: true }, orderBy: { order: "asc" }, select: { slug: true, title: true } }),
  ]);
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-10">
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
          <Link href="/groupes" className="hover:text-ink">Groupes</Link>
          <Link href="/club" className="hover:text-ink">WhatsApp Club</Link>
          <Link href="/verifie" className="hover:text-ink">A4A Vérifie</Link>
          <Link href="/annonces" className="hover:text-ink">Petites annonces</Link>
          <Link href="/cv" className="hover:text-ink">Banque de CV</Link>
          <Link href="/publicite" className="hover:text-ink">Annoncer / Publicité</Link>
          <Link href="/contact" className="hover:text-ink">Contact</Link>
          <Link href="/formation" className="hover:text-ink">A4A Formation</Link>
          <Link href="/recherche" className="hover:text-ink">Recherche</Link>
          <Link href="/abonnement" className="hover:text-ink">S&apos;abonner à A4A+</Link>
        </nav>
        {pages.length > 0 ? (
          <nav className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line-2 pt-4 text-[12px] text-ink-3">
            {pages.map((p) => (
              <Link key={p.slug} href={`/${p.slug}`} className="hover:text-ink">
                {p.title}
              </Link>
            ))}
          </nav>
        ) : null}
        {RESEAUX_ACTIFS.length > 0 ? (
          <div className="mt-6 flex items-center gap-2.5 border-t border-line-2 pt-5">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Suivez-nous</span>
            {RESEAUX_ACTIFS.map((r) => (
              <a
                key={r.name}
                href={r.href}
                target="_blank"
                rel="noreferrer"
                aria-label={r.label}
                title={r.label}
                className="flex h-8 w-8 items-center justify-center rounded-pill border border-line bg-surface-2 text-[13px] text-ink-2 transition-colors hover:border-[#1A6B3C] hover:text-[#1A6B3C]"
              >
                {r.glyph}
              </a>
            ))}
          </div>
        ) : null}
        <div className="mt-6 border-t border-line-2 pt-5 text-xs text-ink-3">
          © 2026 Abidjan4All · Exclusiv&apos;AG — Tous droits réservés
        </div>
      </div>
    </footer>
  );
}
