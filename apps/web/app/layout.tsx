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

/*
 * NOTE SUR LE CONSENTEMENT PUBLICITAIRE — retiré d'ici volontairement.
 *
 * Un préambule maison forçait les annonces en mode non personnalisé tant que
 * le lecteur n'avait pas accepté notre propre bandeau. Il avait un sens tant
 * que rien d'autre ne posait la question.
 *
 * Ce n'est plus le cas : en activant AdSense, Google a mis en service SON
 * message de consentement (Privacy & messaging, cadre TCF — `window.__tcfapi`
 * est présent sur toutes les pages). Deux dispositifs se sont alors superposés,
 * et le message de Google, plein écran, masquait le site entier : la bande
 * Diaspora, le menu, tout ce qui se trouvait derrière.
 *
 * Deux mécanismes de consentement ne sont pas seulement laids : le lecteur
 * répond deux fois, et ses deux réponses peuvent se contredire. Un seul doit
 * faire autorité. C'est celui de Google, parce qu'il est enregistré au cadre
 * TCF — condition pour que les annonces se vendent normalement auprès du
 * lectorat européen, une part réelle de la diaspora — et parce que c'est lui
 * que la régie consulte pour décider de la personnalisation.
 *
 * Si vous préférez reprendre la main, la manœuvre n'est pas ici : elle est dans
 * le compte AdSense, rubrique Confidentialité et messagerie, où le message
 * européen se désactive. Ce fichier suivrait alors le chemin inverse.
 */

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
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
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
        {/* Notre bandeau ne concerne plus que la mesure d'audience : la
            publicité relève du message de Google (cf. note ci-dessus). */}
        <CookieConsent ga4Id={GA4_ID} />
      </body>
    </html>
  );
}
