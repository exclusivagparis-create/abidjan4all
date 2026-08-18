/**
 * Suppression d'articles par lot.
 *
 * Écrit pour l'apurement des 6 367 brouillons issus de la migration
 * d'abidjan4all.net, mais valable pour n'importe quelle sélection.
 *
 * Trois contraintes ont dessiné ce code :
 *
 *  1. `Comment.articleId` est obligatoire et sans cascade : supprimer un
 *     article commenté échoue sur une violation de clé étrangère. Les
 *     commentaires partent donc avec l'article, dans la même transaction.
 *
 *  2. La suppression est définitive — pas de corbeille dans le Studio. Chaque
 *     article est recopié dans ArticleDeletion AVANT de disparaître, à
 *     l'intérieur de la même transaction : soit l'article est effacé et sa
 *     copie existe, soit rien ne se passe. Un journal qui pourrait diverger de
 *     la réalité ne servirait à rien.
 *
 *  3. Un lot ne doit pas capoter en entier parce qu'un article résiste. Chaque
 *     article a sa propre transaction, et les échecs sont collectés puis
 *     rapportés, sans interrompre les suivants.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@a4a/db";

/** Au-delà, la requête est refusée — cf. cahier des charges. */
export const MAX_SLUGS = 1000;

/** Taille des paquets : borne la durée d'une transaction et la mémoire. */
const PAQUET = 50;

export interface EchecSuppression {
  slug: string;
  raison: string;
}

export interface ResultatSuppression {
  deleted: number;
  errors: EchecSuppression[];
  batchId: string;
  /** Répartition de ce qui a réellement été supprimé, par statut. */
  parStatut: Record<string, number>;
}

/**
 * Supprime les articles désignés par leurs slugs.
 *
 * L'appelant a déjà vérifié les droits : cette fonction ne les contrôle pas,
 * elle exécute.
 */
export async function supprimerArticles(
  slugs: string[],
  acteur: { id: string; nom: string }
): Promise<ResultatSuppression> {
  const batchId = randomUUID();
  const errors: EchecSuppression[] = [];
  const parStatut: Record<string, number> = {};
  let deleted = 0;

  // Doublons écartés d'emblée : sans cela, le second passage d'un même slug
  // remonterait comme « introuvable », ce qui serait un faux échec.
  const uniques = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))];

  for (let i = 0; i < uniques.length; i += PAQUET) {
    const paquet = uniques.slice(i, i + PAQUET);

    // Une seule lecture par paquet ; les slugs absents sont signalés ici.
    const articles = await prisma.article.findMany({
      where: { slug: { in: paquet } },
      include: {
        rubrique: { select: { slug: true, name: true } },
        author: { select: { id: true, name: true } },
        coverAsset: { select: { url: true, alt: true } },
      },
    });

    const trouves = new Set(articles.map((a) => a.slug));
    for (const slug of paquet) {
      if (!trouves.has(slug)) errors.push({ slug, raison: "Article introuvable." });
    }

    for (const article of articles) {
      try {
        await prisma.$transaction(async (tx) => {
          // La copie d'abord : si l'écriture du journal échoue, l'article reste.
          await tx.articleDeletion.create({
            data: {
              snapshot: article as unknown as object,
              slug: article.slug,
              title: article.title,
              status: article.status,
              deletedById: acteur.id,
              deletedByName: acteur.nom,
              batchId,
            },
          });

          // Les commentaires n'ont pas de cascade et leur lien est obligatoire :
          // sans cette ligne, la suppression échouerait sur la contrainte.
          await tx.comment.deleteMany({ where: { articleId: article.id } });

          // Le direct n'a de sens qu'avec son article ; laissé en place, il se
          // retrouverait orphelin dans « Nos directs ». Les fact-checks, eux,
          // sont du contenu autonome : leur lien est optionnel, il se dénoue.
          await tx.liveBlog.deleteMany({ where: { articleId: article.id } });

          await tx.article.delete({ where: { id: article.id } });
        },
        // Le plafond par défaut d'une transaction interactive est de 5 s. Sur
        // une base chargée, ou au premier appel après un démarrage, quatre
        // requêtes peuvent le dépasser — et l'article restait alors en place
        // avec, pour tout diagnostic, « transaction expirée ». Quinze secondes
        // laissent la marge sans masquer un vrai blocage.
        { timeout: 15_000, maxWait: 10_000 });

        deleted += 1;
        parStatut[article.status] = (parStatut[article.status] ?? 0) + 1;
      } catch (e) {
        console.error(`[suppression] ${article.slug} a résisté`, e);
        errors.push({
          slug: article.slug,
          raison: e instanceof Error ? abreger(e.message) : "Erreur inattendue.",
        });
      }
    }
  }

  return { deleted, errors, batchId, parStatut };
}

/**
 * Extrait la substance d'un message d'erreur Prisma.
 *
 * Garder la première ligne non vide, l'évidence apparente, ne remonte que
 * « Invalid `prisma.article.delete()` invocation: » — le nom de l'appel qui a
 * échoué, jamais la raison. Or c'est la raison qui intéresse celui qui lit le
 * rapport d'échecs. On écarte donc l'en-tête pour atteindre la ligne utile.
 */
function abreger(message: string): string {
  const lignes = message
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^Invalid `.*` invocation:?$/.test(l));
  return (lignes[0] ?? message.trim()).slice(0, 200);
}

/**
 * Compte, pour une sélection, ce qui est publié ou programmé — de quoi
 * avertir distinctement avant de valider : ces articles-là sont en ligne, et
 * leurs adresses deviendront introuvables.
 */
export async function compterSensibles(slugs: string[]): Promise<{ publies: number; programmes: number }> {
  const [publies, programmes] = await Promise.all([
    prisma.article.count({ where: { slug: { in: slugs }, status: "published" } }),
    prisma.article.count({ where: { slug: { in: slugs }, status: "scheduled" } }),
  ]);
  return { publies, programmes };
}
