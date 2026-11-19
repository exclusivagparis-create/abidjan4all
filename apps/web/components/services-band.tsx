import Link from "next/link";

/**
 * Bande « Services A4A » (inspirée de l'Espace du Citoyen) — accès rapide aux
 * services concrets de la plateforme. Identité CI : fond vert, accents orange.
 */
/**
 * Les libellés sont des verbes, et c'est le point.
 *
 * La bande annonçait des rayons — « Bourse d'emploi », « Immobilier » — là où
 * le lecteur ne sait pas qu'il a le droit d'y déposer quelque chose. Un nom de
 * service se contemple ; un ordre se suit. Le sous-titre dit pour qui c'est,
 * quand les deux côtés d'un même service peuvent se confondre : déposer son CV
 * et consulter la CVthèque sont deux gestes opposés, faits par deux personnes
 * différentes, et ils avaient jusqu'ici une seule carte pour deux.
 */
/**
 * Deux rangées, et la séparation n'est pas décorative.
 *
 * La première ne contient que du gratuit, ouvert à tous et sans compte :
 * c'est le plus grand nombre, et c'est ce qui amène du monde. La seconde
 * s'adresse à qui vient déposer ou acheter.
 *
 * « Consultez les offres d'emploi » a sa propre carte, distincte des
 * annonces : un demandeur d'emploi ne cherche pas « une annonce », il cherche
 * du travail, et le mot générique ne l'arrêtait pas.
 *
 * Les liens de dépôt visent l'ancre du formulaire, en bas de /annonces.
 */
const SERVICES = [
  { icon: "🔍", title: "Consultez les offres d'emploi", sub: "Gratuit, sans compte", href: "/annonces?type=emploi" },
  { icon: "📰", title: "Consultez les annonces", sub: "Immobilier, services — gratuit", href: "/annonces" },
  { icon: "📄", title: "Déposez votre CV", sub: "Candidats — gratuit", href: "/espace-membre/cv" },
  { icon: "✅", title: "Vérifiez une info", sub: "A4A Vérifie", href: "/verifie" },
  { icon: "💼", title: "Emploi : déposez une offre", sub: "Employeurs", href: "/annonces?type=emploi#deposer" },
  { icon: "🏠", title: "Déposer une annonce", sub: "Immobilier & petites annonces", href: "/annonces#deposer" },
  { icon: "🔎", title: "Accédez à la CVthèque", sub: "Recruteurs", href: "/recruteur" },
  { icon: "💬", title: "Rejoignez le Club", sub: "Groupe WhatsApp privé", href: "/club" },
];

export function ServicesBand() {
  return (
    <section className="border-y border-line bg-[#1A6B3C]/8">
      <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-[18px] font-semibold text-ink sm:text-[20px]">
            Services <span className="text-[#E8500A]">A4A</span>
          </h2>
          <span className="hidden text-[12px] text-ink-3 sm:inline">Emploi, CVthèque, annonces — en un clic</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-center gap-2.5 rounded-[9px] border border-line bg-surface px-3 py-2.5 shadow-[var(--shadow-sm)] transition-colors hover:border-[#1A6B3C]"
            >
              <span className="flex-none text-[16px] leading-none">{s.icon}</span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold leading-[1.25] text-ink">{s.title}</span>
                <span className="block text-[10.5px] leading-tight text-ink-3">{s.sub}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
