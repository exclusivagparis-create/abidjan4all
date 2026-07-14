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

const nextConfig: NextConfig = {
  // Les packages du workspace sont livrés en sources TS : Next les transpile.
  transpilePackages: ["@a4a/ui", "@a4a/db", "@a4a/payments", "@a4a/ai"],
  // Image Docker minimale (server.js autonome + traces de dépendances).
  // Conditionnel : la sortie standalone crée des symlinks, interdits sans
  // privilèges sous Windows — activée uniquement dans le build Docker (Linux).
  ...(process.env.DOCKER_BUILD ? { output: "standalone" as const } : {}),

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
