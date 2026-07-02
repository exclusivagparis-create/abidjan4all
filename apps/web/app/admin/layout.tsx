import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@a4a/db";
import { auth, STUDIO_ROLES } from "@/auth";
import { AdminNavLink, type NavItem } from "@/components/admin/admin-nav";
import { logout } from "@/lib/actions/auth-actions";
import { initials } from "@/lib/format";

const ROLE_LABEL: Record<string, string> = {
  journalist: "Journaliste",
  editor: "Rédactrice en chef",
  admin: "Administration",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;
  if (!user || !STUDIO_ROLES.includes(user.role as (typeof STUDIO_ROLES)[number])) {
    redirect("/login?next=/admin");
  }

  const [reviewCount, pendingComments] = await Promise.all([
    prisma.article.count({ where: { status: "review" } }),
    prisma.comment.count({ where: { status: "pending" } }),
  ]);

  const contenu: NavItem[] = [
    { label: "Tableau de bord", href: "/admin", icon: "▦" },
    { label: "Articles", href: "/admin/articles", icon: "≣", badge: reviewCount },
    { label: "Médiathèque", icon: "▤" },
    { label: "Rubriques", icon: "◫" },
    { label: "Live-blog", icon: "◉" },
  ];
  const communaute: NavItem[] = [
    { label: "Commentaires", icon: "◎", badge: pendingComments, badgeColor: "var(--orange)" },
    { label: "Abonnés A4A+", icon: "◍" },
    { label: "Utilisateurs", icon: "☺" },
  ];
  const business: NavItem[] = [
    { label: "Régie publicitaire", icon: "◈" },
    { label: "Statistiques", icon: "▲" },
  ];

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      {/* SIDEBAR (Back-office CMS.dc.html) */}
      <aside className="sticky top-0 flex h-screen w-[246px] flex-none flex-col bg-navy px-4 py-5">
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <img src="/logo-dark.png" alt="Abidjan4All" className="h-5" />
          <span className="border-l border-white/20 pl-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#F5C24B]">
            Studio
          </span>
        </div>

        <SidebarSection title="Contenu" items={contenu} />
        <SidebarSection title="Communauté" items={communaute} />
        <SidebarSection title="Business" items={business} />

        <div className="mt-auto flex items-center gap-2.5 border-t border-white/10 px-2 pt-3">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-pill bg-[linear-gradient(135deg,#E8641A,#D6282D)] text-[13px] font-bold text-white">
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
      </aside>

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex items-center gap-4 border-b border-line bg-[var(--topbar)] px-[30px] py-3.5 backdrop-blur-[10px]">
          <Link href="/" className="text-[12.5px] font-semibold text-ink-3 hover:text-ink">
            ‹ Voir le site
          </Link>
          <span className="flex-1" />
          <Link
            href="/admin/articles/new"
            className="inline-flex items-center gap-[7px] rounded-pill bg-red px-[18px] py-2.5 text-[13px] font-bold text-white"
          >
            <span className="text-[15px] leading-none">＋</span>Nouvel article
          </Link>
        </div>
        <div className="px-[30px] pb-12 pt-7">{children}</div>
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
