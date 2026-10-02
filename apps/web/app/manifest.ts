import type { MetadataRoute } from "next";

/**
 * Manifeste de l'application installable.
 *
 * L'audit demandait une application mobile native, iOS et Android. Celle-ci
 * s'installe depuis le navigateur : l'icône rejoint l'écran d'accueil, le site
 * s'ouvre en plein écran sans barre d'adresse, et les alertes push — déjà en
 * service — y arrivent comme dans une application de magasin. Sans double
 * développement, sans validation de store, et mise à jour à chaque
 * déploiement.
 *
 * Ce qu'elle ne fait pas : figurer dans l'App Store et le Play Store. Si cette
 * présence devient nécessaire, cette base reste le socle d'un emballage natif.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Abidjan4All — l'info de la Côte d'Ivoire et de la diaspora",
    short_name: "Abidjan4All",
    description:
      "L'actualité de la Côte d'Ivoire, de l'Afrique et de la diaspora : politique, économie, cacao, culture, enquêtes et vérification des faits.",
    lang: "fr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBF8F3",
    theme_color: "#10213A",
    categories: ["news", "magazines"],
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android rogne les icônes en cercle, losange ou goutte selon le
      // fabricant : ces deux-là portent la marge qui évite de trancher le logo.
      { src: "/icone-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "En direct", url: "/en-direct" },
      { name: "Cacao & Marchés", url: "/cacao-marches" },
      { name: "Diaspora", url: "/diaspora" },
    ],
  };
}
