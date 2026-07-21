import Link from "next/link";

/** Icône par rubrique (repli 📰). Le nom de slug prime, sinon un mot-clé. */
const ICONES: Record<string, string> = {
  politique: "⚖️",
  economie: "💰",
  "cacao-marches": "🌱",
  culture: "🎭",
  sport: "⚽",
  societe: "👥",
  sante: "🏥",
  tech: "💻",
  "tech-numerique": "💻",
  diaspora: "🌍",
  business: "📈",
  femmes: "♀️",
  environnement: "🌿",
  tourisme: "🧳",
  religion: "🕊️",
  "africa-in-english": "🗺️",
  videos: "🎬",
  actualite: "📰",
  "en-direct": "🔴",
};

function iconePour(slug: string): string {
  return ICONES[slug] ?? "📰";
}

export type RubriqueCarte = { slug: string; name: string; color: string; _count: { articles: number } };

/**
 * « Explorer par rubrique » — cartes à fond teinté (couleur de la rubrique),
 * icône et compteur d'articles, façon portail. Remplace la bande de pastilles.
 */
export function RubriqueExplorer({ rubriques }: { rubriques: RubriqueCarte[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {rubriques.map((r) => (
        <Link
          key={r.slug}
          href={`/${r.slug}`}
          className="rounded-[10px] px-4 py-4 text-center transition-transform hover:-translate-y-0.5"
          style={{ background: `${r.color}14`, color: r.color }}
        >
          <div className="text-[24px] leading-none">{iconePour(r.slug)}</div>
          <div className="mt-1.5 text-[12.5px] font-bold text-ink">{r.name}</div>
          <div className="text-[10.5px] font-semibold text-ink-3">
            {r._count.articles} article{r._count.articles > 1 ? "s" : ""}
          </div>
        </Link>
      ))}
    </div>
  );
}
