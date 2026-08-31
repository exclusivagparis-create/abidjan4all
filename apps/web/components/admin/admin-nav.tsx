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

  // `items-start` et non `items-center` : dès qu'un libellé passe sur deux
  // lignes, un alignement centré décale l'icône vers le milieu du bloc de
  // texte, ce qui casse la colonne d'icônes. Le léger `pt` la remet en face de
  // la première ligne.
  const base =
    "flex w-full items-start gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[13px] font-semibold";

  const badge =
    item.badge && item.badge > 0 ? (
      // `shrink-0` : la pastille est un nombre, elle ne se comprime pas. Sans
      // cela un libellé long l'écrasait jusqu'à la rendre illisible.
      <span
        className="mt-px shrink-0 rounded-pill px-[7px] py-px text-[11px] font-bold text-white"
        style={{ background: item.badgeColor ?? "var(--red)" }}
      >
        {item.badge}
      </span>
    ) : null;

  /**
   * Le libellé occupe l'espace restant et revient à la ligne s'il le faut.
   *
   * Il était posé en texte nu dans une rangée flex : sans conteneur à lui, il
   * ne pouvait ni se réduire ni passer à la ligne, et un intitulé un peu long
   * — « Journal des suppressions » — débordait de la barre ou repoussait la
   * pastille hors du cadre. `min-w-0` est la pièce indispensable : un élément
   * flex refuse de descendre sous la largeur de son contenu tant qu'on ne l'y
   * autorise pas.
   *
   * On préfère le retour à la ligne à la troncature : dans un menu, un
   * intitulé coupé oblige à survoler pour savoir où l'on va.
   */
  const contenu = (
    <>
      <span className="w-[18px] shrink-0 text-center leading-[1.45]">{item.icon}</span>
      <span className="min-w-0 flex-1 leading-[1.45] [overflow-wrap:anywhere]">{item.label}</span>
      {badge}
    </>
  );

  if (!item.href) {
    return (
      <span className={`${base} cursor-not-allowed text-[#6C7791]`} title="À venir">
        {contenu}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={`${base} ${active ? "bg-white/10 text-white" : "text-[#AEB8CC] hover:bg-white/5 hover:text-white"}`}
    >
      {contenu}
    </Link>
  );
}
