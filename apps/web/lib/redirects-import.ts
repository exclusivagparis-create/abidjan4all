/**
 * Lecture d'un fichier de redirections, pour en charger un lot d'un coup.
 *
 * Le besoin vient de la bascule de l'ancien site : 4 500 adresses en
 * `/Titre-de-l-article_a4396.html` à faire pointer vers leur article. Les
 * saisir une par une dans le Studio n'est pas une option.
 *
 * Une ligne = une règle, source et destination séparées par une virgule, une
 * tabulation ou un point-virgule. La flèche « → » est acceptée aussi : c'est
 * ce que produit un copier-coller depuis un tableau.
 *
 * Module sans accès à la base : la lecture est du texte pur, on peut la
 * mettre à l'épreuve seule.
 */

/** Plafond par import. Au-delà, la lecture s'arrête et le dit. */
export const MAX_REGLES = 10000;

/**
 * Les actions serveur de Next acceptent 1 Mo de corps de requête par défaut.
 * On refuse plus tôt, avec un message clair, plutôt que de laisser le
 * framework rejeter la requête sans explication.
 */
export const TAILLE_MAX_OCTETS = 900 * 1024;

export interface RegleLue {
  from: string;
  to: string;
}

export interface LectureRedirections {
  /** Règles retenues, sans doublon de source, dans l'ordre du fichier. */
  regles: RegleLue[];
  /** Échantillon des lignes écartées, avec leur motif. */
  rejets: string[];
  /** Nombre total de lignes écartées. */
  nbRejets: number;
  /** Sources répétées dans le fichier : seule la première est gardée. */
  doublons: number;
  /** Le fichier dépassait MAX_REGLES : le reste n'a pas été lu. */
  tronque: boolean;
}

/**
 * Normalise un chemin source.
 *
 * Le repli de route du site ne voit qu'une seule section d'adresse : une
 * source en `/dossier/page.html` ne serait jamais consultée. On la refuse ici
 * plutôt que de créer une règle qui ne servira jamais.
 */
export function normaliserSource(brut: string): string | null {
  let s = brut.trim().replace(/^["']+|["']+$/g, "");
  if (!s) return null;

  // Une adresse complète copiée depuis le navigateur : on n'en garde que le
  // chemin, sinon la règle ne correspondrait à aucune requête.
  const m = s.match(/^https?:\/\/[^/]+(\/.*)$/i);
  if (m?.[1]) s = m[1];

  if (!s.startsWith("/")) s = `/${s}`;
  s = s.split("#")[0] ?? "";
  if (!s) return null;
  if (s.slice(1).includes("/")) return null;
  if (s.length > 200) return null;
  return s;
}

/** Normalise une destination : chemin interne, ou adresse http(s) complète. */
export function normaliserDestination(brut: string): string | null {
  let s = brut.trim().replace(/^["']+|["']+$/g, "");
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s.slice(0, 300);
  if (!s.startsWith("/")) s = `/${s}`;
  return s.slice(0, 300);
}

export function lireRedirections(contenu: string): LectureRedirections {
  // Excel préfixe ses CSV UTF-8 d'une marque d'ordre d'octets, qui collerait
  // à la première source et la rendrait invalide.
  const lignes = contenu.replace(/^﻿/, "").split(/\r?\n/);

  const regles: RegleLue[] = [];
  const vues = new Set<string>();
  const rejets: string[] = [];
  let nbRejets = 0;
  let doublons = 0;
  let tronque = false;

  for (const ligne of lignes) {
    const brut = ligne.trim();
    if (!brut) continue;
    // Ligne de commentaire ou en-tête de colonne d'un export tableur.
    if (brut.startsWith("#")) continue;

    const parts = brut.split(/\s*(?:→|->|[,;\t])\s*/).filter(Boolean);
    const ajouterRejet = (motif: string) => {
      nbRejets++;
      if (rejets.length < 8) rejets.push(`${brut.slice(0, 70)} — ${motif}`);
    };

    if (parts.length < 2) {
      ajouterRejet("destination manquante");
      continue;
    }

    const from = normaliserSource(parts[0] ?? "");
    const to = normaliserDestination(parts[1] ?? "");

    if (!from) {
      ajouterRejet("source invalide (une seule section attendue)");
      continue;
    }
    if (!to) {
      ajouterRejet("destination invalide");
      continue;
    }
    if (from === to) {
      ajouterRejet("source et destination identiques");
      continue;
    }
    if (vues.has(from)) {
      doublons++;
      continue;
    }
    if (regles.length >= MAX_REGLES) {
      tronque = true;
      break;
    }

    vues.add(from);
    regles.push({ from, to });
  }

  return { regles, rejets, nbRejets, doublons, tronque };
}
