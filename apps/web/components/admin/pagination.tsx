import Link from "next/link";

/**
 * Barre de pagination du Studio.
 *
 * Écrite pour être réemployée : la médiathèque est la première page du
 * back-office à en avoir besoin, les listes d'articles et d'utilisateurs
 * suivront le jour où elles déborderont.
 *
 * Choix de fond : une pagination par numéros plutôt qu'un défilement infini.
 * Dans un outil de rédaction on cherche une image précise, on revient dessus,
 * on envoie l'adresse à un collègue — autant de choses qu'un défilement infini
 * rend impossibles, puisqu'il n'a ni fin ni adresse. Chaque page est ici une
 * URL à part entière.
 */

/** Numéros à afficher : début, fin, et les voisins de la page courante. */
function fenetre(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);

  const vus = new Set([1, pages, page, page - 1, page + 1]);
  // Aux extrémités, on élargit du côté opposé pour garder une barre de largeur
  // constante — sinon elle se rétrécit sur la première et la dernière page.
  if (page <= 3) [2, 3, 4].forEach((n) => vus.add(n));
  if (page >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((n) => vus.add(n));

  const nums = [...vus].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const sortie: (number | "…")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1]! > 1) sortie.push("…");
    sortie.push(n);
  });
  return sortie;
}

function Chevron({ sens }: { sens: "gauche" | "droite" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={sens === "gauche" ? "" : "rotate-180"}
    >
      <path d="M10 3 5 8l5 5" />
    </svg>
  );
}

const boite =
  "inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-[8px] border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue";

export function Pagination({
  page,
  pages,
  total,
  debut,
  fin,
  base,
  libelle = "éléments",
}: {
  page: number;
  pages: number;
  /** Nombre total d'éléments, toutes pages confondues. */
  total: number;
  /** Rang du premier élément affiché (1 pour la première page). */
  debut: number;
  /** Rang du dernier élément affiché. */
  fin: number;
  /** Chemin de la page, sans paramètre — ex. « /admin/media ». */
  base: string;
  libelle?: string;
}) {
  if (pages <= 1) {
    // Une seule page : pas de navigation, mais le total reste utile — il dit au
    // rédacteur qu'il voit bien tout, ce qu'une absence de barre laisserait
    // deviner.
    return total > 0 ? (
      <p className="mt-6 text-center text-[12.5px] text-ink-3">
        {total} {libelle}
      </p>
    ) : null;
  }

  const lien = (n: number) => (n === 1 ? base : `${base}?page=${n}`);

  return (
    <nav className="mt-8 flex flex-col items-center gap-3" aria-label="Pagination">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {page > 1 ? (
          <Link href={lien(page - 1)} rel="prev" className={`${boite} border-line bg-surface text-ink hover:bg-surface-2`}>
            <Chevron sens="gauche" />
            Précédent
          </Link>
        ) : (
          <span aria-disabled className={`${boite} cursor-default border-line bg-surface-2 text-ink-3`}>
            <Chevron sens="gauche" />
            Précédent
          </span>
        )}

        {fenetre(page, pages).map((n, i) =>
          n === "…" ? (
            <span key={`saut-${i}`} className="px-1 text-[13px] text-ink-3" aria-hidden>
              …
            </span>
          ) : n === page ? (
            <span
              key={n}
              aria-current="page"
              className={`${boite} border-transparent bg-brand-fill text-brand-on`}
            >
              {n}
            </span>
          ) : (
            <Link
              key={n}
              href={lien(n)}
              aria-label={`Page ${n}`}
              className={`${boite} border-line bg-surface text-ink hover:bg-surface-2`}
            >
              {n}
            </Link>
          )
        )}

        {page < pages ? (
          <Link href={lien(page + 1)} rel="next" className={`${boite} border-line bg-surface text-ink hover:bg-surface-2`}>
            Suivant
            <Chevron sens="droite" />
          </Link>
        ) : (
          <span aria-disabled className={`${boite} cursor-default border-line bg-surface-2 text-ink-3`}>
            Suivant
            <Chevron sens="droite" />
          </span>
        )}
      </div>

      {/* Repère de position, pas une mention légale : il se lit vraiment, donc
          il prend la couleur de texte secondaire et non la teinte la plus pâle. */}
      <p className="text-[12.5px] text-ink-2">
        {debut}–{fin} sur {total} {libelle} · page {page} sur {pages}
      </p>
    </nav>
  );
}
