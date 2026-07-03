import Link from "next/link";
import { ThemeToggle } from "@a4a/ui";

const NAV = [
  { label: "À la une", href: "/" },
  { label: "En Direct", href: "/en-direct" },
  { label: "Vidéos", href: "/videos" },
  { label: "Diaspora", href: "/diaspora" },
  { label: "Business", href: "/business" },
];

/** En-tête du portail — structure de Page Accueil.dc.html. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[var(--topbar)] backdrop-blur-[12px]">
      <div className="mx-auto flex max-w-[1200px] items-center gap-6 px-8 py-3.5">
        <Link href="/" className="flex items-center">
          <img src="/logo-mark-light.png" alt="Abidjan4All" className="h-[26px] [display:var(--show-light)]" />
          <img src="/logo-mark-dark.png" alt="" aria-hidden className="h-[26px] [display:var(--show-dark)]" />
        </Link>
        <nav className="hidden gap-5 text-[13.5px] font-semibold text-ink-2 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-ink first:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
        <span className="flex-1" />
        <form
          action="/recherche"
          className="hidden items-center gap-2 rounded-pill border border-line bg-surface-2 px-3.5 py-2 lg:flex"
        >
          <span className="text-[13px] text-ink-3">⌕</span>
          <input
            name="q"
            placeholder="Rechercher…"
            className="w-28 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-3"
          />
        </form>
        <Link href="/espace-membre" className="hidden text-[12.5px] font-semibold text-ink-2 hover:text-ink sm:inline">
          Mon compte
        </Link>
        <ThemeToggle />
        <Link
          href="/abonnement"
          className="rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-bold text-white"
        >
          S&apos;abonner
        </Link>
      </div>
    </header>
  );
}
