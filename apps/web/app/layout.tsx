import type { Metadata } from "next";
import { Archivo, Newsreader } from "next/font/google";
import { ThemeProvider, ThemeScript } from "@a4a/ui";
import { CookieConsent } from "@/components/cookie-consent";
import { AdSkin } from "@/components/ad-skin";
import { habillageActif } from "@/lib/ad-skin";
import { jsonLdScript, organizationJsonLd, SITE_URL } from "@/lib/seo";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Abidjan4All — média numérique de la Côte d'Ivoire et de la diaspora",
    template: "%s · Abidjan4All",
  },
  description:
    "Actualité, business, cacao, diaspora : le média numérique de référence de la Côte d'Ivoire.",
  openGraph: {
    siteName: "Abidjan4All",
    locale: "fr_FR",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  alternates: { types: { "application/rss+xml": "/rss.xml" } },
};

const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;

/**
 * Identifiant éditeur AdSense. Paramétrable, avec le compte d'Abidjan4All pour
 * valeur par défaut : la balise doit être présente sur toutes les pages pour
 * que Google valide le site, y compris si l'environnement n'est pas renseigné.
 */
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-pub-8158267216064242";

/**
 * Publicité personnalisée : subordonnée au consentement.
 *
 * Google demande de coller sa balise dans le `<head>` de chaque page, sans
 * condition. On le fait — c'est ce qui permet la validation du site et le
 * remplissage des emplacements. Mais la balise, seule, dépose des cookies
 * publicitaires dès la première visite, avant toute question posée au lecteur :
 * cela contredirait la politique de confidentialité du site, qui promet de ne
 * mesurer qu'après accord, et le bandeau qui l'applique déjà pour l'audience.
 *
 * D'où ce préambule, exécuté AVANT le script de Google : tant que le lecteur
 * n'a pas accepté, les annonces sont demandées en mode NON PERSONNALISÉ. Elles
 * s'affichent — donc la régie fonctionne et les revenus rentrent — mais sans
 * profilage. Le consentement accordé, la personnalisation prend effet au
 * chargement suivant.
 *
 * Écrit en JavaScript nu et non via un composant React : il doit s'exécuter
 * avant le script asynchrone de Google, donc pendant l'analyse du `<head>`.
 * En cas d'erreur — navigation privée, stockage refusé — on retombe sur le
 * mode non personnalisé, jamais l'inverse.
 */
const PREAMBULE_ADSENSE = `(function(){
  window.adsbygoogle = window.adsbygoogle || [];
  var accord = false;
  try { accord = localStorage.getItem('a4a-consent') === 'granted'; } catch (e) { accord = false; }
  if (!accord) window.adsbygoogle.requestNonPersonalizedAds = 1;
})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Habillage publicitaire : quand une campagne « habillage » est active, le
  // fond est cliquable et le contenu passe dans un cadre centré (les marges
  // laissent voir le habillage sur grand écran). Sinon, rendu identique.
  const skin = await habillageActif();

  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${newsreader.variable} ${archivo.variable}`}
    >
      <head>
        <ThemeScript />
        {/* Archivo Expanded n'est pas dans le catalogue next/font : même chargement que la maquette */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo+Expanded:wght@600;700;800&display=swap"
          rel="stylesheet"
        />

        {/* Google AdSense — balises `<script>` BRUTES, délibérément.

            `next/script` en `beforeInteractive` n'émet pas de balise dans le
            HTML servi : il pose un `<link rel="preload">` et laisse le runtime
            de Next injecter le script une fois la page chargée. Le navigateur
            s'en accommode, mais le robot de validation d'AdSense ne trouve
            aucune balise et refuse le site — c'est exactement ce qui s'est
            produit. Le HTML doit contenir la balise elle-même.

            L'ordre reste inversé — React remonte les scripts externes au-dessus
            des scripts en ligne — et c'est sans conséquence : un script externe
            asynchrone doit traverser le réseau, quand le préambule est lu par
            l'analyseur dans la foulée. Mesuré sur une vraie requête
            publicitaire : `npa=1` sans consentement, absent après acceptation.
            Ne pas « corriger » cet ordre sans re-mesurer `npa`. */}
        {ADSENSE_CLIENT ? (
          <>
            <script dangerouslySetInnerHTML={{ __html: PREAMBULE_ADSENSE }} />
            <script
              async
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
              crossOrigin="anonymous"
            />
          </>
        ) : null}
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd()) }}
        />
        {skin ? <AdSkin /> : null}
        <ThemeProvider>
          {skin ? (
            <div
              style={{
                position: "relative",
                zIndex: 1,
                maxWidth: 1320,
                margin: "0 auto",
                minHeight: "100vh",
                background: "var(--bg)",
                boxShadow: "0 0 60px rgba(0,0,0,0.28)",
              }}
            >
              {children}
            </div>
          ) : (
            children
          )}
        </ThemeProvider>
        <CookieConsent ga4Id={GA4_ID} adsense={Boolean(ADSENSE_CLIENT)} />
      </body>
    </html>
  );
}
