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
        <CookieConsent ga4Id={GA4_ID} />
      </body>
    </html>
  );
}
