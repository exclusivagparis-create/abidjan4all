import Link from "next/link";
import { ThemeToggle } from "@a4a/ui";
import { prisma } from "@a4a/db";

/** Menu par défaut, servi tant qu'aucune entrée n'est définie au Studio. */
const NAV_DEFAUT = [
  { label: "À la une", href: "/" },
  { label: "En Direct", href: "/en-direct" },
  { label: "Vidéos", href: "/videos" },
  { label: "Diaspora", href: "/diaspora" },
  { label: "Business", href: "/business" },
];

/** En-tête du portail — structure de Page Accueil.dc.html. */
export async function SiteHeader() {
  const items = await prisma.menuItem.findMany({
    where: { visible: true },
    orderBy: { order: "asc" },
    select: { label: true, href: true },
  });
  const NAV = items.length > 0 ? items : NAV_DEFAUT;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[var(--topbar)] backdrop-blur-[12px]">
      {/* gap-4 (et non 6) : 7 entrées de menu + recherche + compte + S'abonner
          dépassent sinon la largeur utile sur un portable 1280. */}
      <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-8 py-3.5">
        <Link href="/" className="flex items-center">
          <img src="/logo-mark-light.png" alt="Abidjan4All" className="h-[26px] [display:var(--show-light)]" />
          <img src="/logo-mark-dark.png" alt="" aria-hidden className="h-[26px] [display:var(--show-dark)]" />
        </Link>
        {/* nowrap : sinon les libellés en deux mots (« À la une », « Faits Divers »)
            se cassent sur deux lignes dès que la barre est pleine. min-w-0 +
            overflow-x-auto : le menu se comprime et défile au lieu de faire
            déborder la page sur les écrans intermédiaires (tablette). */}
        <nav className="hidden min-w-0 gap-5 overflow-x-auto text-[13.5px] font-semibold text-ink-2 [scrollbar-width:none] md:flex [&::-webkit-scrollbar]:hidden">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap hover:text-ink first:text-ink">
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
            className="w-20 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-3"
          />
        </form>
        <Link href="/espace-membre" className="hidden whitespace-nowrap text-[12.5px] font-semibold text-ink-2 hover:text-ink sm:inline">
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
