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

/**
 * Fond du site (`--bg`), par thème. Le bandeau reprend cette couleur à 82 %
 * d'opacité par-dessus la page : au repos, l'un et l'autre se confondent.
 */
const FOND_CLAIR = [0xfb, 0xfa, 0xf7];
const FOND_SOMBRE = [0x0e, 0x14, 0x1f];

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
 *   - `transparent` : un des deux tons devient transparent, l'autre prend `o.encre`
 *   - `echange`     : le bleu et le blanc permutent (fond opaque conservé)
 *   - `teinte`      : le bleu d'origine est remplacé par celui de la charte
 * @param {number[]} [o.encre]
 * @param {boolean} [o.encreClaire]
 *   Quel ton porte le dessin. Pour le mot-symbole c'est le BLEU qui dessine sur
 *   un fond blanc ; pour le badge c'est l'inverse, le blanc dessine sur un fond
 *   bleu. Sans cette bascule, le badge rendrait son fond opaque et ses lettres
 *   transparentes — exactement le contraire de ce qu'on cherche.
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
  let etendue = Math.max(1, lmax - lmin);

  // Pour le badge, les extrêmes ne sont pas les bons repères : son fond bleu
  // n'est pas le point le plus sombre de l'image (il porte un léger dégradé, et
  // le dessin contient des ombres plus foncées encore). Normaliser sur les
  // extrêmes plaçait donc ce fond à un cinquième de l'axe, et la couleur visée
  // n'était jamais atteinte — mesuré : rgb(224,225,226) au lieu du rgb(251,
  // 250,247) demandé.
  //
  // On prend plutôt les deux tons DOMINANTS, celui du fond et celui de l'encre :
  // ce sont eux qui doivent tomber exactement sur les couleurs voulues.
  if (o.mode === "fondSite") {
    const hist = new Float64Array(256);
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = px(i);
      if (estOrange(r, g, b) || estVert(r, g, b)) continue;
      hist[Math.round(lum(r, g, b))]++;
    }
    const dominant = (de, a) => {
      let meilleur = de;
      for (let v = de; v <= a; v++) if (hist[v] > hist[meilleur]) meilleur = v;
      return meilleur;
    };
    const milieu = Math.round((lmin + lmax) / 2);
    const lFond = dominant(Math.round(lmin), milieu);
    const lEncre = dominant(milieu, Math.round(lmax));
    if (lEncre > lFond) {
      lmin = lFond;
      etendue = lEncre - lFond;
    }
  }

  // Drapeau : repéré par sa bande verte, puis élargi vers la gauche pour
  // englober le blanc et l'orange qui la précèdent. Sans cela sa bande blanche
  // serait traitée comme du texte — teinte en bleu, ou rendue transparente.
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

  // Blanc EXTÉRIEUR au dessin, à distinguer du blanc qui dessine.
  //
  // Le badge est un carré aux angles arrondis : une fois recadré, ses quatre
  // coins restent blancs, comme le sont ses lettres. Traités de la même façon,
  // ils devenaient des équerres opaques autour du logo. On les reconnaît à ce
  // qu'ils touchent le bord et se rejoignent : une propagation depuis le
  // pourtour, à travers les pixels clairs, les atteint tous sans jamais entrer
  // dans une lettre, qui est entourée de bleu.
  const dehors = new Uint8Array(L * H);
  if (o.encreClaire || o.mode === "fondSite") {
    const clair = (q) => {
      const i = q * 4;
      return (lum(data[i], data[i + 1], data[i + 2]) - lmin) / etendue > 0.55;
    };
    const pile = [];
    for (let X = 0; X < L; X++) pile.push(X, (H - 1) * L + X);
    for (let Y = 0; Y < H; Y++) pile.push(Y * L, Y * L + L - 1);
    while (pile.length) {
      const q = pile.pop();
      if (dehors[q] || !clair(q)) continue;
      dehors[q] = 1;
      const X = q % L;
      const Y = (q / L) | 0;
      if (X > 0) pile.push(q - 1);
      if (X < L - 1) pile.push(q + 1);
      if (Y > 0) pile.push(q - L);
      if (Y < H - 1) pile.push(q + L);
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = px(i);
    if (estOrange(r, g, b) || estVert(r, g, b)) continue;

    if (dehors[i / 4]) {
      data[i + 3] = 0;
      continue;
    }

    const t = Math.max(0, Math.min(1, (lum(r, g, b) - lmin) / etendue));

    if (o.protegerDrapeau && dx1 > 0) {
      const q = i / 4;
      const X = q % L;
      const Y = (q / L) | 0;
      if (X >= dx0 && X <= dx1 && Y >= dy0 && Y <= dy1) {
        // Dans le drapeau, la bande claire est du BLANC et doit le rester,
        // opaque : ce n'est ni du texte à recolorer, ni du fond à effacer.
        // Le reste de la zone suit la règle commune — sans quoi un rectangle
        // opaque subsisterait autour du drapeau.
        if (t > 0.6) {
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = 255;
          continue;
        }
      }
    }

    if (o.mode === "fondSite") {
      // Le carré est conservé, mais son fond prend la couleur de la page : au
      // lieu de disparaître, il se confond. `t` situe le pixel entre le fond
      // d'origine (0) et l'encre d'origine (1) ; on le replace entre les deux
      // couleurs voulues, ce qui emporte l'anti-crénelage avec lui.
      data[i] = Math.round(o.fond[0] + (o.encre[0] - o.fond[0]) * t);
      data[i + 1] = Math.round(o.fond[1] + (o.encre[1] - o.fond[1]) * t);
      data[i + 2] = Math.round(o.fond[2] + (o.encre[2] - o.fond[2]) * t);
    } else if (o.mode === "transparent") {
      // `t` situe le pixel entre le ton sombre (0) et le ton clair (1).
      // L'opacité suit le ton qui DESSINE, l'autre disparaît.
      const opacite = o.encreClaire ? t : 1 - t;
      data[i] = o.encre[0];
      data[i + 1] = o.encre[1];
      data[i + 2] = o.encre[2];
      data[i + 3] = Math.round(255 * opacite);
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

// Badge : le carré est CONSERVÉ, mais son fond prend la couleur de la page. Il
// se confond alors avec le bandeau au lieu d'y former une vignette rapportée —
// c'était le cas avec son bleu d'origine sur le thème sombre, et avec du blanc
// pur sur le blanc chaud du thème clair.
//
// Les quatre coins, eux, restent transparents : ils sont hors du carré arrondi,
// et une couleur pleine y dessinerait des équerres.
await fabriquer({
  source: path.join(SOURCES, "logo-mobile.jpg"),
  sortie: path.join(PUBLIC, "logo-mobile-light.png"),
  recadrage: BADGE,
  largeur: 120,
  hauteur: 120,
  mode: "fondSite",
  fond: FOND_CLAIR,
  encre: NAVY,
  protegerDrapeau: true,
});
await fabriquer({
  source: path.join(SOURCES, "logo-mobile.jpg"),
  sortie: path.join(PUBLIC, "logo-mobile-dark.png"),
  recadrage: BADGE,
  largeur: 120,
  hauteur: 120,
  mode: "fondSite",
  fond: FOND_SOMBRE,
  encre: BLANC,
  protegerDrapeau: true,
});
