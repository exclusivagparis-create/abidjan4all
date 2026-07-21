import { RESEAUX_ACTIFS } from "@/lib/reseaux";

/** Date du jour en français, première lettre capitalisée. */
function dateDuJour(): string {
  const s = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Bandeau utilitaire (vert, identité CI). Non collant : il défile au scroll,
 * au-dessus de l'en-tête. Date à gauche, réseaux sociaux à droite (seuls les
 * réseaux dont l'URL est renseignée dans lib/reseaux.ts sont affichés).
 */
export function SiteTopbar() {
  return (
    <div className="bg-[#1A6B3C] text-white">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-1.5 text-[11px] sm:px-6 lg:px-8">
        <span className="tracking-[0.02em] text-white/85">
          <span className="hidden sm:inline">{dateDuJour()}</span>
          <span className="sm:hidden">Abidjan4All</span>
        </span>
        {RESEAUX_ACTIFS.length > 0 ? (
          <nav className="flex items-center gap-1.5">
            {RESEAUX_ACTIFS.map((r) => (
              <a
                key={r.name}
                href={r.href}
                target="_blank"
                rel="noreferrer"
                aria-label={r.label}
                title={r.label}
                className="flex h-[22px] w-[22px] items-center justify-center rounded-pill bg-white/12 text-[12px] leading-none transition-colors hover:bg-[#E8500A]"
              >
                {r.glyph}
              </a>
            ))}
          </nav>
        ) : (
          <span className="text-white/70">L&apos;info pour tous les Ivoiriens · partout dans le monde</span>
        )}
      </div>
    </div>
  );
}
