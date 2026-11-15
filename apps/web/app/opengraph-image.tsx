import { ImageResponse } from "next/og";

/**
 * Image d'aperçu par défaut, pour les partages sur les réseaux et la
 * messagerie.
 *
 * Les articles ont la leur — leur photo de une, posée par `generateMetadata`.
 * Tout le reste n'en avait aucune : l'accueil, les rubriques, les pages
 * légales. Partagé sur WhatsApp, où se fait une grande part de la circulation
 * vers la diaspora, le lien apparaissait alors en bloc de texte gris, sans
 * image — la forme même d'un lien douteux.
 *
 * Dessinée en code plutôt que déposée en fichier : rien à régénérer quand le
 * texte change, et aucun binaire de plus dans le dépôt. Next la sert à
 * `/opengraph-image` et l'injecte dans les pages qui n'en déclarent pas.
 */
export const alt = "Abidjan4All — média numérique de la Côte d'Ivoire et de la diaspora";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: "#12223f",
          color: "#ffffff",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 38 }}>
          <div style={{ width: 20, height: 20, borderRadius: 10, background: "#F47920" }} />
          <div style={{ fontSize: 27, letterSpacing: 5, color: "#F47920", fontWeight: 700 }}>
            ABIDJAN4ALL.INFO
          </div>
        </div>
        <div style={{ fontSize: 70, lineHeight: 1.14, fontWeight: 700 }}>
          Le média numérique de la Côte d&apos;Ivoire et de sa diaspora
        </div>
        <div style={{ marginTop: 40, fontSize: 30, color: "#b9c4d6" }}>
          Actualité · Politique · Économie · Cacao &amp; marchés · Diaspora
        </div>
      </div>
    ),
    size
  );
}
