/**
 * Filtres de la liste d'articles du Studio.
 *
 * Écrits une fois, utilisés deux fois : par la page qui affiche la liste, et
 * par la route `/api/v1/articles/slugs` qui alimente le bouton « sélectionner
 * les N articles du filtre ». Ces deux-là DOIVENT voir le même ensemble.
 * Chacun construisait auparavant sa propre clause ; ajouter un filtre d'un
 * côté et pas de l'autre aurait suffi à ce qu'une suppression en masse porte
 * sur des articles que le rédacteur ne voyait pas à l'écran.
 */
import type { Prisma, ArticleStatus } from "@a4a/db";

const STATUTS: ArticleStatus[] = ["draft", "review", "scheduled", "published"];

export interface FiltresArticles {
  /** Statut, ou « doublons » / « tout » — résolus ailleurs. */
  statut?: string;
  /** Recherche dans le titre. */
  q?: string;
  /** Slug de rubrique. */
  rubrique?: string;
  /** Identifiant de l'auteur. */
  auteur?: string;
  /** Bornes de date, format `AAAA-MM-JJ`, incluses toutes les deux. */
  du?: string;
  au?: string;
}

/** Date de début de journée, ou null si la saisie n'est pas une date. */
function debutDeJour(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fin de journée : une borne « au 20 août » doit inclure le 20 août entier. */
function finDeJour(v: string | undefined): Date | null {
  const d = debutDeJour(v);
  if (!d) return null;
  d.setHours(23, 59, 59, 999);
  return d;
}

export function clauseArticles(f: FiltresArticles): Prisma.ArticleWhereInput {
  const q = (f.q ?? "").trim();
  const du = debutDeJour(f.du);
  const au = finDeJour(f.au);

  const where: Prisma.ArticleWhereInput = {
    ...(STATUTS.includes(f.statut as ArticleStatus) ? { status: f.statut as ArticleStatus } : {}),
    ...(f.rubrique ? { rubrique: { slug: f.rubrique } } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    ...(f.auteur ? { authorId: f.auteur } : {}),
  };

  if (du || au) {
    const bornes = { ...(du ? { gte: du } : {}), ...(au ? { lte: au } : {}) };
    // La date filtrée est celle que la liste AFFICHE : la parution pour un
    // article paru, la dernière modification pour un brouillon qui n'en a pas.
    // Filtrer sur la seule parution ferait disparaître tous les brouillons dès
    // qu'une borne est posée — un vide que rien à l'écran n'expliquerait.
    where.OR = [{ publishedAt: bornes }, { publishedAt: null, updatedAt: bornes }];
  }

  return where;
}
