import Link from "next/link";
import type { Metadata } from "next";
import { prisma, type ArticleStatus } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { ArticlesSelection, type LigneArticle } from "@/components/admin/articles-selection";
import { Pagination } from "@/components/admin/pagination";
import { compterDoublons, pageDoublons } from "@/lib/doublons";
import { formatDate, initials } from "@/lib/format";

export const metadata: Metadata = { title: "Articles · Studio" };
export const dynamic = "force-dynamic";

/** Articles par page. La liste en compte plus de six mille depuis la reprise
 *  des archives : sans pagination, la quasi-totalité restait hors d'atteinte. */
const PAR_PAGE = 50;

const FILTERS: { key: string; label: string; status?: ArticleStatus }[] = [
  { key: "tout", label: "Tout" },
  { key: "published", label: "Publié", status: "published" },
  { key: "scheduled", label: "Programmé", status: "scheduled" },
  { key: "review", label: "Révision", status: "review" },
  { key: "draft", label: "Brouillon", status: "draft" },
  // Pas un statut : un rapprochement entre articles. Le compteur affiche les
  // copies EN TROP, pas les articles concernés — c'est ce nombre-là qui
  // disparaîtra, et celui que le rédacteur veut connaître.
  { key: "doublons", label: "Doublons" },
];

export default async function AdminArticles({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; q?: string; rubrique?: string; page?: string }>;
}) {
  const { statut = "tout", q = "", rubrique = "", page: pageBrute } = await searchParams;
  const session = await auth();
  const peutSupprimer = PUBLISH_ROLES.includes(session?.user?.role as (typeof PUBLISH_ROLES)[number]);
  const filter = FILTERS.find((f) => f.key === statut) ?? FILTERS[0]!;
  const query = q.trim();

  const where = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(rubrique ? { rubrique: { slug: rubrique } } : {}),
    ...(query ? { title: { contains: query, mode: "insensitive" as const } } : {}),
  };

  // « Doublons » ne s'exprime pas en clause WHERE : il faut comparer les
  // articles entre eux. Ce filtre est donc résolu à part, par une requête à
  // fenêtre qui numérote les exemplaires de chaque titre (cf. lib/doublons.ts).
  const modeDoublons = statut === "doublons";
  // Compté systématiquement : la pastille doit annoncer le nombre de copies
  // même quand le filtre n'est pas actif — c'est ainsi qu'on découvre qu'il
  // y a quelque chose à nettoyer.
  const doublons = await compterDoublons();

  // Le nombre d'articles du filtre courant borne la pagination ; il est donc
  // établi avant de rabattre un numéro de page hors limites.
  const filtres = modeDoublons ? (await pageDoublons(0, 0)).total : await prisma.article.count({ where });
  const pages = Math.max(1, Math.ceil(filtres / PAR_PAGE));
  const page = Math.min(pages, Math.max(1, Number(pageBrute) || 1));

  // En mode doublons, c'est la requête à fenêtre qui décide de la page ; on ne
  // recharge ensuite que les colonnes d'affichage, en réappliquant son ordre.
  const copies = modeDoublons ? (await pageDoublons((page - 1) * PAR_PAGE, PAR_PAGE)).copies : [];
  const rangs = new Map(copies.map((c) => [c.id, c]));

  // Colonnes d'affichage, communes aux deux modes. Extraites plutôt que
  // dupliquées ou fusionnées par un spread conditionnel : Prisma déduit ses
  // types de l'objet littéral, et une union d'arguments lui fait perdre le fil.
  const colonnes = {
    id: true,
    slug: true,
    title: true,
    status: true,
    hidden: true,
    featuredRank: true,
    views: true,
    publishedAt: true,
    scheduledAt: true,
    updatedAt: true,
    rubrique: { select: { name: true, color: true } },
    author: { select: { name: true } },
  } as const;

  const [byStatus, rubriques, articlesBruts] = await Promise.all([
    prisma.article.groupBy({ by: ["status"], _count: true }),
    prisma.rubrique.findMany({ orderBy: { order: "asc" }, select: { slug: true, name: true } }),
    modeDoublons
      ? prisma.article.findMany({ where: { id: { in: copies.map((c) => c.id) } }, select: colonnes })
      : prisma.article.findMany({
          where,
          // Tri sur la date de PARUTION, pas sur la date de modification.
          //
          // `updatedAt` semblait dire « les plus récents d'abord » tant que les
          // articles étaient touchés un par un. La reprise des archives l'a
          // démenti : elle a réécrit 4 248 articles en une passe, du plus récent
          // au plus ancien, si bien que les articles de 2020 se sont retrouvés
          // en tête de liste — ceux modifiés en dernier. Une date de modification
          // dit quand une ligne a changé, pas quand l'article a paru ; sur un
          // journal, c'est la parution qui ordonne.
          //
          // Les brouillons n'ont pas de date de parution et passent devant :
          // ce sont eux qui attendent une décision de la rédaction.
          orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { updatedAt: "desc" }],
          skip: (page - 1) * PAR_PAGE,
          take: PAR_PAGE,
          select: colonnes,
        }),
  ]);

  // `findMany` avec `id: { in: [...] }` ne respecte pas l'ordre de la liste
  // fournie : on rétablit celui de la requête à fenêtre, sans quoi les
  // exemplaires d'un même titre se disperseraient dans la page.
  const articles = modeDoublons
    ? copies.map((c) => articlesBruts.find((a) => a.id === c.id)).filter((a) => a !== undefined)
    : articlesBruts;

  const total = byStatus.reduce((sum, b) => sum + b._count, 0);
  const countOf = (s?: ArticleStatus) => (s ? (byStatus.find((b) => b.status === s)?._count ?? 0) : total);

  // Changer de filtre ou de recherche renvoie en page 1 : `page` n'est jamais
  // reconduit ici. Rester en page 7 d'une liste qui vient d'en perdre cinq
  // afficherait un vide inexplicable.
  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { statut: filter.key, q: query, rubrique, ...over };
    for (const [k, v] of Object.entries(merged)) if (v && v !== "tout") p.set(k, v);
    const s = p.toString();
    return s ? `/admin/articles?${s}` : "/admin/articles";
  };

  // Mise en forme côté serveur : le composant de sélection reste un simple
  // afficheur, sans logique de dates ni de nombres.
  const lignes: LigneArticle[] = articles.map((a) => ({
    id: a.id,
    slug: a.slug,
    titre: a.title,
    rubriqueNom: a.rubrique.name,
    rubriqueCouleur: a.rubrique.color,
    auteur: a.author.name,
    initiales: initials(a.author.name),
    statut: a.status,
    dateLabel: a.status === "scheduled" ? formatDate(a.scheduledAt) : formatDate(a.publishedAt ?? a.updatedAt),
    vuesLabel: a.status === "published" ? a.views.toLocaleString("fr-FR") : "—",
    featuredRank: a.featuredRank,
    masque: a.hidden,
    rangDoublon: rangs.get(a.id)?.rang ?? null,
    tailleGroupe: rangs.get(a.id)?.tailleGroupe ?? null,
  }));

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-bold">Articles</h1>
        <Link
          href="/admin/articles/new"
          className="inline-flex items-center gap-[7px] rounded-pill bg-red px-[18px] py-2.5 text-[13px] font-bold text-white"
        >
          <span className="text-[15px] leading-none">＋</span>Nouvel article
        </Link>
      </div>

      {/* recherche + filtre rubrique */}
      <form method="get" className="mb-3 flex flex-wrap items-center gap-2">
        {filter.key !== "tout" ? <input type="hidden" name="statut" value={filter.key} /> : null}
        <input
          name="q"
          defaultValue={query}
          placeholder="Rechercher un titre…"
          className="min-w-[220px] flex-1 rounded-pill border border-line bg-surface px-4 py-2 text-[13px] outline-none"
        />
        <select name="rubrique" defaultValue={rubrique} className="rounded-pill border border-line bg-surface px-3 py-2 text-[13px]">
          <option value="">Toutes rubriques</option>
          {rubriques.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-pill bg-navy px-4 py-2 text-[13px] font-semibold text-white">
          Rechercher
        </button>
        {query || rubrique ? (
          <Link href={qs({ q: "", rubrique: "" })} className="text-[12.5px] font-semibold text-ink-3">
            Réinitialiser
          </Link>
        ) : null}
      </form>

      {/* filtres par statut */}
      <div className="mb-[18px] flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter.key;
          return (
            <Link
              key={f.key}
              href={qs({ statut: f.key })}
              className={`rounded-pill px-[15px] py-2 text-[13px] font-semibold ${
                active ? "bg-navy text-white" : "border border-line bg-surface text-ink-2"
              }`}
            >
              {f.label}{" "}
              <span className={active ? "opacity-60" : "text-ink-3"}>
                {f.key === "doublons" ? doublons.copiesEnTrop : countOf(f.status)}
              </span>
            </Link>
          );
        })}
      </div>

      <ArticlesSelection
        lignes={lignes}
        peutSupprimer={peutSupprimer}
        // En mode doublons, le nombre qui compte n'est pas celui des articles
        // affiches (exemplaires conserves compris) mais celui des copies qui
        // partiront reellement.
        totalFiltre={modeDoublons ? doublons.copiesEnTrop : filtres}
        filtres={{
          statut: filter.key === 'tout' ? undefined : filter.key,
          q: query || undefined,
          rubrique: rubrique || undefined,
        }}
      />

      <Pagination
        page={page}
        pages={pages}
        total={filtres}
        debut={(page - 1) * PAR_PAGE + 1}
        fin={(page - 1) * PAR_PAGE + lignes.length}
        base="/admin/articles"
        params={{ statut: filter.key === 'tout' ? undefined : filter.key, q: query || undefined, rubrique: rubrique || undefined }}
        libelle="articles"
      />
    </div>
  );
}
