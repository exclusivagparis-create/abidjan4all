import Link from "next/link";

/**
 * Bande Diaspora : filtres par pays. Chaque chip mène à la rubrique Diaspora
 * filtrée sur le tag pays (voir app/[rubrique]/page.tsx, paramètre `pays`).
 * Éditorialement, taguer un article Diaspora avec le nom du pays le fait
 * remonter sous le chip correspondant.
 */
const PAYS = [
  { label: "France", flag: "🇫🇷" },
  { label: "USA", flag: "🇺🇸" },
  { label: "Canada", flag: "🇨🇦" },
  { label: "Italie", flag: "🇮🇹" },
  { label: "Allemagne", flag: "🇩🇪" },
  { label: "Belgique", flag: "🇧🇪" },
  { label: "Royaume-Uni", flag: "🇬🇧" },
];

export function DiasporaStrip({ active, bare = false }: { active?: string; bare?: boolean }) {
  const chip = (label: string, flag: string, href: string, on: boolean) => (
    <Link
      key={label}
      href={href}
      className={`rounded-pill border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
        on
          ? "border-[#1A6B3C] bg-[#1A6B3C] text-white"
          : "border-line text-ink-2 hover:border-[#1A6B3C] hover:bg-[#1A6B3C] hover:text-white"
      }`}
    >
      {flag} {label}
    </Link>
  );

  const inner = (
    <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-line bg-surface px-5 py-3.5 shadow-[var(--shadow-sm)]">
      <Link href="/diaspora" className="whitespace-nowrap border-r border-line pr-4 font-serif text-[16px] font-semibold text-[#1A6B3C] hover:underline">
        🌍 Diaspora CI
      </Link>
      <div className="flex flex-wrap gap-2">
        {active ? chip("Toutes", "🌐", "/diaspora", false) : null}
        {PAYS.map((p) => chip(p.label, p.flag, `/diaspora?pays=${encodeURIComponent(p.label)}`, active === p.label))}
      </div>
    </div>
  );

  // `bare` : déjà dans un conteneur (page rubrique) → pas de section/marge.
  if (bare) return inner;
  return <section className="mx-auto max-w-[1200px] px-4 pt-12 sm:px-6 lg:px-8">{inner}</section>;
}
