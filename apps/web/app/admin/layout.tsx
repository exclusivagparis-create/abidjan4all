import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES, STUDIO_ROLES } from "@/auth";
import { AdminNavLink, type NavItem } from "@/components/admin/admin-nav";
import { AdminDrawer } from "@/components/admin/admin-shell";
import { logout } from "@/lib/actions/auth-actions";
import { initials } from "@/lib/format";

const ROLE_LABEL: Record<string, string> = {
  journalist: "Journaliste",
  editor: "Rédactrice en chef",
  admin: "Administration",
  ad_manager: "Gestionnaire Régie",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;
  if (!user || !STUDIO_ROLES.includes(user.role as (typeof STUDIO_ROLES)[number])) {
    redirect("/login?next=/admin");
  }

  const [reviewCount, pendingComments, pendingListings, pendingReservations, brandLeads] = await Promise.all([
    prisma.article.count({ where: { status: "review" } }),
    prisma.comment.count({ where: { status: "pending" } }),
    prisma.listing.count({ where: { status: "pending" } }),
    prisma.adCampaign.count({ where: { status: "pending_review" } }),
    prisma.brandLead.count({ where: { status: "nouveau" } }),
  ]);

  const canPublish = PUBLISH_ROLES.includes(user.role as (typeof PUBLISH_ROLES)[number]);
  // Gestionnaire Régie : seule la régie est accessible (le middleware renvoie
  // toute autre page du Studio vers /admin/ads) — le menu doit le refléter.
  const isRegieOnly = user.role === "ad_manager";
  const editorial = !isRegieOnly;
  const contenu: NavItem[] = [
    { label: "Tableau de bord", href: editorial ? "/admin" : undefined, icon: "▦" },
    { label: "Articles", href: editorial ? "/admin/articles" : undefined, icon: "≣", badge: reviewCount },
    { label: "Médiathèque", href: editorial ? "/admin/media" : undefined, icon: "▤" },
    { label: "Rubriques", href: canPublish ? "/admin/rubriques" : undefined, icon: "◫" },
    { label: "Nos directs", href: editorial ? "/admin/live" : undefined, icon: "◉" },
    { label: "Vidéos", href: canPublish ? "/admin/videos" : undefined, icon: "▶" },
    { label: "Podcasts", href: canPublish ? "/admin/podcasts" : undefined, icon: "▶" },
    { label: "A4A Formation", href: canPublish ? "/admin/formation" : undefined, icon: "🎓" },
    { label: "A4A Vérifie", href: canPublish ? "/admin/factchecks" : undefined, icon: "✓" },
    { label: "Pages", href: canPublish ? "/admin/pages" : undefined, icon: "▧" },
    { label: "Menu", href: canPublish ? "/admin/menu" : undefined, icon: "☰" },
    { label: "Alertes push", href: canPublish ? "/admin/alertes" : undefined, icon: "🔔" },
  ];
  // Facturation et audience : liens actifs pour l'administration seulement.
  const isAdmin = user.role === "admin";
  const isRegie = isAdmin || isRegieOnly;
  const communaute: NavItem[] = [
    { label: "Commentaires", href: editorial ? "/admin/comments" : undefined, icon: "◎", badge: pendingComments, badgeColor: "var(--orange)" },
    { label: "Messages", href: canPublish ? "/admin/contact" : undefined, icon: "✍" },
    { label: "Newsletters", href: canPublish ? "/admin/newsletters" : undefined, icon: "✉" },
    { label: "Groupes", href: isAdmin ? "/admin/community" : undefined, icon: "◉" },
    { label: "Abonnés A4A+", href: isAdmin ? "/admin/subscribers" : undefined, icon: "◍" },
    { label: "Utilisateurs", href: isAdmin ? "/admin/users" : undefined, icon: "☺" },
  ];
  const business: NavItem[] = [
    { label: "Événements", href: canPublish ? "/admin/evenements" : undefined, icon: "◷" },
    { label: "A4A Intelligence", href: canPublish ? "/admin/intelligence" : undefined, icon: "◲" },
    { label: "Petites annonces", href: canPublish ? "/admin/annonces" : undefined, icon: "▤", badge: pendingListings, badgeColor: "var(--orange)" },
    { label: "Régie publicitaire", href: isRegie ? "/admin/ads" : undefined, icon: "◈", badge: pendingReservations, badgeColor: "var(--orange)" },
    { label: "Grille des prix", href: isRegie ? "/admin/ads/tarifs" : undefined, icon: "⛁" },
    { label: "Brand Content", href: isRegie || canPublish ? "/admin/brand-content" : undefined, icon: "◆", badge: brandLeads, badgeColor: "var(--orange)" },
    { label: "Affiliation", href: isRegie || canPublish ? "/admin/affiliation" : undefined, icon: "⇗" },
    { label: "Statistiques", href: isAdmin ? "/admin/stats" : undefined, icon: "▲" },
    { label: "KPI Business Model", href: isAdmin ? "/admin/kpi" : undefined, icon: "◎" },
    { label: "Redirections", href: canPublish ? "/admin/redirections" : undefined, icon: "↪" },
  ];
  // Mode d'emploi : accessible à tous les rôles du Studio, Gestionnaire Régie compris.
  const support: NavItem[] = [{ label: "Aide & mode d'emploi", href: "/admin/aide", icon: "❓" }];

  // Contenu de la barre latérale, partagé entre l'affichage fixe (grand
  // écran) et le tiroir (téléphone/tablette).
  const sidebar = (
    <>
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <img src="/logo-dark.png" alt="Abidjan4All" className="h-5" />
        <span className="border-l border-white/20 pl-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#F5C24B]">
          Studio
        </span>
      </div>

      <SidebarSection title="Contenu" items={contenu} />
      <SidebarSection title="Communauté" items={communaute} />
      <SidebarSection title="Business" items={business} />
      <SidebarSection title="Support" items={support} />

      <div className="mt-auto flex items-center gap-2.5 border-t border-white/10 px-2 pt-3">
        <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-pill bg-[linear-gradient(135deg,#E8641A,#D6282D)] text-[13px] font-bold text-white">
          {initials(user.name ?? "?")}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-white">{user.name}</div>
          <div className="text-[11px] text-[#6C7791]">{ROLE_LABEL[user.role] ?? user.role}</div>
        </div>
        <form action={logout} className="ml-auto">
          <button type="submit" title="Se déconnecter" className="text-[#6C7791] hover:text-white">
            ⏻
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      {/* SIDEBAR (Back-office CMS.dc.html) — fixe à partir de lg seulement :
          246 px sur un téléphone ne laissaient que 129 px au contenu.

          `overflow-y-auto` est indispensable : le menu dépasse désormais la
          hauteur d'écran, et sans défilement les dernières entrées sortaient
          du bloc navy — elles s'affichaient sur le fond blanc de la page, sans
          moyen de les atteindre. Barre de défilement discrète, accordée au
          fond sombre (une barre système claire jurerait sur le navy). */}
      <aside className="sticky top-0 hidden h-screen w-[246px] flex-none flex-col overflow-y-auto overscroll-contain bg-navy px-4 py-5 [scrollbar-color:rgba(255,255,255,0.28)_transparent] [scrollbar-width:thin] lg:flex [&::-webkit-scrollbar-thumb]:rounded-pill [&::-webkit-scrollbar-thumb]:bg-white/25 [&::-webkit-scrollbar-thumb:hover]:bg-white/40 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:bg-transparent">
        {sidebar}
      </aside>

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-[var(--topbar)] px-4 py-3 backdrop-blur-[10px] sm:px-6 lg:gap-4 lg:px-[30px] lg:py-3.5">
          <AdminDrawer>{sidebar}</AdminDrawer>
          <Link href="/" className="whitespace-nowrap text-[12.5px] font-semibold text-ink-3 hover:text-ink">
            ‹ Voir le site
          </Link>
          <span className="flex-1" />
          {/* création d'article : depuis le tableau de bord Articles */}
          <Link href="/admin/articles" className="whitespace-nowrap text-[12.5px] font-semibold text-ink-3 hover:text-ink">
            Articles
          </Link>
        </div>
        <div className="min-w-0 px-4 pb-12 pt-5 sm:px-6 lg:px-[30px] lg:pt-7">{children}</div>
      </div>
    </div>
  );
}

function SidebarSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <>
      <div className="px-2.5 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6C7791]">
        {title}
      </div>
      {items.map((item) => (
        <AdminNavLink key={item.label} item={item} />
      ))}
    </>
  );
}
