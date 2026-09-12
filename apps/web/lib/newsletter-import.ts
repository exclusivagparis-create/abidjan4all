/**
 * Lecture d'un fichier plat d'adresses, pour injecter en masse des inscrits
 * dans une newsletter : liste tenue sur un salon, fichier d'un ancien
 * prestataire, export d'un tableur.
 *
 * Le séparateur demandé est la virgule. On accepte aussi le retour à la
 * ligne, le point-virgule et la tabulation : un export tableur d'une seule
 * colonne place une adresse par ligne, et s'en tenir à la virgule seule
 * obligerait la rédaction à reformater ses fichiers à la main pour rien.
 *
 * Module sans accès à la base : la lecture est du texte pur, on peut la
 * mettre à l'épreuve seule.
 */

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Plafond par import. Au-delà, la lecture s'arrête et le dit. */
export const MAX_ADRESSES = 5000;

/**
 * Les actions serveur de Next acceptent 1 Mo de corps de requête par défaut.
 * On refuse plus tôt, avec un message clair, plutôt que de laisser le
 * framework rejeter la requête sans explication.
 */
export const TAILLE_MAX_OCTETS = 900 * 1024;

export interface LectureAdresses {
  /** Adresses retenues : en minuscules, sans doublon, dans l'ordre du fichier. */
  adresses: string[];
  /** Échantillon des jetons écartés, pour que la rédaction voie ce qui a sauté. */
  invalides: string[];
  /** Nombre total de jetons écartés (en-tête de colonne, texte parasite). */
  nbInvalides: number;
  /** Adresses valides répétées dans le fichier. */
  doublons: number;
  /** Le fichier dépassait MAX_ADRESSES : le reste n'a pas été lu. */
  tronque: boolean;
}

/**
 * Nettoie un jeton brut.
 *
 * Deux formes courantes dans les fichiers réels : un tableur entoure ses
 * valeurs de guillemets, et un carnet d'adresses exporte « Nom
 * <adresse@exemple.com> ». On en extrait l'adresse au lieu de la rejeter.
 */
function nettoyer(brut: string): string {
  return brut
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/^.*<([^>]+)>.*$/, "$1")
    .trim()
    .toLowerCase();
}

export function lireAdresses(contenu: string): LectureAdresses {
  // Excel préfixe ses CSV UTF-8 d'une marque d'ordre d'octets, qui collerait
  // à la première adresse et la rendrait invalide.
  const jetons = contenu.replace(/^\uFEFF/, "").split(/[,;\t\r\n]+/);

  const adresses: string[] = [];
  const vues = new Set<string>();
  const invalides: string[] = [];
  let nbInvalides = 0;
  let doublons = 0;
  let tronque = false;

  for (const brut of jetons) {
    const jeton = nettoyer(brut);
    if (!jeton) continue;

    if (jeton.length > 160 || !RE_EMAIL.test(jeton)) {
      nbInvalides++;
      if (invalides.length < 8) invalides.push(jeton.slice(0, 60));
      continue;
    }
    if (vues.has(jeton)) {
      doublons++;
      continue;
    }
    if (adresses.length >= MAX_ADRESSES) {
      tronque = true;
      break;
    }
    vues.add(jeton);
    adresses.push(jeton);
  }

  return { adresses, invalides, nbInvalides, doublons, tronque };
}
