import Link from "next/link";

/**
 * Bande « Services A4A » (inspirée de l'Espace du Citoyen) — accès rapide aux
 * services concrets de la plateforme. Identité CI : fond vert, accents orange.
 */
const SERVICES = [
  { icon: "💼", title: "Bourse d'emploi", sub: "Offres & recrutement", href: "/annonces?type=emploi" },
  { icon: "📄", title: "Banque de CV", sub: "Déposer / recruter", href: "/cv" },
  { icon: "🏠", title: "Immobilier", sub: "Annonces", href: "/annonces?type=immobilier" },
  { icon: "💬", title: "WhatsApp Club", sub: "Rejoindre le groupe", href: "/club" },
  { icon: "✅", title: "A4A Vérifie", sub: "Fact-checking", href: "/verifie" },
];

export function ServicesBand() {
  return (
    <section className="border-y border-line bg-[#1A6B3C]/8">
      <div className="mx-auto max-w-[1200px] px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-[20px] font-semibold text-ink sm:text-[22px]">
            Services <span className="text-[#E8500A]">A4A</span>
          </h2>
          <span className="hidden text-[12px] text-ink-3 sm:inline">Emploi, annonces, communauté — en un clic</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {SERVICES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group rounded-[10px] border border-line bg-surface px-4 py-3.5 shadow-[var(--shadow-sm)] transition-colors hover:border-[#1A6B3C]"
            >
              <div className="text-[22px]">{s.icon}</div>
              <div className="mt-1.5 text-[13.5px] font-semibold leading-tight text-ink">{s.title}</div>
              <div className="text-[11px] text-ink-3">{s.sub}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
