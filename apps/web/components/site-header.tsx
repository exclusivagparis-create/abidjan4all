import Link from "next/link";
import { ThemeToggle } from "@a4a/ui";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";
import { MobileMenu } from "@/components/mobile-menu";

/** Menu par défaut, servi tant qu'aucune entrée n'est définie au Studio. */
const NAV_DEFAUT = [
  { label: "À la une", href: "/" },
  { label: "En Direct", href: "/en-direct" },
  { label: "Vidéos", href: "/videos" },
  { label: "Diaspora", href: "/diaspora" },
  { label: "Business", href: "/business" },
];

/** Rubriques secondaires proposées dans le panneau mobile, sous le menu. */
const SECONDAIRES = [
  { label: "Nos directs", href: "/en-direct" },
  { label: "Podcasts", href: "/podcasts" },
  { label: "Vidéos", href: "/videos" },
  { label: "Groupes", href: "/groupes" },
  { label: "A4A Vérifie", href: "/verifie" },
  { label: "Petites annonces", href: "/annonces" },
  { label: "A4A Formation", href: "/formation" },
  { label: "Contact", href: "/contact" },
];

/** En-tête du portail — structure de Page Accueil.dc.html. */
export async function SiteHeader() {
  const [items, session] = await Promise.all([
    prisma.menuItem.findMany({
      where: { visible: true },
      orderBy: { order: "asc" },
      select: { label: true, href: true },
    }),
    auth(),
  ]);
  const NAV = items.length > 0 ? items : NAV_DEFAUT;
  // « Mon compte » n'a de sens que pour qui en a un : un visiteur se voit
  // proposer « Se connecter ». Les pages qui portent cet en-tête sont donc
  // rendues à chaque requête (l'état de connexion ne peut pas être mis en cache).
  const connecte = Boolean(session?.user);
  // Un lien déjà présent dans le menu principal ne se répète pas plus bas.
  const dejaAuMenu = new Set(NAV.map((n) => n.href));
  const secondaires = SECONDAIRES.filter((s) => !dejaAuMenu.has(s.href));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[var(--topbar)] backdrop-blur-[12px]">
      {/* gap-4 (et non 6) : 7 entrées de menu + recherche + compte + S'abonner
          dépassent sinon la largeur utile sur un portable 1280. */}
      <div className="mx-auto flex max-w-[1200px] items-center gap-2 px-3 py-3.5 sm:gap-3 sm:px-6 md:gap-4 lg:px-8">
        <MobileMenu entries={NAV} secondaires={secondaires} connecte={connecte} />
        {/* Sur téléphone : le monogramme A4A (48 px de large) au lieu du
            mot-symbole complet (109 px). Les 61 px gagnés rendent sa place au
            libellé « Se connecter », qu'une icône devait remplacer faute de
            largeur. Le mot-symbole revient dès `sm`. */}
        <Link href="/" className="flex flex-none items-center" aria-label="Abidjan4All — accueil">
          <img src="/logo-a4a-light.png" alt="" aria-hidden className="h-[21px] [display:var(--show-light)] sm:hidden" />
          <img src="/logo-a4a-dark.png" alt="" aria-hidden className="h-[21px] [display:var(--show-dark)] sm:hidden" />
          <img src="/logo-mark-light.png" alt="" aria-hidden className="hidden h-[26px] sm:[display:var(--show-light)]" />
          <img src="/logo-mark-dark.png" alt="" aria-hidden className="hidden h-[26px] sm:[display:var(--show-dark)]" />
        </Link>
        {/* Barre horizontale à partir de `lg` seulement. En tablette, elle
            n'obtenait que 231 px pour 506 nécessaires : le menu était tronqué
            en une bande défilante. Sous 1024 px, c'est le panneau qui sert. */}
        <nav className="hidden min-w-0 gap-5 overflow-x-auto text-[13.5px] font-semibold text-ink-2 [scrollbar-width:none] lg:flex [&::-webkit-scrollbar]:hidden">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap hover:text-ink first:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
        <span className="flex-1" />
        {/* Recherche et « Mon compte » à partir de `xl` : entre 1024 et 1280,
            la place doit aller aux 7 entrées du menu. Ils restent joignables
            depuis le panneau et le pied de page. */}
        <form
          action="/recherche"
          className="hidden items-center gap-2 rounded-pill border border-line bg-surface-2 px-3.5 py-2 xl:flex"
        >
          <span className="text-[13px] text-ink-3">⌕</span>
          <input
            name="q"
            placeholder="Rechercher…"
            className="w-20 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-3"
          />
        </form>
        {/* Toujours visible, libellé compris : ce lien était réservé au grand
            écran, un visiteur mobile n'avait donc aucun accès à la connexion
            depuis la barre. Le monogramme A4A libère la largeur nécessaire. */}
        <Link
          href={connecte ? "/espace-membre" : "/login"}
          className="flex-none whitespace-nowrap text-[11.5px] font-semibold text-ink-2 hover:text-ink sm:text-[12.5px]"
        >
          {connecte ? "Mon compte" : "Se connecter"}
        </Link>
        {/* La bascule de thème est reprise dans le panneau mobile : dans la
            barre, son libellé « 🌙 Sombre » faisait déborder « S'abonner »
            hors de l'écran sur téléphone. */}
        <span className="hidden flex-none lg:inline-flex">
          <ThemeToggle />
        </span>
        <Link
          href="/abonnement"
          className="flex-none whitespace-nowrap rounded-pill bg-red px-2.5 py-1.5 text-[11.5px] font-bold text-white sm:px-[18px] sm:py-[9px] sm:text-[12.5px]"
        >
          S&apos;abonner
        </Link>
      </div>
    </header>
  );
}
