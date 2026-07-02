"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  label: string;
  href?: string; // absent = fonctionnalité à venir (grisée)
  icon: string;
  badge?: number;
  badgeColor?: string;
};

export function AdminNavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active =
    item.href && (pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href)));

  const base =
    "flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[13px] font-semibold";

  const badge =
    item.badge && item.badge > 0 ? (
      <span
        className="ml-auto rounded-pill px-[7px] py-px text-[11px] font-bold text-white"
        style={{ background: item.badgeColor ?? "var(--red)" }}
      >
        {item.badge}
      </span>
    ) : null;

  if (!item.href) {
    return (
      <span className={`${base} cursor-not-allowed text-[#6C7791]`} title="À venir">
        <span className="w-[18px] text-center">{item.icon}</span>
        {item.label}
        {badge}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={`${base} ${active ? "bg-white/10 text-white" : "text-[#AEB8CC] hover:bg-white/5 hover:text-white"}`}
    >
      <span className="w-[18px] text-center">{item.icon}</span>
      {item.label}
      {badge}
    </Link>
  );
}
