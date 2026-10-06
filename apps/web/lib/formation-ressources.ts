/**
 * Fichiers joints aux leçons d'A4A Formation.
 *
 * Une formation ne tient pas dans une vidéo : il y faut le support de cours,
 * le modèle de business plan, la grille d'exercices. Ces fichiers sont la
 * contrepartie concrète du prix payé — ils ne doivent donc jamais être
 * atteignables par une adresse devinable, et c'est pourquoi ils vivent sous
 * `/documents/`, que la route publique des médias ne sert pas.
 *
 * Ils sont rangés dans la colonne `resources` de la leçon, qui existait déjà
 * sans être utilisée : une table à part n'apporterait rien tant qu'on ne les
 * cherche jamais autrement que par leur leçon.
 *
 * Module sans accès à la base ni au DOM.
 */

/** Formats acceptés au dépôt, et ce que le lecteur en lit. */
export const FORMATS: Record<string, { ext: string; label: string }> = {
  "application/pdf": { ext: "pdf", label: "PDF" },
  "application/msword": { ext: "doc", label: "Word" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: "docx", label: "Word" },
  "application/vnd.ms-excel": { ext: "xls", label: "Excel" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ext: "xlsx", label: "Excel" },
  "application/vnd.ms-powerpoint": { ext: "ppt", label: "PowerPoint" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { ext: "pptx", label: "PowerPoint" },
  "application/zip": { ext: "zip", label: "Archive" },
  "text/csv": { ext: "csv", label: "CSV" },
};

/** Extensions servies par la route de téléchargement — rien d'exécutable. */
export const EXTENSIONS_SERVIES = [...new Set(Object.values(FORMATS).map((f) => f.ext))];

/**
 * Alias de type et non interface : Prisma n'accepte comme valeur JSON que les
 * types qui admettent une signature d'index, ce qu'une interface n'a pas.
 */
export type Ressource = {
  /** Adresse interne `/documents/…` — jamais servie telle quelle. */
  url: string;
  /** Nom affiché, et nom du fichier téléchargé. */
  nom: string;
  /** PDF, Word, Excel… tel que lu par un humain. */
  label: string;
  /** Taille en octets, pour prévenir avant un téléchargement lourd. */
  taille: number;
};

const estRessource = (v: unknown): v is Ressource =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as Ressource).url === "string" &&
  (v as Ressource).url.startsWith("/documents/") &&
  typeof (v as Ressource).nom === "string";

/**
 * Relit les fichiers d'une leçon sans faire confiance au stockage.
 *
 * La colonne est du JSON libre : une donnée ancienne ou abîmée ne doit pas
 * faire tomber la page d'un cours entier, elle est simplement ignorée.
 */
export function ressourcesDe(resources: unknown): Ressource[] {
  if (!Array.isArray(resources)) return [];
  return resources.filter(estRessource).map((r) => ({
    url: r.url,
    nom: String(r.nom).slice(0, 120),
    label: typeof r.label === "string" && r.label ? r.label : "Fichier",
    taille: Number.isFinite(r.taille) ? Number(r.taille) : 0,
  }));
}

/** « 420 Ko », « 2,4 Mo ». Un poids annoncé évite un téléchargement subi. */
export function formatTaille(octets: number): string {
  if (octets <= 0) return "";
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/**
 * Nom du fichier tel qu'il arrivera dans les téléchargements du lecteur.
 *
 * Les accents sont transposés plutôt que remplacés par des tirets : un
 * « Modèle de business plan » enregistré sous « Mod-le de business plan »
 * donne l'impression d'un fichier abîmé. Tout le reste de ce qui n'est ni
 * lettre, ni chiffre, ni espace devient un tiret — séparateurs de chemin et
 * guillemets compris, qui n'ont rien à faire dans un nom de fichier ni dans
 * l'entête HTTP qui le porte.
 */
export function nomDeFichier(nom: string, url: string): string {
  const ext = url.split(".").pop() ?? "";
  const base =
    nom
      .replace(/\.[a-z0-9]{1,5}$/i, "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9 ._-]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^[\s-]+|[\s-]+$/g, "") || "document";
  return `${base}.${ext}`;
}

/** Offres A4A+ qui ouvrent les cours payants — même liste que l'inscription. */
export const PLANS_INCLUANT_FORMATION = ["pro", "corporate"];

export interface AccesFormation {
  /** L'utilisateur est-il inscrit au cours ? */
  inscrit: boolean;
  /** Prix du cours, en FCFA. */
  prix: number;
  /** Abonnement A4A+ en cours de validité couvrant la formation. */
  abonnementCouvrant: boolean;
  /** Rôle, pour la relecture éditoriale. */
  role?: string | null;
}

/**
 * Qui peut télécharger les fichiers d'une leçon.
 *
 * Une seule définition, partagée par la page du cours et par la route de
 * téléchargement : deux règles écrites séparément finissent toujours par
 * diverger, et celle qui cède est la seconde — celle qui garde le fichier.
 */
export function peutTelecharger(acces: AccesFormation): boolean {
  if (["journalist", "editor", "admin"].includes(acces.role ?? "")) return true;
  if (acces.inscrit) return true;
  if (acces.prix <= 0) return true;
  return acces.abonnementCouvrant;
}
