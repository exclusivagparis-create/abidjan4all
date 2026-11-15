import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Règles de la diffusion sociale — la part sans base ni réseau, donc testable.
 *
 * Le site n'écrit sur aucune plateforme lui-même. Il émet un seul appel signé
 * vers l'automate (Activepieces), qui détient les autorisations de Facebook,
 * de LinkedIn et des autres, et qui distribue. Ce fichier décrit ce que
 * contient cet appel et comment il est signé.
 *
 * Pourquoi ce détour plutôt qu'un appel direct à l'API de Meta : les jetons de
 * page expirent, l'API change de version deux fois l'an, et chaque réseau
 * ajouté demanderait son propre code ici. L'automate absorbe tout cela, et il
 * tourne déjà sur le serveur.
 */

/** Ce que reçoit l'automate. Versionné : un flux déjà construit ne doit pas casser. */
export type PayloadDiffusion = {
  evenement: "article.publie";
  version: 1;
  article: {
    id: string;
    titre: string;
    chapeau: string | null;
    url: string;
    image: string | null;
    rubrique: string;
    auteur: string;
    publieLe: string;
    motsCles: string[];
  };
};

export type ArticleADiffuser = {
  id: string;
  slug: string;
  title: string;
  dek: string | null;
  tags: string[];
  publishedAt: Date | null;
  rubrique: { slug: string; name: string };
  author: { name: string | null };
  coverAsset: { url: string } | null;
};

/** Enlève le balisage d'emphase que la rédaction pose dans les titres. */
function titreNu(titre: string): string {
  return titre.replace(/\*/g, "").trim();
}

/**
 * Adresse absolue, avec ou sans barre finale sur la racine.
 *
 * Une URL relative ne sert à rien ici : elle part vers Facebook, qui la
 * résoudrait contre son propre domaine.
 */
export function urlArticle(racine: string, rubriqueSlug: string, slug: string): string {
  return `${racine.replace(/\/+$/, "")}/${rubriqueSlug}/${slug}`;
}

export function construirePayload(a: ArticleADiffuser, racine: string): PayloadDiffusion {
  return {
    evenement: "article.publie",
    version: 1,
    article: {
      id: a.id,
      titre: titreNu(a.title),
      chapeau: a.dek?.trim() || null,
      url: urlArticle(racine, a.rubrique.slug, a.slug),
      // L'image est absolue pour la même raison que l'adresse : l'aperçu est
      // construit chez la plateforme, pas chez nous.
      image: a.coverAsset ? `${racine.replace(/\/+$/, "")}${a.coverAsset.url}` : null,
      rubrique: a.rubrique.name,
      auteur: a.author.name ?? "La rédaction",
      publieLe: (a.publishedAt ?? new Date()).toISOString(),
      motsCles: a.tags.slice(0, 12),
    },
  };
}

/**
 * Signature du corps, en HMAC-SHA256.
 *
 * L'automate est joignable depuis l'extérieur : sans signature, n'importe qui
 * connaissant son adresse pourrait lui faire publier ce qu'il veut sur la page
 * officielle. Le secret est partagé entre le site et le flux.
 */
export function signer(corps: string, secret: string): string {
  return createHmac("sha256", secret).update(corps, "utf8").digest("hex");
}

/** Comparaison à durée constante — une égalité naïve fuit le secret, octet par octet. */
export function signatureValide(corps: string, secret: string, recue: string): boolean {
  const attendue = signer(corps, secret);
  const a = Buffer.from(attendue, "utf8");
  const b = Buffer.from(recue, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
