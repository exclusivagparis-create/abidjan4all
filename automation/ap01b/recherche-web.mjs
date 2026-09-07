/**
 * AP-01b — Recherche web
 *
 * Complète le jeu d'AP-01 avec ce que les flux n'ont pas vu, en confiant à
 * Claude l'outil de recherche web d'Anthropic. Se place ENTRE AP-01 et AP-02.
 *
 * POURQUOI UN MODULE SÉPARÉ, ET NON UNE PARTIE D'AP-01
 *
 * AP-01 n'a aucune dépendance npm ni clé API — c'est délibéré, et c'est ce qui
 * le rend increvable : il tourne même quand tout le reste est en panne. Y
 * ajouter le SDK et une clé lui ferait perdre cette propriété pour une
 * fonction qui n'est qu'un complément. Ici, si la recherche échoue, le jeu
 * d'AP-01 passe INTACT à AP-02 : la chaîne ne s'arrête jamais pour cela.
 *
 * CE QUE LA RECHERCHE APPORTE, ET CE QU'ELLE NE REMPLACE PAS
 *
 * Un flux RSS répond à « qu'a publié ce média ». Une recherche répond à « que
 * se dit-il sur ce sujet », y compris chez des médias absents du registre. Elle
 * comble donc précisément les trous constatés : Koaci, Fraternité Matin,
 * Abidjan.net n'ont pas de flux, mais leurs articles sont indexés.
 *
 * Les résultats restent NON PRIMAIRES et portent `piste_a_verifier` : une
 * page trouvée par recherche n'a été lue par personne de la rédaction. AP-03
 * ira en chercher le texte, comme pour les autres.
 *
 * COÛT : 10 $ pour 1 000 recherches, soit 0,01 $ l'unité. Avec le plafond de
 * huit recherches par exécution, 0,08 $ par jour de recherche, plus les jetons.
 */

const MODELE = 'claude-opus-5';

export const REGLAGES = {
  mode: 'lot',
  maxTokens: 8000,
  /**
   * Plafond de recherches par execution. C'est la seule bride dure sur le
   * coût : sans elle, un modèle curieux peut enchaîner vingt recherches.
   */
  maxRecherches: 8,
  /** Titres déjà collectés transmis au modèle, pour qu'il cherche AILLEURS. */
  maxTitresConnus: 120,
  /** Trouvailles retenues au plus, par région. */
  maxTrouvaillesParRegion: 6,
  /** Au-delà de ce recouvrement de titre, la trouvaille est un doublon. */
  similariteDoublon: 0.55,
  attenteLotMs: 45 * 60 * 1000,
  sondageInitialMs: 10000,
  sondageMaxMs: 60000,
};

// ---------------------------------------------------------------------------
// Consigne
// ---------------------------------------------------------------------------

const CONSIGNE = `Tu complètes la veille d'Abidjan4All, média numérique ivoirien qui s'adresse à la Côte d'Ivoire et à sa diaspora.

Une collecte automatique par flux RSS vient d'être faite. On te donne les titres déjà obtenus. Ton travail : CHERCHER SUR LE WEB ce que cette collecte a manqué, et rien d'autre.

CHERCHE EN PRIORITÉ
- L'actualité ivoirienne des dernières 24 heures qui n'apparaît pas dans la liste. Plusieurs grands médias ivoiriens n'ont aucun flux RSS (Koaci, Fraternité Matin, Abidjan.net, RTI, 7info) : leurs articles sont pourtant en ligne. C'est là que le manque est le plus grand.
- Ce qui touche la diaspora ivoirienne (France, Canada, États-Unis, Italie, Allemagne, Belgique, Royaume-Uni) : consulats, visas, associations, transferts d'argent, élections vues de l'étranger.
- Les sujets économiques ivoiriens : cacao, café, or, pétrole, BRVM, UEMOA, franc CFA.

NE CHERCHE PAS
- Ce qui figure déjà dans la liste, même sous un autre titre.
- L'actualité internationale générale : les flux la couvrent largement.

RÈGLES
- Ne retiens qu'une page dont la publication date de moins de trois jours.
- Donne l'URL EXACTE de l'article, jamais celle d'une page d'accueil ou d'une rubrique.
- N'invente aucune URL ni aucun titre. Si tu n'as rien trouvé pour une région, laisse-la vide et dis-le dans "remarques". Une liste vide est un résultat honnête ; une liste inventée est une faute.
- Indique pour chacune ce qu'elle apporte que la collecte n'avait pas.

Tu disposes d'un nombre limité de recherches. Emploie-les bien : mieux vaut trois requêtes précises que huit approximatives.`;

const SCHEMA = {
  type: 'object',
  properties: {
    trouvailles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titre: { type: 'string' },
          url: { type: 'string', description: "URL exacte de l'article." },
          source: { type: 'string', description: 'Nom du média ou du site.' },
          region: { type: 'string', enum: ['Cote_Ivoire', 'Afrique', 'International'] },
          publie: { type: 'string', description: 'Date de publication telle que la page l\'indique, ou « inconnue ».' },
          resume: { type: 'string', description: 'Deux phrases sur le contenu.' },
          apport: { type: 'string', description: "Ce que cette page apporte que la collecte n'avait pas." },
        },
        required: ['titre', 'url', 'source', 'region', 'publie', 'resume', 'apport'],
        additionalProperties: false,
      },
    },
    remarques: { type: 'string', description: "Ce qui n'a rien donné, ou « aucune »." },
  },
  required: ['trouvailles', 'remarques'],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Appel du modèle
// ---------------------------------------------------------------------------

async function client(cle) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return new Anthropic({ apiKey: cle });
}

function parametres(messages, reglages) {
  return {
    model: MODELE,
    max_tokens: reglages.maxTokens,
    thinking: { type: 'adaptive' },
    system: CONSIGNE,
    messages,
    tools: [{
      // Version la plus récente : elle filtre les résultats par code avant
      // qu'ils n'entrent dans le contexte, ce qui réduit les jetons sur une
      // requête qui en cherche beaucoup.
      type: 'web_search_20260318',
      name: 'web_search',
      max_uses: reglages.maxRecherches,
      // Localise les résultats : la même requête ne rend pas les mêmes pages
      // vue d'Abidjan et vue de Paris, et c'est Abidjan qui nous intéresse.
      user_location: { type: 'approximate', city: 'Abidjan', country: 'CI', timezone: 'Africa/Abidjan' },
    }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  };
}

/**
 * Une recherche longue peut être mise en pause par l'API (`pause_turn`). Il
 * faut alors renvoyer le message tel quel pour qu'elle reprenne. Sans cela, on
 * conclurait à tort que le modèle n'a rien trouvé.
 */
async function appelDirect({ cle, messages, reglages }) {
  const c = await client(cle);
  let msgs = messages;
  let message = null;
  for (let tour = 0; tour < 4; tour++) {
    message = await c.messages.stream(parametres(msgs, reglages)).finalMessage();
    if (message.stop_reason !== 'pause_turn') break;
    msgs = [...msgs, { role: 'assistant', content: message.content }];
  }
  const texte = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { texte, usage: message.usage, recherches: message.usage?.server_tool_use?.web_search_requests ?? null };
}

async function appelParLot({ cle, messages, reglages, journal }) {
  const c = await client(cle);
  const lot = await c.messages.batches.create({
    requests: [{ custom_id: 'ap01b-recherche', params: parametres(messages, reglages) }],
  });
  journal?.(`lot ${lot.id} soumis`);
  const echeance = Date.now() + reglages.attenteLotMs;
  let attente = reglages.sondageInitialMs;
  let etat = lot;
  while (etat.processing_status !== 'ended') {
    if (Date.now() > echeance) { const e = new Error(`le lot ${lot.id} n'a pas abouti dans le délai accordé`); e.batchId = lot.id; throw e; }
    await new Promise((ok) => setTimeout(ok, attente));
    attente = Math.min(attente * 1.5, reglages.sondageMaxMs);
    etat = await c.messages.batches.retrieve(lot.id);
  }
  for await (const r of await c.messages.batches.results(lot.id)) {
    if (r.custom_id !== 'ap01b-recherche') continue;
    if (r.result.type !== 'succeeded') { const e = new Error(`le lot ${lot.id} s'est terminé en « ${r.result.type} »`); e.batchId = lot.id; throw e; }
    const m = r.result.message;
    return {
      texte: m.content.filter((b) => b.type === 'text').map((b) => b.text).join(''),
      usage: m.usage, batchId: lot.id,
      recherches: m.usage?.server_tool_use?.web_search_requests ?? null,
    };
  }
  const e = new Error(`le lot ${lot.id} n'a rendu aucun résultat`); e.batchId = lot.id; throw e;
}

// ---------------------------------------------------------------------------
// Contrôle des trouvailles
// ---------------------------------------------------------------------------

/**
 * Une URL de recherche doit être un ARTICLE, pas une page d'accueil.
 *
 * C'est le garde-fou principal : le reproche le plus probable qu'on puisse
 * faire à ce module est de rendre « https://www.koaci.com/ » en guise de
 * trouvaille. Une adresse sans chemin, ou dont le chemin est une simple
 * rubrique, n'est pas un article.
 */
export function urlDArticle(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const chemin = u.pathname.replace(/\/+$/, '');
    if (chemin.length < 12) return false;
    // Un article a presque toujours plusieurs segments, ou un segment long
    // (le slug). Une rubrique tient en un mot court.
    const segments = chemin.split('/').filter(Boolean);
    return segments.length >= 2 || segments[0].length >= 20;
  } catch {
    return false;
  }
}

/** Trois jours, tolérance comprise : au-delà, ce n'est plus de la veille. */
function dateAcceptable(publie) {
  if (!publie || /inconnue/i.test(publie)) return true; // on ne rejette pas faute de date
  const d = new Date(publie);
  if (Number.isNaN(d.getTime())) return true;
  return Date.now() - d.getTime() < 4 * 24 * 3600 * 1000;
}

export function controlerTrouvailles(trouvailles, jeu, outils, reglages = REGLAGES) {
  const { canoniserUrl, similarite } = outils;
  const urlsConnues = new Set(jeu.candidates.map((c) => canoniserUrl(c.url)));
  const titresConnus = jeu.candidates.map((c) => c.title);

  const retenues = [];
  const ecartees = [];
  const parRegion = {};

  for (const t of trouvailles || []) {
    const url = canoniserUrl(t.url);
    const jeter = (motif) => ecartees.push({ titre: (t.titre || '').slice(0, 70), motif });

    if (!urlDArticle(url)) { jeter("l'adresse n'est pas celle d'un article"); continue; }
    if (urlsConnues.has(url)) { jeter('déjà collecté par les flux'); continue; }
    if (!dateAcceptable(t.publie)) { jeter(`publication trop ancienne (${t.publie})`); continue; }
    if (titresConnus.some((titre) => similarite(titre, t.titre) >= reglages.similariteDoublon)) {
      jeter('même sujet qu\'un article déjà collecté'); continue;
    }
    if (retenues.some((r) => similarite(r.titre, t.titre) >= reglages.similariteDoublon || canoniserUrl(r.url) === url)) {
      jeter('doublon interne aux trouvailles'); continue;
    }
    const n = (parRegion[t.region] = (parRegion[t.region] || 0) + 1);
    if (n > reglages.maxTrouvaillesParRegion) { jeter(`quota de ${reglages.maxTrouvaillesParRegion} atteint pour ${t.region}`); continue; }

    retenues.push({ ...t, url });
    urlsConnues.add(url);
  }
  return { retenues, ecartees };
}

/** Met une trouvaille à la forme d'un candidat d'AP-01. */
function enCandidat(t, index, jeu, outils) {
  const { empreinte } = outils;
  const publie = (() => {
    const d = new Date(t.publie);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  })();
  const article = { title: t.titre, published_at: publie };
  return {
    candidate_id: `A4A-WEB-${String(index + 1).padStart(4, '0')}`,
    title: t.titre,
    description: t.resume,
    url: t.url,
    source: {
      id: 'recherche-web',
      name: t.source,
      type: 'RECHERCHE_WEB',
      priority: 55,
      is_aggregator: false,
      // Une page trouvée par recherche n'a été lue par personne : elle vaut
      // comme piste, pas comme information établie.
      is_primary: false,
    },
    published_at: publie,
    published_estimated: !t.publie || /inconnue/i.test(t.publie),
    country: t.region === 'Cote_Ivoire' ? 'CI' : null,
    region: t.region,
    language: 'fr',
    collection_method: 'recherche_web',
    fingerprint: empreinte(article),
    technical_score: 55,
    also_covered_by: [],
    piste_a_verifier: true,
    apport: t.apport,
    status: 'candidate',
  };
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export async function executer(jeu, options = {}) {
  const reglages = { ...REGLAGES, ...options.reglages };
  const journal = options.journal || (() => {});
  const debut = new Date();

  // Les fonctions d'AP-01 sont réutilisées telles quelles : canoniser une URL
  // et rapprocher deux titres doivent se faire EXACTEMENT de la même façon des
  // deux côtés, sinon un doublon passe entre les mailles.
  const outils = options.outils || await import('../ap01/collecteur.mjs');

  const rendreIntact = (statut, motif, extra = {}) => ({
    ...jeu,
    recherche_web: { statut, motif, trouvailles: 0, ...extra },
  });

  if (!jeu?.candidates?.length) return rendreIntact('ignoree', "aucun jeu d'AP-01 à compléter");

  const cle = options.cle || process.env.ANTHROPIC_API_KEY;
  if (!cle) return rendreIntact('ignoree', 'clé API Anthropic absente');

  const titres = jeu.candidates.slice(0, reglages.maxTitresConnus).map((c) => `- [${c.region}] ${c.title}`).join('\n');
  const messages = [{
    role: 'user',
    content: `Date : ${jeu.collection_date}\nExécution : ${jeu.workflow_id}\n\nLa collecte par flux a déjà rapporté ces ${Math.min(jeu.candidates.length, reglages.maxTitresConnus)} titres :\n\n${titres}\n\nCherche ce qui manque.`,
  }];

  const appeler = options.appelerClaude || (reglages.mode === 'direct' ? appelDirect : appelParLot);
  let brut;
  try {
    brut = await appeler({ cle, messages, reglages, journal });
  } catch (e) {
    // La recherche est un COMPLÉMENT : son échec ne doit jamais arrêter la
    // chaîne. Le jeu d'AP-01 passe intact, et le motif est dit.
    return rendreIntact('echec', `appel au modèle en échec : ${e.message}`, e.batchId ? { batch_id: e.batchId } : {});
  }

  let reponse;
  try { reponse = JSON.parse(brut.texte); } catch {
    return rendreIntact('echec', "la réponse du modèle n'est pas du JSON exploitable");
  }

  const { retenues, ecartees } = controlerTrouvailles(reponse.trouvailles, jeu, outils, reglages);
  journal(`${(reponse.trouvailles || []).length} trouvailles, ${retenues.length} retenues, ${ecartees.length} écartées`);

  const nouveaux = retenues.map((t, i) => enCandidat(t, i, jeu, outils));
  const fin = new Date();

  // Le compte des recherches se lit dans l'usage de la réponse, et non chez
  // l'appelant : c'est l'API qui facture, c'est donc elle qui fait foi.
  const recherches = brut.recherches ?? brut.usage?.server_tool_use?.web_search_requests ?? null;

  return {
    ...jeu,
    candidates: [...jeu.candidates, ...nouveaux].sort((a, b) => b.technical_score - a.technical_score),
    recherche_web: {
      statut: 'ok',
      motif: null,
      model: MODELE,
      mode: reglages.mode,
      proposees: (reponse.trouvailles || []).length,
      trouvailles: nouveaux.length,
      ecartees,
      remarques: reponse.remarques,
      recherches_facturees: recherches,
      cout_recherches_usd: recherches != null ? Number((recherches * 0.01).toFixed(3)) : null,
      input_tokens: brut.usage?.input_tokens ?? null,
      output_tokens: brut.usage?.output_tokens ?? null,
      batch_id: brut.batchId ?? null,
      duration_seconds: Math.round((fin - debut) / 1000),
    },
    statistics: {
      ...jeu.statistics,
      candidates: jeu.candidates.length + nouveaux.length,
      candidates_recherche_web: nouveaux.length,
    },
  };
}
