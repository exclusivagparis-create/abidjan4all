/**
 * Détection des brouillons en double.
 *
 * La reprise des archives d'abidjan4all.net a laissé 1 454 titres présents
 * plusieurs fois parmi les brouillons, soit 2 056 copies excédentaires. Le
 * rapprochement se fait sur l'égalité stricte du titre : mesuré sur la base de
 * production, normaliser la casse et les espaces ne change strictement rien au
 * résultat — la complication n'aurait rien apporté.
 *
 * Toute la logique tient dans une fonction de fenêtrage : `row_number()`
 * numérote les articles partageant un même titre, du plus récemment modifié au
 * plus ancien. Le n° 1 est celui qu'on garde ; les suivants sont les copies.
 * Cette distinction est le point essentiel de la fonctionnalité : « supprimer
 * les doublons » sans elle effacerait aussi l'original.
 */
import { prisma } from "@a4a/db";

// Le départage `ORDER BY "updatedAt" DESC, id ASC` est répété tel quel dans
// chaque requête, et non extrait dans une constante : $queryRaw traite toute
// interpolation comme un paramètre lié, jamais comme du SQL. L'identique doit
// donc rester identique à la main — sans critère stable, deux copies pourraient
// permuter d'un appel à l'autre et « celle qu'on garde » changerait sous les
// yeux du rédacteur.

export interface CopieDoublon {
  id: string;
  /** 1 = exemplaire conservé ; au-delà, copie excédentaire. */
  rang: number;
  /** Nombre total d'exemplaires portant ce titre. */
  tailleGroupe: number;
}

/** Combien de titres sont concernés, et combien d'articles sont en trop. */
export async function compterDoublons(): Promise<{ groupes: number; copiesEnTrop: number }> {
  const [row] = await prisma.$queryRaw<{ groupes: bigint; copies: bigint }[]>`
    SELECT count(*)::bigint AS groupes, (coalesce(sum(n), 0) - count(*))::bigint AS copies
    FROM (
      SELECT count(*) AS n FROM "Article"
      WHERE status = 'draft' GROUP BY title HAVING count(*) > 1
    ) g
  `;
  return { groupes: Number(row?.groupes ?? 0), copiesEnTrop: Number(row?.copies ?? 0) };
}

/**
 * Une page d'articles appartenant à un groupe de doublons, triée par titre
 * pour que les exemplaires d'un même titre se suivent à l'écran.
 */
export async function pageDoublons(
  skip: number,
  take: number
): Promise<{ copies: CopieDoublon[]; total: number }> {
  const [lignes, [compte]] = await Promise.all([
    prisma.$queryRaw<{ id: string; rang: bigint; taille: bigint }[]>`
      WITH classe AS (
        SELECT id, title,
               row_number() OVER (PARTITION BY title ORDER BY "updatedAt" DESC, id ASC) AS rang,
               count(*)     OVER (PARTITION BY title) AS taille
        FROM "Article" WHERE status = 'draft'
      )
      SELECT id, rang, taille FROM classe
      WHERE taille > 1
      ORDER BY title ASC, rang ASC
      LIMIT ${take} OFFSET ${skip}
    `,
    prisma.$queryRaw<{ total: bigint }[]>`
      SELECT count(*)::bigint AS total FROM (
        SELECT count(*) OVER (PARTITION BY title) AS taille
        FROM "Article" WHERE status = 'draft'
      ) x WHERE taille > 1
    `,
  ]);

  return {
    copies: lignes.map((l) => ({ id: l.id, rang: Number(l.rang), tailleGroupe: Number(l.taille) })),
    total: Number(compte?.total ?? 0),
  };
}

/**
 * Slugs des copies EXCÉDENTAIRES uniquement — un exemplaire de chaque titre est
 * délibérément laissé de côté. C'est ce que doit sélectionner le bouton de
 * nettoyage : supprimer l'ensemble d'un groupe ferait disparaître l'article.
 */
export async function slugsCopiesExcedentaires(max: number): Promise<{ slugs: string[]; total: number }> {
  const [lignes, [compte]] = await Promise.all([
    prisma.$queryRaw<{ slug: string }[]>`
      SELECT slug FROM (
        SELECT slug, row_number() OVER (PARTITION BY title ORDER BY "updatedAt" DESC, id ASC) AS rang
        FROM "Article" WHERE status = 'draft'
      ) x WHERE rang > 1
      LIMIT ${max}
    `,
    prisma.$queryRaw<{ total: bigint }[]>`
      SELECT count(*)::bigint AS total FROM (
        SELECT row_number() OVER (PARTITION BY title ORDER BY "updatedAt" DESC, id ASC) AS rang
        FROM "Article" WHERE status = 'draft'
      ) x WHERE rang > 1
    `,
  ]);
  return { slugs: lignes.map((l) => l.slug), total: Number(compte?.total ?? 0) };
}
