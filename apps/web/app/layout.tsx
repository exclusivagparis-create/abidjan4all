import type { Metadata } from "next";
import { Archivo, Archivo_Expanded, Newsreader } from "next/font/google";
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

const archivoExpanded = Archivo_Expanded({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-archivo-expanded",
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
      className={`${newsreader.variable} ${archivo.variable} ${archivoExpanded.variable}`}
    >
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
