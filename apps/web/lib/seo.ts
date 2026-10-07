/**
 * SEO / distribution (DF-06) : URL canonique, JSON-LD Schema.org.
 * NEXT_PUBLIC_SITE_URL=https://abidjan4all.info en production.
 */

import { plainTitle } from "@/lib/format";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const SITE_NAME = "Abidjan4All";

export const absoluteUrl = (path: string) => `${SITE_URL}${path}`;

/** NewsMediaOrganization — éditeur commun à toutes les pages. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    "@id": `${SITE_URL}#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    // Logo déclaré aux moteurs : le même que celui affiché sur le site, sans
    // quoi Google Actualités montrerait une marque que le lecteur ne
    // reconnaîtrait pas en arrivant.
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/logo-web-light.png"),
      width: 320,
      height: 81,
    },
    sameAs: [],
  };
}

export interface ArticleForSeo {
  slug: string;
  title: string;
  dek: string | null;
  premium: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  tags: string[];
  rubrique: { slug: string; name: string };
  author: { name: string };
  coverAsset: { url: string } | null;
}

/**
 * NewsArticle — avec le balisage paywall recommandé par Google
 * (isAccessibleForFree + hasPart cssSelector) pour le contenu premium.
 */
export function newsArticleJsonLd(article: ArticleForSeo) {
  const url = absoluteUrl(`/${article.rubrique.slug}/${article.slug}`);
  const image =
    article.coverAsset && !article.coverAsset.url.startsWith("placeholder://")
      ? [absoluteUrl(article.coverAsset.url)]
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    // Sans nettoyage, Google indexait le titre avec ses astérisques.
    headline: plainTitle(article.title),
    description: article.dek ?? undefined,
    image,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    articleSection: article.rubrique.name,
    keywords: article.tags.join(", ") || undefined,
    inLanguage: "fr",
    author: { "@type": "Person", name: article.author.name },
    publisher: { "@id": `${SITE_URL}#organization` },
    isAccessibleForFree: !article.premium,
    ...(article.premium
      ? {
          hasPart: {
            "@type": "WebPageElement",
            isAccessibleForFree: false,
            cssSelector: ".paywalled",
          },
        }
      : {}),
  };
}

/** BreadcrumbList — Accueil › Rubrique › Article. */
export function breadcrumbJsonLd(article: ArticleForSeo) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: article.rubrique.name,
        item: absoluteUrl(`/${article.rubrique.slug}`),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: absoluteUrl(`/${article.rubrique.slug}/${article.slug}`),
      },
    ],
  };
}

/** échappement XML pour RSS / sitemap news */
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Sérialise un objet JSON-LD pour insertion dans `<script type="application/ld+json">`.
 *
 * `JSON.stringify` n'échappe pas le chevron : un titre d'article contenant
 * `</script>` fermerait la balise et tout ce qui suit serait exécuté comme du
 * HTML. Aucun contenu en base ne présente aujourd'hui ce motif — vérifié — mais
 * les titres viennent de la reprise d'un site tiers et du connecteur, deux
 * sources que la rédaction ne relit pas caractère par caractère.
 *
 * L'échappement Unicode reste du JSON parfaitement valide : les moteurs de
 * recherche lisent la même donnée, le navigateur ne voit plus de balise.
 *
 * ATTENTION AUX ANTISLASHS. Ce qu'on veut écrire dans le JSON, c'est la SUITE
 * DE SIX CARACTÈRES qui désigne le chevron, pas le chevron lui-même. Avec un
 * seul antislash, le littéral VAUT « < » et le remplacement ne fait rien :
 * la fonction rend alors son entrée inchangée. C'est la forme qu'avait ce
 * code jusqu'au 7 octobre 2026, ce commentaire d'alerte compris — un défaut
 * invisible à la relecture, puisque le code a l'air juste.
 *
 * Un contrôle automatique garde désormais la main : voir `seo.test.ts`.
 */
export function jsonLdScript(donnees: unknown): string {
  return JSON.stringify(donnees)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
