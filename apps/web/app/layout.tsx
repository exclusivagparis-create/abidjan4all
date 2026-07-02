import type { Metadata } from "next";
import { Archivo, Newsreader } from "next/font/google";
import { ThemeProvider, ThemeScript } from "@a4a/ui";
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
  title: {
    default: "Abidjan4All — média numérique de la Côte d'Ivoire et de la diaspora",
    template: "%s · Abidjan4All",
  },
  description:
    "Actualité, business, cacao, diaspora : le média numérique de référence de la Côte d'Ivoire.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
