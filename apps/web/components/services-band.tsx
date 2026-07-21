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
    <section className="bg-[#1A6B3C] text-white">
      <div className="mx-auto max-w-[1200px] px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-[20px] font-semibold sm:text-[22px]">
            Services <span className="text-[#F0A93B]">A4A</span>
          </h2>
          <span className="hidden text-[12px] text-white/70 sm:inline">Emploi, annonces, communauté — en un clic</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {SERVICES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group rounded-[10px] bg-white/10 px-4 py-3.5 transition-colors hover:bg-[#E8500A]"
            >
              <div className="text-[22px]">{s.icon}</div>
              <div className="mt-1.5 text-[13.5px] font-semibold leading-tight">{s.title}</div>
              <div className="text-[11px] text-white/65 group-hover:text-white/85">{s.sub}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
