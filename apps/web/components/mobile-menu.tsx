"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@a4a/ui";

export type MenuEntry = { label: string; href: string };

/**
 * Navigation des petits écrans. L'en-tête masque la barre horizontale sous
 * 768 px : sans ce panneau, un visiteur sur téléphone n'avait accès à AUCUNE
 * rubrique, ni à la recherche, ni à son compte — seulement au logo et au
 * bouton « S'abonner ».
 */
export function MobileMenu({ entries, secondaires }: { entries: MenuEntry[]; secondaires: MenuEntry[] }) {
  const [ouvert, setOuvert] = useState(false);
  const chemin = usePathname();

  // Referme au changement de page : sinon le panneau reste ouvert par-dessus
  // l'article que l'on vient d'ouvrir.
  useEffect(() => setOuvert(false), [chemin]);

  // Échap pour fermer, et on bloque le défilement du fond pendant l'ouverture.
  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("keydown", onKey);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = avant;
    };
  }, [ouvert]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-controls="menu-mobile"
        aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
        className="flex h-10 w-10 flex-none items-center justify-center rounded-[8px] text-ink-2 hover:text-ink md:hidden"
      >
        <span aria-hidden className="text-[19px] leading-none">{ouvert ? "✕" : "☰"}</span>
      </button>

      {ouvert ? (
        <div
          id="menu-mobile"
          className="fixed inset-x-0 bottom-0 top-[57px] z-50 overflow-y-auto overscroll-contain border-t border-line bg-bg px-5 pb-10 pt-4 md:hidden"
        >
          <form action="/recherche" className="mb-4 flex items-center gap-2 rounded-pill border border-line bg-surface-2 px-4 py-2.5">
            <span aria-hidden className="text-[15px] text-ink-3">⌕</span>
            <input
              name="q"
              placeholder="Rechercher un article…"
              aria-label="Rechercher"
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
            />
          </form>

          <nav className="flex flex-col">
            {entries.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                className="border-b border-line-2 py-3 font-serif text-[19px] font-semibold hover:text-orange"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">Le média</div>
          <nav className="mt-1.5 grid grid-cols-2 gap-x-4">
            {secondaires.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                className="border-b border-line-2 py-2.5 text-[14px] font-semibold text-ink-2 hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/espace-membre"
            className="mt-6 block rounded-pill border border-line bg-surface-2 py-3 text-center text-[14px] font-bold text-ink"
          >
            Mon compte
          </Link>
          <Link
            href="/abonnement"
            className="mt-2.5 block rounded-pill bg-red py-3 text-center text-[14px] font-bold text-white"
          >
            S&apos;abonner à A4A+
          </Link>

          {/* Reprise ici : la barre du haut est trop étroite sur téléphone. */}
          <div className="mt-5 flex justify-center">
            <ThemeToggle />
          </div>
        </div>
      ) : null}
    </>
  );
}
