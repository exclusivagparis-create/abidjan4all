/**
 * Fabrique les variantes claires et sombres des logos, à partir des fichiers
 * fournis par la direction.
 *
 * Les originaux sont des JPEG opaques : un mot-symbole bleu nuit sur blanc pour
 * le web, un badge carré bleu nuit à texte blanc pour le téléphone. Tels quels,
 * le premier disparaît sur fond sombre et le second traîne un liseré blanc.
 *
 * Le traitement ne « inverse » pas au sens brutal du terme — une inversion
 * franche retournerait aussi l'orange, qui deviendrait bleu. Chaque pixel est
 * situé sur l'axe bleu nuit ↔ blanc d'après sa luminance, puis replacé à la
 * position voulue sur ce même axe. L'orange et le vert du drapeau sont
 * reconnus et laissés intacts. L'anti-crénelage suit sans halo, puisque les
 * pixels intermédiaires gardent leur position relative.
 *
 * Le bleu employé est celui de la charte (`--navy`), et non celui échantillonné
 * dans le JPEG : les logos s'accordent ainsi aux aplats du site.
 *
 *   node scripts/fabriquer-logos.mjs
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
// Chemin explicite : `sharp` est une dépendance transitive de Next, absente des
// node_modules des paquets du dépôt.
const sharp = require(path.join(racine, "node_modules/.pnpm/sharp@0.34.5/node_modules/sharp"));

const PUBLIC = path.join(racine, "apps/web/public");
// Les originaux fournis par la direction vivent hors du dossier public : ils ne
// sont pas destines aux lecteurs, seulement a refabriquer les variantes.
const SOURCES = path.join(racine, "assets/logos");

/** Bleu de l'identité visuelle (packages/ui/src/tokens.css, `--navy`). */
const NAVY = [0x1a, 0x2a, 0x4a];
const BLANC = [255, 255, 255];

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** L'orange de la marque : rouge dominant, bleu très en retrait. */
const estOrange = (r, g, b) => r > 150 && r - b > 60 && g < r - 30;
/** Le vert du drapeau ivoirien. */
const estVert = (r, g, b) => g > 90 && g - r > 25 && g - b > 25;

/**
 * @param {object} o
 * @param {string} o.source      fichier d'entrée
 * @param {string} o.sortie      fichier de sortie
 * @param {{left:number,top:number,width:number,height:number}} [o.recadrage]
 * @param {number} o.largeur
 * @param {number} o.hauteur
 * @param {"transparent"|"echange"|"teinte"} o.mode
 *   - `transparent` : le blanc devient transparent, l'encre prend `o.encre`
 *   - `echange`     : le bleu et le blanc permutent (fond opaque conservé)
 *   - `teinte`      : le bleu d'origine est remplacé par celui de la charte
 * @param {number[]} [o.encre]
 * @param {boolean} [o.protegerDrapeau]
 */
async function fabriquer(o) {
  let img = sharp(o.source);
  if (o.recadrage) img = img.extract(o.recadrage);
  const { data, info } = await img
    .resize(o.largeur, o.hauteur, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: L, height: H } = info;
  const px = (i) => [data[i], data[i + 1], data[i + 2]];

  // Bornes de luminance des pixels « à deux tons », pour situer chaque pixel
  // sur l'axe sans supposer les valeurs exactes du JPEG.
  let lmin = 255;
  let lmax = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = px(i);
    if (estOrange(r, g, b) || estVert(r, g, b)) continue;
    const l = lum(r, g, b);
    if (l < lmin) lmin = l;
    if (l > lmax) lmax = l;
  }
  const etendue = Math.max(1, lmax - lmin);

  // Drapeau : repéré par sa bande verte, puis élargi vers la gauche pour
  // englober le blanc et l'orange qui la précèdent. Sans cela l'échange
  // teindrait en bleu la bande blanche du drapeau.
  let dx0 = Infinity;
  let dy0 = Infinity;
  let dx1 = -1;
  let dy1 = -1;
  if (o.protegerDrapeau) {
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = px(i);
      if (!estVert(r, g, b)) continue;
      const q = i / 4;
      const X = q % L;
      const Y = (q / L) | 0;
      if (X < dx0) dx0 = X;
      if (X > dx1) dx1 = X;
      if (Y < dy0) dy0 = Y;
      if (Y > dy1) dy1 = Y;
    }
    if (dx1 > 0) {
      const large = dx1 - dx0 + 1;
      dx0 -= large * 2.4;
      dx1 += large * 0.3;
      dy0 -= 2;
      dy1 += 2;
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = px(i);
    if (estOrange(r, g, b) || estVert(r, g, b)) continue;

    if (o.protegerDrapeau && dx1 > 0) {
      const q = i / 4;
      const X = q % L;
      const Y = (q / L) | 0;
      if (X >= dx0 && X <= dx1 && Y >= dy0 && Y <= dy1) continue;
    }

    const t = Math.max(0, Math.min(1, (lum(r, g, b) - lmin) / etendue));

    if (o.mode === "transparent") {
      // t=1 (blanc du fond) → invisible ; t=0 (encre) → opaque.
      data[i] = o.encre[0];
      data[i + 1] = o.encre[1];
      data[i + 2] = o.encre[2];
      data[i + 3] = Math.round(255 * (1 - t));
    } else {
      const u = o.mode === "echange" ? 1 - t : t;
      data[i] = Math.round(NAVY[0] + (BLANC[0] - NAVY[0]) * u);
      data[i + 1] = Math.round(NAVY[1] + (BLANC[1] - NAVY[1]) * u);
      data[i + 2] = Math.round(NAVY[2] + (BLANC[2] - NAVY[2]) * u);
    }
  }

  await sharp(data, { raw: { width: L, height: H, channels: 4 } })
    .png({ compressionLevel: 9, palette: o.mode !== "transparent" })
    .toFile(o.sortie);

  const nom = path.basename(o.sortie);
  const { size } = await import("node:fs/promises").then((fs) => fs.stat(o.sortie));
  console.log(`  ${nom.padEnd(26)} ${L}×${H}  ${Math.round(size / 1024)} Ko`);
}

// Le badge occupe les pixels 18→449 sur 474 et 18→439 sur 454 : la marge
// blanche du JPEG est retirée à la source plutôt que masquée en CSS.
const BADGE = { left: 18, top: 18, width: 432, height: 422 };

console.log("Logos fabriqués dans apps/web/public :");

// Mot-symbole web : fond retiré, encre selon le thème.
await fabriquer({
  source: path.join(SOURCES, "logo-web.jpg"),
  sortie: path.join(PUBLIC, "logo-web-light.png"),
  largeur: 320,
  hauteur: 81,
  mode: "transparent",
  encre: NAVY,
});
await fabriquer({
  source: path.join(SOURCES, "logo-web.jpg"),
  sortie: path.join(PUBLIC, "logo-web-dark.png"),
  largeur: 320,
  hauteur: 81,
  mode: "transparent",
  encre: BLANC,
});

// Badge : bleu de charte sur le thème sombre, couleurs permutées sur le clair.
await fabriquer({
  source: path.join(SOURCES, "logo-mobile.jpg"),
  sortie: path.join(PUBLIC, "logo-mobile-dark.png"),
  recadrage: BADGE,
  largeur: 120,
  hauteur: 120,
  mode: "teinte",
});
await fabriquer({
  source: path.join(SOURCES, "logo-mobile.jpg"),
  sortie: path.join(PUBLIC, "logo-mobile-light.png"),
  recadrage: BADGE,
  largeur: 120,
  hauteur: 120,
  mode: "echange",
  protegerDrapeau: true,
});
