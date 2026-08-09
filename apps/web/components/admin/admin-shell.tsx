"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Tiroir de navigation du Studio sur petit écran.
 *
 * La barre latérale fait 246 px fixes : sur un téléphone de 375 px, elle ne
 * laissait que 129 px au contenu, qui débordait alors horizontalement. Sous
 * `lg`, elle est donc masquée et rappelée par ce tiroir.
 */
export function AdminDrawer({ children }: { children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const chemin = usePathname();

  useEffect(() => setOuvert(false), [chemin]);

  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
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
        onClick={() => setOuvert(true)}
        aria-label="Ouvrir le menu du Studio"
        aria-expanded={ouvert}
        className="flex h-9 w-9 flex-none items-center justify-center rounded-[8px] text-ink-2 hover:text-ink lg:hidden"
      >
        <span aria-hidden className="text-[18px] leading-none">☰</span>
      </button>

      {ouvert ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOuvert(false)}
            className="absolute inset-0 h-full w-full bg-black/50"
          />
          {/* Même barre de défilement discrète que la barre latérale fixe. */}
          <div className="absolute inset-y-0 left-0 flex w-[262px] max-w-[85vw] flex-col overflow-y-auto overscroll-contain bg-navy px-4 py-5 [scrollbar-color:rgba(255,255,255,0.28)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/25 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:bg-transparent">
            <button
              type="button"
              onClick={() => setOuvert(false)}
              aria-label="Fermer le menu"
              className="absolute right-3 top-4 text-[18px] text-[#6C7791] hover:text-white"
            >
              ✕
            </button>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
