/**
 * Fabrique les deux étapes Code des outils MCP, dérivées des modules déjà
 * éprouvés d'AP-01 et d'AP-03.
 *
 * On DÉRIVE, on ne recopie pas. Le collecteur et le récupérateur de pages ont
 * été mis au point contre la réalité — 39 sources sondées, cinq états de
 * récupération, trois défauts trouvés en exécutant. Les réécrire pour le mode
 * MCP reviendrait à refaire ces erreurs.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/** Extrait une fonction nommée d'un module, accolades équilibrées. */
function prendre(src, nom) {
  const i = src.search(new RegExp(`^export (?:async )?function ${nom}\\(`, 'm'));
  if (i < 0) throw new Error(`fonction ${nom} introuvable`);
  let n = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') n++;
    else if (src[k] === '}') { n--; if (n === 0) return src.slice(i, k + 1).replace(/^export /, ''); }
  }
  throw new Error(`fin de ${nom} introuvable`);
}

// ---------------------------------------------------------------------------
// Outil 1 — collecter_les_actualites
// ---------------------------------------------------------------------------

const collecteur = readFileSync('../ap01/collecteur.mjs', 'utf8')
  .replace(/^import \{ createHash \} from ['"](?:node:)?crypto['"];\n/m, '')
  .replace(/^export (const|function|async function) /gm, '$1 ');

writeFileSync('./outil-collecte.js', `/**
 * Outil MCP « collecter_les_actualites » · étape Code d'Activepieces
 *
 * ENGENDRE depuis ../ap01/collecteur.mjs — ne pas modifier ici.
 *
 * packageJson : VIDE. Aucune dépendance, aucune clé API. Cet outil ne coûte
 * rien et ne dépend d'aucun service payant : c'est tout l'intérêt de la
 * bascule MCP.
 *
 * PARAMETRES du déclencheur MCP Tool :
 *   limite  (nombre, facultatif) : combien de candidats rendre. 60 par défaut,
 *                                  répartis également entre les trois régions.
 *   format  (texte, facultatif)  : « compact » par défaut, ou « complet »
 *
 * POURQUOI 60 ET NON 150. Le jeu entier pèse 157 ko, soit environ 43 000
 * jetons — de quoi grever une conversation dès la première minute. Les 150
 * candidats étaient dimensionnés pour un appel d'API, qui devait tout recevoir
 * d'un coup parce qu'il n'avait pas de seconde chance. Une conversation, elle,
 * peut en redemander : soixante candidats tiennent en 8 000 jetons, et il
 * suffit de rappeler l'outil avec une limite plus haute si le choix est maigre.
 *
 * C'est le premier vrai bénéfice du mode MCP : on n'a plus besoin de tout
 * prévoir d'avance.
 */
// « crypto », et NON « node:crypto » : le bac à sable d'Activepieces rejette
// tout spécificateur portant un schéma.
import { createHash } from 'crypto';

${collecteur}

export const code = async (inputs) => {
  const jeu = await executer({ reglages: inputs?.reglages || undefined });

  // Répartition égale entre les trois régions plutôt qu'un simple « les N
  // meilleurs » : sans cela, une région bavarde prendrait toute la place et il
  // ne resterait rien à choisir pour les autres.
  const limite = Math.max(6, Math.min(Number(inputs?.limite) || 60, jeu.candidates.length));
  const parRegion = Math.ceil(limite / 3);
  const retenus = [];
  for (const region of ['Cote_Ivoire', 'Afrique', 'International']) {
    retenus.push(...jeu.candidates.filter((c) => c.region === region).slice(0, parRegion));
  }
  retenus.sort((a, b) => b.technical_score - a.technical_score);

  const jeuReduit = {
    ...jeu,
    candidates: retenus,
    statistics: { ...jeu.statistics, candidates_rendus: retenus.length, candidates_disponibles: jeu.candidates.length },
  };
  if ((inputs?.format || 'compact') === 'complet') return jeuReduit;

  return {
    ...jeuReduit,
    candidates: retenus.map((c) => ({
      id: c.candidate_id,
      titre: c.title,
      resume: (c.description || '').slice(0, 220),
      url: c.url,
      source: c.source.name,
      primaire: c.source.is_primary !== false,
      piste: c.piste_a_verifier === true,
      region: c.region,
      publie: c.published_at,
      score: c.technical_score,
      aussi_couvert_par: (c.also_covered_by || []).map((x) => x.source),
    })),
  };
};
`);
console.log('outil-collecte.js engendre');

// ---------------------------------------------------------------------------
// Outil 2 — lire_les_articles
// ---------------------------------------------------------------------------

const verif = readFileSync('../ap03/verificateur.mjs', 'utf8');
const constantes = [
  verif.match(/const UA = [^\n]+/)[0],
  verif.match(/\/\*\* Mots qui trahissent[\s\S]*?const MOTS_PAYANTS = [^\n]+/)[0],
  verif.match(/\/\*\* Page d'attente[\s\S]*?const PAGE_ATTENTE = [^\n]+/)[0],
].join('\n\n');
const fonctions = ['extraireTexte', 'recupererTexte'].map((n) => prendre(verif, n)).join('\n\n');

writeFileSync('./outil-lecture.js', `/**
 * Outil MCP « lire_les_articles » · étape Code d'Activepieces
 *
 * ENGENDRE depuis ../ap03/verificateur.mjs — ne pas modifier ici.
 *
 * packageJson : VIDE. Aucune dépendance, aucune clé API.
 *
 * PARAMETRES du déclencheur MCP Tool :
 *   urls  (texte long, obligatoire) : les adresses à lire, une par ligne
 *
 * Rend, pour chaque adresse, le texte de l'article ET SON STATUT. Le statut
 * compte autant que le texte : un article inaccessible est une information
 * utile, pas une panne. Cinq états, tous rencontrés en conditions réelles —
 * \`texte\`, \`partiel\` (chapô libre d'un site payant), \`payant\` (HTTP 402),
 * \`protege\` (page d'attente anti-robot), \`agregateur\` (lien Google News
 * encodé), \`injoignable\`.
 *
 * Aucun paywall n'est contourné : un refus est rapporté comme un refus.
 */

const REGLAGES = { delaiPageMs: 15000, parallelisme: 4, maxUrls: 10, maxCarsParTexte: 6000 };

${constantes}

${fonctions}

export const code = async (inputs) => {
  const urls = String(inputs?.urls || '')
    .split(/[\\n,;]+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\\/\\//i.test(u))
    .filter((u, i, l) => l.indexOf(u) === i)
    .slice(0, REGLAGES.maxUrls);

  if (urls.length === 0) return { erreur: 'Aucune adresse http(s) exploitable dans le paramètre « urls ».', articles: [] };

  // Par lots bornés : on ne se jette pas à dix sur les serveurs.
  const articles = [];
  for (let i = 0; i < urls.length; i += REGLAGES.parallelisme) {
    const lot = urls.slice(i, i + REGLAGES.parallelisme);
    const regles = await Promise.allSettled(lot.map((u) => recupererTexte(u, REGLAGES)));
    for (let j = 0; j < lot.length; j++) {
      const r = regles[j];
      const v = r.status === 'fulfilled' ? r.value : { statut: 'injoignable', texte: '', longueur: 0, motif: String(r.reason).slice(0, 80) };
      articles.push({
        url: lot[j],
        domaine: v.hote,
        statut: v.statut,
        motif: v.motif ?? null,
        caracteres: v.longueur,
        texte: (v.texte || '').slice(0, REGLAGES.maxCarsParTexte),
      });
    }
  }

  const lus = articles.filter((a) => a.statut === 'texte' || a.statut === 'partiel');
  return {
    demandees: urls.length,
    lues: lus.length,
    // Le nombre de DOMAINES distincts, et non d'articles : deux textes du même
    // média ne se corroborent pas, pas plus que deux reprises d'une dépêche.
    domaines_distincts: new Set(lus.map((a) => a.domaine)).size,
    articles,
  };
};
`);
console.log('outil-lecture.js engendre');
