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
 * Trois partis pris.
 *
 * 1. UN SEUL appel à Claude, et non un par candidat. Choisir sept sujets parmi
 *    cent cinquante suppose de les comparer entre eux : un modèle qui ne voit
 *    qu'un article à la fois ne peut ni arbitrer, ni repérer que trois d'entre
 *    eux racontent la même chose. Cent cinquante appels coûteraient cent
 *    cinquante fois plus cher pour un résultat plus faible.
 *
 * 2. SORTIE STRUCTUREE (`output_config.format`). Demander du JSON dans la
 *    consigne et espérer, c'est accepter qu'un jour la réponse arrive
 *    entourée de « Voici la sélection : » et casse l'étape suivante. Le schéma
 *    est imposé par l'API.
 *
 * 3. VALIDATION, puis UNE reprise. Le schéma garantit la forme, pas le fond :
 *    rien n'empêche un identifiant inventé ou un quota mal respecté. On
 *    vérifie, et si quelque chose cloche on renvoie l'erreur précise au modèle
 *    une fois. Au-delà, on échoue franchement plutôt que de boucler.
 */

const MODELE = 'claude-opus-5';

export const REGLAGES = {
  quotas: { Cote_Ivoire: 2, Afrique: 2, International: 3 },
  /** Longueur du résumé transmis au modèle. Au-delà, on paie sans mieux choisir. */
  longueurDescription: 320,
  maxTokens: 8000,
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

SOURCES
Un candidat marqué "agregateur": true n'est PAS une source primaire — c'est une couche de découverte. S'il révèle un bon sujet, retiens-le, mais signale dans "verification_requise" qu'il faut remonter au média d'origine avant d'écrire.

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
 * Le jeu d'AP-01 pèse 147 ko ; l'empreinte SHA-256, la méthode de collecte ou
 * l'URL canonique n'aident en rien à arbitrer entre deux sujets. Les retirer
 * réduit le coût d'environ un tiers sans rien enlever à la décision.
 */
export function preparerCandidats(candidats, reglages = REGLAGES) {
  return candidats.map((c) => ({
    id: c.candidate_id,
    titre: c.title,
    resume: (c.description || '').slice(0, reglages.longueurDescription),
    source: c.source?.name ?? 'inconnue',
    agregateur: c.source?.is_aggregator ?? false,
    region: c.region,
    publie: c.published_at,
    score: c.technical_score,
    reprises: (c.also_covered_by || []).length,
  }));
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
// Appel du modèle
// ---------------------------------------------------------------------------

/**
 * Appelle Claude. Isolé dans sa propre fonction pour que tout le reste du
 * pipeline soit éprouvable sans clé API ni appel réseau — c'est ce qui a permis
 * de tester la validation et la reprise avant même qu'une clé existe.
 */
async function appelerClaude({ cle, messages, maxTokens }) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: cle });

  // Diffusion en flux : la requête porte environ quarante mille jetons et la
  // réflexion adaptative peut prendre du temps. Sans flux, une requête longue
  // se heurte au délai maximal côté HTTP.
  const message = await client.messages.stream({
    model: MODELE,
    max_tokens: maxTokens,
    // Réflexion adaptative : le modèle règle lui-même son effort. `budget_tokens`
    // est refusé par Opus 5 — une requête qui le porte reçoit une erreur 400.
    thinking: { type: 'adaptive' },
    system: CONSIGNE,
    messages,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  }).finalMessage();

  const texte = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { texte, usage: message.usage };
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export async function executer(entree, options = {}) {
  const reglages = { ...REGLAGES, ...options.reglages };
  const appeler = options.appelerClaude || appelerClaude;
  const debut = new Date();

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

  const cle = options.cle || process.env.ANTHROPIC_API_KEY;
  if (!cle) {
    return {
      workflow_id: jeu.workflow_id,
      source: 'AP-02',
      status: 'FAILED',
      error: 'Clé API Anthropic absente. La renseigner dans les entrées de l\'étape, ou en variable ANTHROPIC_API_KEY.',
      selection: [],
    };
  }

  const compacts = preparerCandidats(jeu.candidates, reglages);
  const messages = [{
    role: 'user',
    content: `Date de collecte : ${jeu.collection_date}\nExécution : ${jeu.workflow_id}\n\nVoici les ${compacts.length} sujets candidats :\n\n${JSON.stringify(compacts, null, 1)}`,
  }];

  let reponse = null;
  let griefs = [];
  let usage = null;
  let reprise = false;

  for (let essai = 0; essai < 2; essai++) {
    let brut;
    try {
      brut = await appeler({ cle, messages, maxTokens: reglages.maxTokens });
    } catch (e) {
      return {
        workflow_id: jeu.workflow_id,
        source: 'AP-02',
        status: 'FAILED',
        error: `Appel au modèle en échec : ${e.message}`,
        selection: [],
      };
    }
    usage = brut.usage;

    try {
      reponse = JSON.parse(brut.texte);
    } catch {
      griefs = ['La réponse n\'est pas du JSON exploitable.'];
      reponse = null;
    }

    if (reponse) griefs = validerSelection(reponse, jeu.candidates, reglages);
    if (griefs.length === 0) break;

    if (essai === 0) {
      // UNE reprise, avec le reproche exact. Renvoyer « recommence » sans dire
      // ce qui cloche produit souvent la même erreur.
      reprise = true;
      messages.push({ role: 'assistant', content: brut.texte });
      messages.push({
        role: 'user',
        content: `Ta réponse n'est pas exploitable :\n\n${griefs.map((g) => `- ${g}`).join('\n')}\n\nCorrige-la en respectant strictement les identifiants de la liste soumise et la répartition demandée.`,
      });
    }
  }

  if (griefs.length > 0) {
    return {
      workflow_id: jeu.workflow_id,
      source: 'AP-02',
      status: 'FAILED',
      error: 'La sélection reste invalide après une reprise.',
      griefs,
      selection: [],
    };
  }

  // Ré-attachement du dossier complet : AP-03 a besoin de l'URL et de la source
  // pour vérifier, et le modèle n'a reçu qu'un extrait.
  const parId = new Map(jeu.candidates.map((c) => [c.candidate_id, c]));
  const selection = reponse.selection
    .sort((a, b) => a.priorite - b.priorite)
    .map((s) => {
      const c = parId.get(s.candidate_id);
      return {
        ...s,
        title: c.title,
        url: c.url,
        source: c.source,
        published_at: c.published_at,
        technical_score: c.technical_score,
        reprises_detail: (s.reprises || []).map((r) => {
          const rc = parId.get(r);
          return { candidate_id: r, title: rc?.title, source: rc?.source?.name, url: rc?.url };
        }),
      };
    });

  const fin = new Date();
  return {
    workflow_id: jeu.workflow_id,
    source: 'AP-02',
    version: '1.0.0',
    generated_at: fin.toISOString(),
    collection_date: jeu.collection_date,
    status: 'SUCCESS',
    model: MODELE,
    statistics: {
      candidates_received: jeu.candidates.length,
      selected: selection.length,
      by_region: {
        Cote_Ivoire: selection.filter((s) => s.region === 'Cote_Ivoire').length,
        Afrique: selection.filter((s) => s.region === 'Afrique').length,
        International: selection.filter((s) => s.region === 'International').length,
      },
      grouped_duplicates: selection.reduce((n, s) => n + (s.reprises?.length || 0), 0),
      repaired: reprise,
      input_tokens: usage?.input_tokens ?? null,
      output_tokens: usage?.output_tokens ?? null,
      duration_seconds: Math.round((fin - debut) / 1000),
    },
    reserves: reponse.reserves,
    selection,
  };
}
