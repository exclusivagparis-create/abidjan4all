import type { NextConfig } from "next";

// Domaine canonique en production (aligné sur lib/seo.ts).
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://abidjan4all.net").replace(/\/$/, "");

/**
 * Redirections 301 depuis l'ancien site abidjan4all.net (URLs `Nom_rNN.html`).
 * Rubriques avec équivalent direct dans la nouvelle nomenclature ; les
 * anciennes rubriques sans équivalent (Santé, International, Société,
 * L'Interview, Reportage…) tombent dans le repli générique vers l'accueil,
 * comme les anciennes pages articles (`*_aNNNN.html`).
 */
const LEGACY_RUBRIQUES: Array<[source: string, destination: string]> = [
  ["/Actualites_r16.html", "/"],
  ["/Politique_r6.html", "/politique"],
  ["/Economie_r36.html", "/economie"],
  ["/Art-Culture_r20.html", "/culture"],
  ["/Peinture_r55.html", "/culture"],
  ["/Sport_r23.html", "/sport"],
  ["/Education_r11.html", "/formation"],
  ["/Tech-Innovation_r26.html", "/business"],
];

/**
 * En-têtes de sécurité. Le site n'en envoyait aucun.
 *
 * `Content-Security-Policy` n'est volontairement PAS posée ici : elle demande
 * un relevé complet des origines réellement chargées (régie, GA4, polices,
 * lecteurs vidéo) et une recette dédiée. Une CSP trop stricte casse le site en
 * silence, une CSP trop large ne protège de rien. Elle fait l'objet d'une
 * étape à part — voir le rapport de revue.
 */
const EN_TETES_SECURITE = [
  // Deux ans, sous-domaines compris : le navigateur refusera tout retour en
  // clair, même si quelqu'un tape l'adresse en http://.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Interdit au navigateur de deviner le type d'un fichier : un téléversement
  // au contenu inattendu ne peut plus être réinterprété en HTML.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Anti-clickjacking. `frame-ancestors` fait foi sur les navigateurs récents,
  // `X-Frame-Options` couvre les plus anciens — le lectorat en compte.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  // Ne fuite pas le chemin consulté vers les sites tiers.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Aucune de ces interfaces n'est utilisée par le site.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  // Les packages du workspace sont livrés en sources TS : Next les transpile.
  transpilePackages: ["@a4a/ui", "@a4a/db", "@a4a/payments", "@a4a/ai"],
  // `X-Powered-By: Next.js` annonçait la pile et sa version probable à qui
  // cherche une faille connue. Aucun intérêt fonctionnel.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: EN_TETES_SECURITE }];
  },
  // geoip-lite lit ses bases `.dat` sur le disque, à un chemin relatif à son
  // propre dossier : empaqueté par webpack, il les cherche dans .next/ et
  // échoue (500 sur toutes les pages). Laissé externe, il les retrouve.
  serverExternalPackages: ["geoip-lite"],
  // Image Docker minimale (server.js autonome + traces de dépendances).
  // Conditionnel : la sortie standalone crée des symlinks, interdits sans
  // privilèges sous Windows — activée uniquement dans le build Docker (Linux).
  ...(process.env.DOCKER_BUILD ? { output: "standalone" as const } : {}),

  // Découverte OAuth : les chemins /.well-known/ sont normalisés (RFC 8414 et
  // 9728), mais un dossier commençant par un point n'est pas un segment de
  // route fiable dans l'App Router. Une réécriture les fait pointer vers de
  // vraies routes, sans changer l'adresse vue par le client.
  async rewrites() {
    return [
      { source: "/.well-known/oauth-authorization-server", destination: "/api/oauth/metadata" },
      { source: "/.well-known/oauth-protected-resource", destination: "/api/oauth/resource-metadata" },
      // Certains clients suffixent le chemin de la ressource :
      // /.well-known/oauth-protected-resource/api/mcp
      { source: "/.well-known/oauth-authorization-server/:path*", destination: "/api/oauth/metadata" },
      { source: "/.well-known/oauth-protected-resource/:path*", destination: "/api/oauth/resource-metadata" },
    ];
  },

  async redirects() {
    return [
      // Ancien domaine mobile → domaine canonique, chemin conservé (les
      // anciennes URLs .html sont ensuite reprises par les règles ci-dessous).
      {
        source: "/:path*",
        has: [{ type: "host" as const, value: "m.abidjan4all.net" }],
        destination: `${SITE_URL}/:path*`,
        statusCode: 301,
      },
      ...LEGACY_RUBRIQUES.map(([source, destination]) => ({
        source,
        destination,
        statusCode: 301,
      })),
      { source: "/syndication.rss", destination: "/rss.xml", statusCode: 301 },
      { source: "/subscription", destination: "/abonnement", statusCode: 301 },
      { source: "/newsletter", destination: "/", statusCode: 301 },
      // NOTE : pas de repli générique `*.html → /` ici. Les redirects de
      // next.config s'appliquent AVANT le routage et masqueraient les règles
      // gérées depuis le Studio. Le repli est fait dans app/[rubrique]/page.tsx,
      // après consultation de la table Redirect.
    ];
  },
};

export default nextConfig;
