/**
 * Reconstitution des dates de publication des archives d'abidjan4all.net.
 *
 * La reprise n'a conservé aucune date : `publishedAt` est vide sur les 4 299
 * brouillons, `createdAt` ne porte que le jour de l'import, aucun champ ne
 * garde la date source, et le site d'origine n'expose ni sitemap ni flux.
 * Publier en l'état daterait six ans d'archives d'aujourd'hui — le Mondial
 * 2022 paraîtrait être l'actualité du jour, et les articles récents de la
 * rédaction disparaîtraient sous quatre mille pages.
 *
 * Ce qui subsiste, c'est l'identifiant du site source, gravé dans le nom des
 * fichiers image : `a4a-<identifiant>-<image>-<aléa>.jpg`. Il croît avec le
 * temps. Il donne donc l'ORDRE exact ; restait à lui donner une échelle.
 *
 * D'où les ancrages ci-dessous : des articles dont la date est établie par
 * l'événement qu'ils rapportent, et non par une donnée du site. Entre deux
 * ancrages, la date est interpolée linéairement ; avant le premier, extrapolée
 * à la cadence du premier segment.
 *
 * Ces dates sont donc RECONSTITUÉES, à quelques jours près — jamais
 * authentiques. Deux vérifications faites sur des articles volontairement
 * exclus des ancrages : le rapport sur la mort d'Elizabeth II tombe au 27
 * septembre 2022 (publié le 29), et l'hommage au roi Pelé au 29 décembre 2022
 * (jour de sa mort). Le plus ancien article tombe au 12 septembre 2020, et son
 * titre annonce « à l'approche des élections présidentielles » — scrutin du 31
 * octobre 2020.
 */

/**
 * Identifiant source → date certaine de l'événement rapporté.
 * Trié par identifiant croissant. Toute correction se fait ici.
 */
const ANCRAGES = [
  [55736644, "2021-04-20"], // mort d'Idriss Déby
  [57122566, "2021-06-15"], // Euro 2020 : entrée en lice de la France
  [57643008, "2021-07-11"], // Euro 2020 : finale Italie-Angleterre aux tirs au but
  [61582402, "2022-01-12"], // CAN 2021 : Côte d'Ivoire - Guinée équatoriale
  [61918788, "2022-01-26"], // CAN 2021 : le Mali éliminé en huitièmes
  [67242363, "2022-09-08"], // mort d'Elizabeth II
  [69574279, "2022-12-13"], // Mondial 2022 : demi-finale Argentine - Croatie
  [74279707, "2023-07-26"], // Niger : les mutins confirment la chute de Bazoum
  [78108279, "2024-02-03"], // CAN 2023 : quart de finale Côte d'Ivoire - Mali
  [93316910, "2025-12-21"], // CAN 2025 : cérémonie d'ouverture
  [97632303, "2026-08-07"], // 66 ans de l'indépendance ivoirienne
];

const JOUR = 86_400_000;
const POINTS = ANCRAGES.map(([id, jour]) => ({ id, t: Date.parse(`${jour}T09:00:00Z`) }));

/** Identifiant source d'une URL `/uploads/a4a-<id>-…`, ou null. */
export function identifiantSource(url) {
  const m = /a4a-(\d+)-/.exec(url ?? "");
  return m ? Number(m[1]) : null;
}

/**
 * Date reconstituée pour un identifiant source. Renvoie null si l'identifiant
 * manque — un article sans visuel d'origine n'est pas datable, et lui inventer
 * une date serait pire que de le laisser de côté.
 */
export function dateReconstituee(id) {
  if (!id) return null;

  // Avant le premier ancrage : on prolonge la cadence du premier segment.
  // Après le dernier : celle du dernier. Le corpus s'arrête au dernier ancrage,
  // mais la symétrie évite qu'un ajout futur ne tombe dans un trou.
  const premier = POINTS[0];
  const dernier = POINTS[POINTS.length - 1];
  if (id <= premier.id) return extrapoler(id, POINTS[0], POINTS[1]);
  if (id >= dernier.id) return extrapoler(id, POINTS[POINTS.length - 2], dernier);

  for (let i = 0; i < POINTS.length - 1; i++) {
    const a = POINTS[i];
    const b = POINTS[i + 1];
    if (id >= a.id && id <= b.id) {
      const part = (id - a.id) / (b.id - a.id);
      return new Date(a.t + part * (b.t - a.t));
    }
  }
  return null;
}

function extrapoler(id, a, b) {
  const cadence = (b.id - a.id) / (b.t - a.t); // identifiants par milliseconde
  return new Date(a.t + (id - a.id) / cadence);
}

/** Cadence moyenne d'un segment, en identifiants par jour — pour contrôle. */
export function cadences() {
  return POINTS.slice(0, -1).map((a, i) => {
    const b = POINTS[i + 1];
    return {
      de: new Date(a.t).toISOString().slice(0, 10),
      a: new Date(b.t).toISOString().slice(0, 10),
      parJour: Math.round((b.id - a.id) / ((b.t - a.t) / JOUR)),
    };
  });
}
