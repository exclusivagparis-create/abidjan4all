/**
 * AP-02 — Sélection éditoriale
 *
 * Reçoit le jeu de candidats d'AP-01, le soumet à Claude, et rend la sélection
 * du jour : 2 sujets Côte d'Ivoire, 2 Afrique, 3 International.
 *
 * Ce que fait AP-02, et ce qu'il ne fait pas.
 *
 * Il SELECTIONNE et rapproche sémantiquement — AP-01 ne rapprochait que des
 * mots, lui comprend que « Ouattara reçoit… » et « le chef de l'État ivoirien
 * s'entretient… » sont le même événement. Il ne VERIFIE pas : c'est AP-03. Il
 * n'ECRIT pas : c'est AP-04. Et il ne publie rien, jamais.
 *
 * DEUX MODES ET UN REPLI
 *
 * - `lot` (par défaut) : passe par l'API des lots, moitié prix. La sélection
 *   quotidienne n'a aucune urgence de latence — attendre quelques minutes ne
 *   change rien à un journal qui paraît dans la journée —, et cette patience
 *   vaut 50 % de remise.
 * - `direct` : un appel synchrone, réponse en une à deux minutes, plein tarif.
 *   Pour mettre au point, ou le jour où il faut un résultat tout de suite.
 * - `repli` : quand le modèle est hors d'atteinte — clé absente, API en panne,
 *   crédit épuisé, lot trop lent —, la sélection se fait sur le score technique
 *   d'AP-01. La chaîne continue au lieu de s'arrêter, et la sortie DIT qu'elle
 *   est dégradée. C'est le point important : une sélection de repli qui se
 *   ferait passer pour une sélection relue serait pire que pas de sélection.
 *
 * Trois partis pris.
 *
 * 1. UN SEUL appel à Claude, et non un par candidat. Choisir sept sujets parmi
 *    cent cinquante suppose de les comparer entre eux : un modèle qui ne voit
 *    qu'un article à la fois ne peut ni arbitrer, ni repérer que trois d'entre
 *    eux racontent la même chose.
 *
 * 2. SORTIE STRUCTUREE (`output_config.format`). Demander du JSON dans la
 *    consigne et espérer, c'est accepter qu'un jour la réponse arrive entourée
 *    de « Voici la sélection : » et casse l'étape suivante.
 *
 * 3. VALIDATION, puis UNE reprise. Le schéma garantit la forme, pas le fond :
 *    rien n'empêche un identifiant inventé ou un quota mal respecté.
 */

const MODELE = 'claude-opus-5';

export const REGLAGES = {
  quotas: { Cote_Ivoire: 2, Afrique: 2, International: 3 },
  /** Longueur du résumé transmis au modèle. Au-delà, on paie sans mieux choisir. */
  longueurDescription: 320,
  maxTokens: 8000,
  /** `lot` (moitié prix, asynchrone) ou `direct` (plein tarif, immédiat). */
  mode: 'lot',
  /**
   * Patience accordée à un lot. La documentation annonce la plupart des lots
   * sous une heure ; au-delà de cette attente on bascule sur le repli, en
   * gardant l'identifiant du lot pour ne rien perdre.
   *
   * ATTENTION : le flow Activepieces doit pouvoir durer aussi longtemps.
   * `AP_FLOW_TIMEOUT_SECONDS` vaut 600 par défaut — il faut le porter à 3600
   * pour ce mode, sinon Activepieces coupe le flow avant la fin de l'attente.
   */
  attenteLotMs: 45 * 60 * 1000,
  sondageInitialMs: 10000,
  sondageMaxMs: 60000,
  /** Repli sur le score technique quand le modèle est hors d'atteinte. */
  repliAutorise: true,
};

// ---------------------------------------------------------------------------
// Consigne éditoriale
// ---------------------------------------------------------------------------

const CONSIGNE = `Tu es le rédacteur en chef adjoint d'Abidjan4All, média numérique ivoirien qui s'adresse à la Côte d'Ivoire et à sa diaspora (France, Canada, États-Unis, Italie, Allemagne, Belgique, Royaume-Uni).

On te soumet les sujets d'actualité collectés aujourd'hui. Tu en retiens SEPT pour la rédaction du jour, et tu expliques pourquoi.

RÉPARTITION IMPOSÉE
- 2 sujets Côte d'Ivoire
- 2 sujets Afrique
- 3 sujets International

CE QUI FAIT UN BON SUJET POUR CE LECTORAT
- Il concerne directement les Ivoiriens, ou éclaire ce qui les concerne.
- Un sujet international n'est retenu que s'il a une portée pour l'Afrique de l'Ouest ou pour la diaspora : accords commerciaux, visas et migrations, matières premières (cacao, café, or, pétrole), diplomatie, santé publique, économie mondiale qui touche le franc CFA.
- La diaspora est un lectorat à part entière : ce qui touche les Ivoiriens de l'étranger vaut d'être traité.

CE QUE TU ÉCARTES
- Les résultats sportifs bruts sans enjeu, les faits divers sans portée collective, les reprises d'un communiqué sans information nouvelle.
- Les sujets déjà largement traités la veille, sauf rebondissement.

REGROUPEMENT
Plusieurs candidats peuvent raconter le MÊME événement sous des titres différents. Regroupe-les : retiens l'identifiant de la meilleure source comme sujet, et cite les autres identifiants comme reprises. La priorité technique t'aide, mais c'est le contenu qui tranche.

SOURCES : PRIMAIRES ET NON PRIMAIRES
Un candidat marqué "primaire": false n'est PAS une source de premier rang. Cela couvre les agrégateurs (Google News), les blogs et magazines d'analyse, les chaînes vidéo et les réseaux sociaux. Ils font DÉCOUVRIR un sujet ; le fait, lui, doit venir d'ailleurs.

Tu peux retenir un tel sujet s'il est bon — mais alors tu inscris obligatoirement dans "verification_requise" qu'il faut remonter à une source primaire avant d'écrire, et laquelle chercher.

Ne bâtis JAMAIS les sept sujets sur des sources non primaires. S'il n'y a que cela pour une région, dis-le dans "reserves".

PISTES À VÉRIFIER
Un candidat marqué "piste": true vient de la réserve de découverte : c'est un signalement, pas une information. Les fils de réseaux sociaux en particulier relaient ce qui CIRCULE — y compris des rumeurs, parfois graves ("prétendue arrestation de…", "prétendu projet d'assassinat de…").

Une rumeur qui circule largement peut mériter un article — mais un article qui la VÉRIFIE ou la DÉMENT, jamais un article qui la reprend. Si tu retiens une piste de ce genre, dis-le explicitement dans l'angle : le travail demandé à la rédaction est une vérification, pas un compte rendu.

VÉRIFICATION
Pour chaque sujet, indique ce qui devra être vérifié avant publication : chiffres, citations, dates, attributions. Sois précis. AP-03 s'en servira comme feuille de route. Si tu ne vois rien à vérifier, dis-le franchement plutôt que d'inventer une exigence.

HONNÊTETÉ
Si une région n'offre aucun sujet qui mérite le quota, dis-le dans "reserves" et retiens quand même les moins mauvais — mais ne présente pas un sujet faible comme fort.`;

// ---------------------------------------------------------------------------
// Schéma de sortie
// ---------------------------------------------------------------------------

const SCHEMA = {
  type: 'object',
  properties: {
    selection: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          candidate_id: { type: 'string', description: "Identifiant du candidat retenu, tel qu'il figure dans la liste." },
          region: { type: 'string', enum: ['Cote_Ivoire', 'Afrique', 'International'] },
          angle: { type: 'string', description: "L'angle proposé à la rédaction, en une phrase." },
          justification: { type: 'string', description: 'Pourquoi ce sujet mérite la une du jour pour ce lectorat.' },
          interet_diaspora: { type: 'string', description: "En quoi ce sujet parle aux Ivoiriens de l'étranger, ou « aucun » si ce n'est pas le cas." },
          reprises: { type: 'array', items: { type: 'string' }, description: 'Identifiants des autres candidats qui racontent le même événement.' },
          verification_requise: { type: 'array', items: { type: 'string' }, description: 'Points précis à vérifier avant écriture.' },
          priorite: { type: 'integer', description: 'Rang de 1 (à traiter en premier) à 7.' },
        },
        required: ['candidate_id', 'region', 'angle', 'justification', 'interet_diaspora', 'reprises', 'verification_requise', 'priorite'],
        additionalProperties: false,
      },
    },
    reserves: { type: 'string', description: "Ce qui manquait, ce qui a été retenu faute de mieux, ou « aucune »." },
  },
  required: ['selection', 'reserves'],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Préparation du chargement
// ---------------------------------------------------------------------------

/**
 * Ne transmet que ce qui sert à choisir.
 *
 * Le jeu d'AP-01 pèse 146 ko ; l'empreinte SHA-256, la méthode de collecte ou
 * l'URL canonique n'aident en rien à arbitrer entre deux sujets. Les retirer
 * réduit le chargement de moitié sans rien enlever à la décision.
 */
export function preparerCandidats(candidats, reglages = REGLAGES) {
  return candidats.map((c) => ({
    id: c.candidate_id,
    titre: c.title,
    resume: (c.description || '').slice(0, reglages.longueurDescription),
    source: c.source?.name ?? 'inconnue',
    agregateur: c.source?.is_aggregator ?? false,
    primaire: c.source?.is_primary !== false,
    piste: c.piste_a_verifier === true,
    region: c.region,
    publie: c.published_at,
    score: c.technical_score,
    reprises: (c.also_covered_by || []).length,
  }));
}

function construireMessages(jeu, compacts) {
  return [{
    role: 'user',
    content: `Date de collecte : ${jeu.collection_date}\nExécution : ${jeu.workflow_id}\n\nVoici les ${compacts.length} sujets candidats :\n\n${JSON.stringify(compacts, null, 1)}`,
  }];
}

function parametresModele(messages, maxTokens) {
  return {
    model: MODELE,
    max_tokens: maxTokens,
    // Réflexion adaptative : le modèle règle lui-même son effort. `budget_tokens`
    // est refusé par Opus 5 — une requête qui le porte reçoit une erreur 400.
    thinking: { type: 'adaptive' },
    system: CONSIGNE,
    messages,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  };
}

// ---------------------------------------------------------------------------
// Validation de la réponse
// ---------------------------------------------------------------------------

/**
 * Ce que le schéma ne peut pas garantir.
 *
 * Une sortie structurée impose la FORME : sept objets avec les bons champs.
 * Elle n'empêche ni un identifiant qui n'existe pas dans la liste soumise, ni
 * une répartition qui ne respecte pas les quotas, ni un même sujet retenu deux
 * fois. Ce sont précisément les erreurs qui casseraient AP-03 en silence.
 */
export function validerSelection(reponse, candidats, reglages = REGLAGES) {
  const griefs = [];
  const connus = new Set(candidats.map((c) => c.candidate_id));
  const selection = reponse?.selection;

  if (!Array.isArray(selection)) return ['La réponse ne contient pas de tableau "selection".'];

  const attendus = Object.values(reglages.quotas).reduce((a, b) => a + b, 0);
  if (selection.length !== attendus) {
    griefs.push(`${selection.length} sujets retenus au lieu de ${attendus}.`);
  }

  const vus = new Set();
  for (const s of selection) {
    if (!connus.has(s.candidate_id)) {
      griefs.push(`L'identifiant ${s.candidate_id} ne figure pas dans la liste soumise.`);
    }
    if (vus.has(s.candidate_id)) {
      griefs.push(`L'identifiant ${s.candidate_id} est retenu deux fois.`);
    }
    vus.add(s.candidate_id);
    for (const r of s.reprises || []) {
      if (!connus.has(r)) griefs.push(`La reprise ${r} de ${s.candidate_id} ne figure pas dans la liste soumise.`);
    }
  }

  for (const [region, quota] of Object.entries(reglages.quotas)) {
    const n = selection.filter((s) => s.region === region).length;
    if (n !== quota) griefs.push(`${n} sujets ${region} au lieu de ${quota}.`);
    // La région annoncée doit être celle du candidat : sans ce contrôle, le
    // modèle peut satisfaire le quota en reclassant un sujet à sa convenance.
    for (const s of selection.filter((x) => x.region === region)) {
      const c = candidats.find((x) => x.candidate_id === s.candidate_id);
      if (c && c.region !== region) {
        griefs.push(`${s.candidate_id} est annoncé ${region} alors qu'AP-01 l'a classé ${c.region}.`);
      }
    }
  }

  return griefs;
}

// ---------------------------------------------------------------------------
// Repli : sélection sans modèle
// ---------------------------------------------------------------------------

/**
 * Sélection de secours, sur le seul score technique d'AP-01.
 *
 * Ce n'est PAS une sélection éditoriale, et la sortie le dit : ni angle, ni
 * justification, ni rapprochement sémantique, ni feuille de route de
 * vérification. Un score technique mesure la qualité de la SOURCE et la
 * fraîcheur, pas l'intérêt du sujet pour un lecteur ivoirien.
 *
 * Son seul mérite est de ne pas arrêter la chaîne. Le champ `verification_requise`
 * porte donc un avertissement explicite plutôt qu'une liste inventée : AP-03 et
 * la rédaction doivent savoir que rien n'a été relu.
 */
export function selectionParScore(candidats, reglages = REGLAGES) {
  const retenus = [];
  for (const [region, quota] of Object.entries(reglages.quotas)) {
    retenus.push(
      ...candidats
        .filter((c) => c.region === region)
        .sort((a, b) => b.technical_score - a.technical_score)
        .slice(0, quota),
    );
  }
  return retenus
    .sort((a, b) => b.technical_score - a.technical_score)
    .map((c, i) => ({
      candidate_id: c.candidate_id,
      region: c.region,
      priorite: i + 1,
      angle: null,
      justification: null,
      interet_diaspora: null,
      reprises: (c.also_covered_by || []).map((x) => x.candidate_id).filter(Boolean),
      verification_requise: [
        'Sélection de repli : aucun modèle ne l\'a relue. Vérifier le sujet dans son ensemble avant d\'écrire, y compris sa pertinence éditoriale.',
      ],
    }));
}

// ---------------------------------------------------------------------------
// Appels du modèle
// ---------------------------------------------------------------------------

async function client(cle) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return new Anthropic({ apiKey: cle });
}

/** Appel synchrone, plein tarif. */
async function appelDirect({ cle, messages, maxTokens }) {
  const c = await client(cle);
  // Diffusion en flux : la requête porte environ vingt mille jetons et la
  // réflexion adaptative peut prendre du temps. Sans flux, une requête longue
  // se heurte au délai maximal côté HTTP.
  const message = await c.messages.stream(parametresModele(messages, maxTokens)).finalMessage();
  const texte = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { texte, usage: message.usage };
}

/**
 * Appel par lot, moitié prix.
 *
 * Un lot d'UNE requête peut sembler absurde — c'est pourtant exactement ce que
 * la remise récompense : on renonce à l'immédiateté, pas au volume. La
 * documentation annonce la plupart des lots terminés en moins d'une heure,
 * l'expiration à vingt-quatre heures.
 *
 * Le sondage s'espace progressivement (10 s, puis jusqu'à 60 s) : interroger
 * toutes les dix secondes pendant trois quarts d'heure ferait deux cent
 * soixante-dix requêtes pour rien.
 */
async function appelParLot({ cle, messages, maxTokens, reglages, journal }) {
  const c = await client(cle);
  const lot = await c.messages.batches.create({
    requests: [{ custom_id: 'ap02-selection', params: parametresModele(messages, maxTokens) }],
  });
  journal?.(`lot ${lot.id} soumis`);

  const echeance = Date.now() + reglages.attenteLotMs;
  let attente = reglages.sondageInitialMs;
  let etat = lot;

  while (etat.processing_status !== 'ended') {
    if (Date.now() > echeance) {
      const e = new Error(`le lot ${lot.id} n'a pas abouti dans le délai accordé (${Math.round(reglages.attenteLotMs / 60000)} min)`);
      e.batchId = lot.id;
      e.lotEnCours = true;
      throw e;
    }
    await new Promise((ok) => setTimeout(ok, attente));
    attente = Math.min(attente * 1.5, reglages.sondageMaxMs);
    etat = await c.messages.batches.retrieve(lot.id);
  }

  for await (const r of await c.messages.batches.results(lot.id)) {
    if (r.custom_id !== 'ap02-selection') continue;
    if (r.result.type !== 'succeeded') {
      const e = new Error(`le lot ${lot.id} s'est terminé en « ${r.result.type} »`);
      e.batchId = lot.id;
      throw e;
    }
    const message = r.result.message;
    const texte = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return { texte, usage: message.usage, batchId: lot.id };
  }

  const e = new Error(`le lot ${lot.id} n'a rendu aucun résultat`);
  e.batchId = lot.id;
  throw e;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/** Sortie commune aux deux chemins, pour que AP-03 n'ait qu'une forme à lire. */
function assembler({ jeu, selection, reponse, reglages, mode, degrade, motif, extra, debut }) {
  const parId = new Map(jeu.candidates.map((c) => [c.candidate_id, c]));
  const enrichie = selection
    .sort((a, b) => a.priorite - b.priorite)
    .map((s) => {
      const c = parId.get(s.candidate_id);
      return {
        ...s,
        title: c?.title,
        url: c?.url,
        source: c?.source,
        published_at: c?.published_at,
        technical_score: c?.technical_score,
        // Les reprises du modèle d'abord ; à défaut, celles qu'AP-01 avait
        // rapprochées par recouvrement de titres.
        //
        // Ce repli n'est pas cosmétique : AP-03 ne peut RECOUPER que s'il a
        // plusieurs sources sur un même événement. Sans lui, une sélection de
        // repli ne portait aucune reprise — `also_covered_by` d'AP-01 ne
        // contient que `{source, url}`, jamais d'identifiant de candidat — et
        // AP-03 se retrouvait avec une source unique par sujet, donc rien à
        // comparer. L'origine est notée : un rapprochement par mots-clés n'a
        // pas la valeur d'un rapprochement compris.
        reprises_detail: (() => {
          const duModele = (s.reprises || []).map((r) => {
            const rc = parId.get(r);
            return { candidate_id: r, title: rc?.title, source: rc?.source?.name, url: rc?.url, origine: 'modele' };
          });
          if (duModele.length > 0) return duModele;
          return (c?.also_covered_by || []).map((r) => ({
            candidate_id: null, title: null, source: r.source, url: r.url, origine: 'ap01',
          }));
        })(),
      };
    });

  const fin = new Date();
  return {
    workflow_id: jeu.workflow_id,
    source: 'AP-02',
    version: '2.0.0',
    generated_at: fin.toISOString(),
    collection_date: jeu.collection_date,
    status: degrade ? 'DEGRADED' : 'SUCCESS',
    mode,
    // Sur une sortie dégradée, ces deux champs sont ce qu'AP-03 et la rédaction
    // doivent voir en premier : la sélection n'a pas été relue.
    relue_par_un_modele: !degrade,
    motif_repli: motif ?? null,
    model: degrade ? null : MODELE,
    statistics: {
      candidates_received: jeu.candidates.length,
      selected: enrichie.length,
      by_region: {
        Cote_Ivoire: enrichie.filter((s) => s.region === 'Cote_Ivoire').length,
        Afrique: enrichie.filter((s) => s.region === 'Afrique').length,
        International: enrichie.filter((s) => s.region === 'International').length,
      },
      grouped_duplicates: enrichie.reduce((n, s) => n + (s.reprises?.length || 0), 0),
      duration_seconds: Math.round((fin - debut) / 1000),
      ...extra,
    },
    reserves: reponse?.reserves ?? null,
    selection: enrichie,
  };
}

export async function executer(entree, options = {}) {
  const reglages = { ...REGLAGES, ...options.reglages };
  const debut = new Date();
  const journal = options.journal || (() => {});

  const jeu = entree?.candidates ? entree : entree?.body;
  if (!jeu?.candidates?.length) {
    return {
      workflow_id: entree?.workflow_id ?? null,
      source: 'AP-02',
      status: 'FAILED',
      error: "Aucun candidat reçu d'AP-01.",
      selection: [],
    };
  }

  const replier = (motif, extra = {}) => {
    if (!reglages.repliAutorise) {
      return {
        workflow_id: jeu.workflow_id, source: 'AP-02', status: 'FAILED',
        error: motif, selection: [],
      };
    }
    journal(`repli : ${motif}`);
    return assembler({
      jeu, selection: selectionParScore(jeu.candidates, reglages), reponse: null,
      reglages, mode: 'repli', degrade: true, motif, extra, debut,
    });
  };

  const cle = options.cle || process.env.ANTHROPIC_API_KEY;
  if (!cle) return replier("Clé API Anthropic absente. La renseigner dans les entrées de l'étape, ou en variable ANTHROPIC_API_KEY.");

  const compacts = preparerCandidats(jeu.candidates, reglages);
  const messages = construireMessages(jeu, compacts);
  const mode = reglages.mode === 'direct' ? 'direct' : 'lot';
  const appeler = options.appelerClaude || (mode === 'lot' ? appelParLot : appelDirect);

  let reponse = null;
  let griefs = [];
  let usage = null;
  let batchId = null;
  let reprise = false;

  for (let essai = 0; essai < 2; essai++) {
    let brut;
    try {
      brut = await appeler({ cle, messages, maxTokens: reglages.maxTokens, reglages, journal });
    } catch (e) {
      return replier(`Appel au modèle en échec : ${e.message}`, e.batchId ? { batch_id: e.batchId } : {});
    }
    usage = brut.usage;
    batchId = brut.batchId ?? batchId;

    try {
      reponse = JSON.parse(brut.texte);
    } catch {
      griefs = ["La réponse n'est pas du JSON exploitable."];
      reponse = null;
    }

    if (reponse) griefs = validerSelection(reponse, jeu.candidates, reglages);
    if (griefs.length === 0) break;

    if (essai === 0) {
      // UNE reprise, avec le reproche exact. Renvoyer « recommence » sans dire
      // ce qui cloche produit souvent la même erreur.
      reprise = true;
      journal(`reprise demandée : ${griefs.join(' ')}`);
      messages.push({ role: 'assistant', content: brut.texte });
      messages.push({
        role: 'user',
        content: `Ta réponse n'est pas exploitable :\n\n${griefs.map((g) => `- ${g}`).join('\n')}\n\nCorrige-la en respectant strictement les identifiants de la liste soumise et la répartition demandée.`,
      });
    }
  }

  if (griefs.length > 0) {
    return replier(`La sélection du modèle reste invalide après une reprise : ${griefs[0]}`, { griefs, batch_id: batchId });
  }

  return assembler({
    jeu, selection: reponse.selection, reponse, reglages, mode, degrade: false, debut,
    extra: {
      repaired: reprise,
      batch_id: batchId,
      input_tokens: usage?.input_tokens ?? null,
      output_tokens: usage?.output_tokens ?? null,
    },
  });
}
