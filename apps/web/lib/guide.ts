/**
 * Guide de l'Afrique — structure d'une fiche.
 *
 * La rédaction ne part pas d'une page blanche : une fiche se remplit case par
 * case, toujours les mêmes. C'est ce qui fait qu'on peut comparer deux pays
 * sans relire deux textes entiers, et ce qui évite qu'une fiche oublie la
 * monnaie pendant qu'une autre oublie les langues.
 *
 * Ce module décrit cette structure en un seul endroit : le formulaire du
 * Studio, l'encadré d'identité et le corps de la fiche s'en servent tous les
 * trois. Ajouter un champ ici le fait apparaître aux trois endroits.
 *
 * Module sans accès à la base ni au DOM.
 */

/** Champs de l'encadré d'identité. Vides pour une fiche thématique. */
export const IDENTITE = [
  { cle: "capitale", label: "Capitale", exemple: "Yamoussoukro" },
  { cle: "population", label: "Population", exemple: "31,9 millions (2024)" },
  { cle: "superficie", label: "Superficie", exemple: "322 462 km²" },
  { cle: "langues", label: "Langues", exemple: "Français (officielle), baoulé, dioula…" },
  { cle: "monnaie", label: "Monnaie", exemple: "Franc CFA (XOF)" },
  { cle: "independance", label: "Indépendance", exemple: "7 août 1960" },
] as const;

export type CleIdentite = (typeof IDENTITE)[number]["cle"];

/**
 * Sections rédigées, dans l'ordre de lecture.
 *
 * Quatre sections et un encadré de repères : assez pour couvrir un pays,
 * assez peu pour qu'une fiche se termine. Une liste plus longue produirait
 * des fiches aux trois quarts vides.
 */
export const SECTIONS = [
  { cle: "histoire", label: "Histoire", aide: "Des origines à aujourd'hui, par étapes." },
  { cle: "culture", label: "Culture", aide: "Langues, arts, musique, cuisine, fêtes." },
  { cle: "societe", label: "Société", aide: "Population, religions, éducation, vie quotidienne." },
  { cle: "economie", label: "Économie", aide: "Ressources, filières, échanges, emploi." },
  { cle: "aSavoir", label: "À savoir", aide: "Repères utiles, chiffres, idées reçues à corriger." },
] as const;

export type CleSection = (typeof SECTIONS)[number]["cle"];

export const REGIONS = [
  "Afrique de l'Ouest",
  "Afrique centrale",
  "Afrique du Nord",
  "Afrique de l'Est",
  "Afrique australe",
  "Diaspora",
  "Panafricain",
] as const;

export type Fiche = {
  slug: string;
  title: string;
  kind: string;
  region: string | null;
  summary: string;
} & Partial<Record<CleIdentite | CleSection, string | null>>;

/** Lignes de l'encadré d'identité réellement renseignées. */
export function identiteDe(fiche: Partial<Record<CleIdentite, string | null>>): Array<{ label: string; valeur: string }> {
  return IDENTITE.map((champ) => ({ label: champ.label, valeur: (fiche[champ.cle] ?? "").trim() })).filter(
    (ligne) => ligne.valeur !== ""
  );
}

/** Sections réellement rédigées, dans l'ordre. Le HTML vide ne compte pas. */
export function sectionsDe(fiche: Partial<Record<CleSection, string | null>>): Array<{ cle: CleSection; label: string; html: string }> {
  return SECTIONS.map((s) => ({ cle: s.cle, label: s.label, html: (fiche[s.cle] ?? "").trim() })).filter(
    (s) => s.html !== "" && s.html !== "<p></p>" && s.html !== "<br>"
  );
}

/**
 * Part de la fiche déjà remplie, de 0 à 100.
 *
 * Affichée dans le Studio : une fiche encyclopédique se complète en plusieurs
 * fois, souvent à plusieurs mains, et rien n'est plus décourageant qu'une
 * liste où l'on ne voit pas ce qui reste à faire.
 */
export function avancement(fiche: Partial<Record<CleIdentite | CleSection, string | null>> & { summary?: string }): number {
  const cases = [
    (fiche.summary ?? "").trim(),
    ...IDENTITE.map((c) => (fiche[c.cle] ?? "").trim()),
    ...SECTIONS.map((s) => (fiche[s.cle] ?? "").trim()),
  ];
  const remplies = cases.filter((v) => v !== "" && v !== "<p></p>").length;
  return Math.round((remplies / cases.length) * 100);
}

/** Adresse d'une fiche. Une seule définition, pour le site comme le Studio. */
export const cheminFiche = (slug: string) => `/guide/${slug}`;

/** Slug depuis un titre : « Côte d'Ivoire » → « cote-d-ivoire ». */
export function slugifier(titre: string): string {
  return titre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

/**
 * Regroupe les fiches par région pour le sommaire.
 *
 * Les fiches sans région forment un groupe à part, en fin de sommaire : mieux
 * vaut les montrer que les perdre parce que personne n'a rempli le champ.
 */
export function parRegion<T extends { region: string | null }>(fiches: T[]): Array<{ region: string; fiches: T[] }> {
  const groupes = new Map<string, T[]>();
  for (const f of fiches) {
    const cle = (f.region ?? "").trim() || "Autres fiches";
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle)!.push(f);
  }
  const ordre = [...REGIONS, "Autres fiches"];
  return [...groupes.entries()]
    .sort((a, b) => {
      const ia = ordre.indexOf(a[0] as (typeof ordre)[number]);
      const ib = ordre.indexOf(b[0] as (typeof ordre)[number]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map(([region, fiches]) => ({ region, fiches }));
}
