/**
 * AP-04 — Rédaction · étape « Code » d'Activepieces
 *
 * Fichier ENGENDRE depuis redacteur.mjs — ne pas modifier ici.
 *
 * DEPENDANCE, dans le champ packageJson :
 *   {"dependencies":{"@anthropic-ai/sdk":"0.124.0"}}
 *
 * ENTREES :
 *   - `dossiers`   : la sortie d'AP-03 ({{trigger.body}} ou {{step_1}})
 *   - `apiKey`     : la clé Anthropic (secret Activepieces)
 *   - `jeton`      : le jeton d'API du site (secret Activepieces) — nécessaire
 *                    seulement quand la simulation est désactivée
 *   - `reglages`   : {"simulation": false} pour déposer réellement
 *
 * PAR DEFAUT, RIEN N'EST DEPOSE. La simulation rend ce qui aurait été écrit.
 * Désactiver la simulation demande un geste délibéré — c'est voulu pour une
 * étape qui écrit dans la base d'un journal.
 */

/**
 * AP-04 — Rédaction
 *
 * Reçoit les dossiers de vérification d'AP-03 et écrit les brouillons, puis les
 * dépose dans le Studio par l'API du site.
 *
 * TROIS GARDE-FOUS, DANS CET ORDRE D'IMPORTANCE
 *
 * 1. IL N'ÉCRIT PAS CE QUI N'EST PAS VÉRIFIÉ. Un dossier dont AP-03 a dit
 *    « fragile » ou « non_verifie » n'est pas rédigé — il ressort en note pour
 *    la rédaction, avec le motif. C'est le contraire du réflexe naturel d'un
 *    modèle, qui écrira volontiers un article sur trois lignes de résumé RSS.
 *
 * 2. IL NE CITE QUE CE QUI EXISTE. Chaque citation de l'article doit se
 *    retrouver dans les citations relevées par AP-03. La vérification est
 *    mécanique, pas déclarative : une citation inventée est refusée, l'article
 *    repart en correction, et à la seconde tentative il est écarté.
 *
 * 3. IL NE PUBLIE JAMAIS. Trois barrières indépendantes : le mode simulation
 *    par défaut, la route de l'API qui force `status: "draft"` quel que soit
 *    l'appelant, et le jeton lui-même, adossé à un compte « journaliste » qui
 *    n'a pas le droit de publier. Une seule aurait suffi ; trois signifient
 *    qu'aucune erreur de configuration ne suffit à mettre en ligne.
 *
 * SANS MODÈLE, IL N'ÉCRIT PAS
 *
 * Contrairement à AP-02 et AP-03, il n'y a pas de repli utile ici. Une
 * sélection peut se faire au score, une vérification peut se réduire à un
 * inventaire de sources — un article, non. Sans clé, AP-04 rend la liste de ce
 * qu'il aurait écrit, et rien de plus.
 */

const MODELE = 'claude-opus-5';

const REGLAGES = {
  mode: 'lot',
  maxTokens: 16000,
  attenteLotMs: 45 * 60 * 1000,
  sondageInitialMs: 10000,
  sondageMaxMs: 60000,
  /**
   * Par défaut, AP-04 N'ÉCRIT RIEN dans le Studio : il rend ce qu'il aurait
   * déposé. Passer à false demande un geste délibéré — c'est voulu pour une
   * étape qui écrit dans la base d'un journal.
   */
  simulation: true,
  siteUrl: 'https://abidjan4all.info',
  /** Verdicts d'AP-03 qui autorisent la rédaction. */
  verdictsRedigeables: ['solide', 'a_completer'],
  delaiApiMs: 20000,
};

// ---------------------------------------------------------------------------
// Consigne d'écriture
// ---------------------------------------------------------------------------

const CONSIGNE = `Tu écris pour Abidjan4All, média numérique ivoirien qui s'adresse à la Côte d'Ivoire et à sa diaspora. Tes textes seront relus par un rédacteur en chef avant publication : écris comme un journaliste qui rend sa copie, pas comme une machine qui remplit un gabarit.

CE QUE TU AS LE DROIT D'ÉCRIRE
Uniquement ce que le dossier de vérification établit. Les faits établis, les citations relevées, les constats des points vérifiés. Rien d'autre.

Tu n'ajoutes AUCUN fait venu de tes connaissances — ni une date, ni un chiffre, ni un contexte historique, ni le titre d'une fonction. Si le dossier ne le dit pas, cela n'existe pas pour toi. C'est la règle absolue : un article de presse qui contient une information que personne n'a vérifiée engage la responsabilité du journal.

Tu ne cites que les citations du dossier, mot pour mot, avec leur auteur.

CE QUE TU FAIS DES POINTS INCERTAINS
Le dossier donne un verdict par point.
- "concordant" : tu peux l'écrire comme un fait.
- "source_unique" : tu l'attribues explicitement ("selon RFI", "d'après l'AIP"). Jamais comme un fait établi.
- "divergent" : tu rapportes le désaccord. C'est souvent le passage le plus intéressant de l'article.
- "inverifiable" : tu ne l'écris pas du tout.

COMMENT TU ÉCRIS
Un article de presse ivoirien, pas une dissertation.

- Attaque par le fait, pas par une mise en contexte. La première phrase dit ce qui s'est passé.
- Varie la longueur des phrases. Une suite de phrases de quinze mots sonne mécanique. Alterne le court et le sinueux.
- Écris au concret : des noms, des lieux, des chiffres, des dates. Pas de vocabulaire abstrait passe-partout.
- N'empile pas les adjectifs par trois. Ne construis pas tes idées en paires symétriques.
- Bannis la tournure « ce n'est pas X, c'est Y » et ses variantes. Bannis les incises entre tirets cadratins à répétition : une virgule, une parenthèse ou une phrase de plus font le travail.
- Pas de conclusion récapitulative. Un article de 400 mots n'a pas besoin qu'on lui résume ce qu'il vient de dire. Termine sur une information, une question ouverte, ou ce qui reste à venir.
- Évite ces mots et leurs cousins, qui trahissent une plume automatique : crucial, déterminant, paysage (au figuré), tisser, souligner (au sens de « mettre en lumière »), s'inscrire dans, il convient de noter, il est important de souligner, cela met en lumière.
- Pas de gras dans le corps, pas de liste à puces si un paragraphe raconte mieux.

STRUCTURE
- Un surtitre court (deux ou trois mots : Enquête, Diplomatie, Cacao…).
- Un titre qui dit le fait, pas un titre-devinette.
- Un chapô de deux phrases.
- Le corps en blocs. Un intertitre toutes les trois ou quatre paragraphes, pas davantage. Une citation en exergue quand le dossier en fournit une qui le mérite.

CE QUE TU SIGNALES AU RÉDACTEUR EN CHEF
Dans "reserves_editoriales", tu dis franchement ce qui manque : ce que tu n'as pas pu écrire faute de vérification, les points que le journaliste devrait aller confirmer, ce qui rendrait l'article meilleur. Ne fais pas semblant que le dossier était complet s'il ne l'était pas.

Si un dossier ne permet pas d'écrire un article honnête, dis-le dans "reserves_editoriales" et écris quand même le peu qui tient — un article court et sûr vaut mieux qu'un article étoffé et hasardeux.`;

const SCHEMA = {
  type: 'object',
  properties: {
    articles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          candidate_id: { type: 'string' },
          rubrique: { type: 'string', description: 'Slug de rubrique, pris dans la liste fournie.' },
          kicker: { type: 'string', description: 'Surtitre, deux ou trois mots.' },
          title: { type: 'string' },
          dek: { type: 'string', description: 'Chapô, deux phrases.' },
          blocs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['paragraph', 'h2', 'quote'] },
                text: { type: 'string' },
                cite: { type: 'string', description: "Auteur de la citation, pour le type 'quote'." },
              },
              required: ['type', 'text'],
              additionalProperties: false,
            },
          },
          tags: { type: 'array', items: { type: 'string' } },
          reserves_editoriales: { type: 'string', description: 'Ce qui manque, pour le rédacteur en chef.' },
        },
        required: ['candidate_id', 'rubrique', 'kicker', 'title', 'dek', 'blocs', 'tags', 'reserves_editoriales'],
        additionalProperties: false,
      },
    },
  },
  required: ['articles'],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Rubriques du site
// ---------------------------------------------------------------------------

/**
 * Lit les rubriques du site plutôt que de les figer dans le code : une
 * rubrique créée dans le Studio doit devenir disponible sans redéployer
 * l'étape. C'est ainsi que « Santé » est apparue.
 */
async function lireRubriques(reglages = REGLAGES, fetcher = fetch) {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), reglages.delaiApiMs);
  try {
    const r = await fetcher(`${reglages.siteUrl}/api/v1/rubriques`, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const l = await r.json();
    return l.map((x) => ({ id: x.id, slug: x.slug, name: x.name }));
  } finally {
    clearTimeout(minuteur);
  }
}

// ---------------------------------------------------------------------------
// Contrôle des articles
// ---------------------------------------------------------------------------

/** Comparaison indulgente sur la forme, stricte sur le fond. */
function reduire(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[«»""'']/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function fabriquerSlug(titre) {
  return reduire(titre).split(' ').filter(Boolean).slice(0, 12).join('-').slice(0, 80);
}

/**
 * Ce que le schéma ne peut pas garantir.
 *
 * Le plus grave serait une CITATION INVENTÉE : un modèle qui prête à un
 * ministre une phrase qu'il n'a pas dite. Le contrôle est mécanique — chaque
 * citation de l'article doit se retrouver dans celles qu'AP-03 a relevées dans
 * les textes réellement lus. Une paraphrase suffisamment proche passe, une
 * invention ne passe pas.
 */
function controlerArticles(reponse, dossiers, rubriques) {
  const griefs = [];
  const parId = new Map(dossiers.map((d) => [d.candidate_id, d]));
  const slugs = new Set(rubriques.map((r) => r.slug));
  const articles = reponse?.articles;
  if (!Array.isArray(articles)) return ['La réponse ne contient pas de tableau "articles".'];

  const vus = new Set();
  for (const a of articles) {
    const d = parId.get(a.candidate_id);
    if (!d) { griefs.push(`L'article ${a.candidate_id} ne correspond à aucun dossier soumis.`); continue; }
    if (vus.has(a.candidate_id)) griefs.push(`Deux articles pour ${a.candidate_id}.`);
    vus.add(a.candidate_id);

    if (!slugs.has(a.rubrique)) griefs.push(`${a.candidate_id} : la rubrique « ${a.rubrique} » n'existe pas sur le site.`);
    if (!a.title || a.title.length < 12) griefs.push(`${a.candidate_id} : titre absent ou trop court.`);
    const corps = (a.blocs || []).filter((b) => b.type === 'paragraph');
    if (corps.length < 2) griefs.push(`${a.candidate_id} : moins de deux paragraphes.`);

    // Les citations, une par une, contre celles du dossier.
    const permises = (d.citations || []).map((c) => reduire(c.texte));
    for (const b of (a.blocs || []).filter((x) => x.type === 'quote')) {
      const q = reduire(b.text);
      if (q.length < 12) continue;
      const trouvee = permises.some((p) => p.includes(q) || q.includes(p));
      if (!trouvee) {
        griefs.push(`${a.candidate_id} : la citation « ${String(b.text).slice(0, 60)}… » ne figure pas dans les citations relevées par AP-03.`);
      }
    }
  }
  return griefs;
}

// ---------------------------------------------------------------------------
// Appels du modèle
// ---------------------------------------------------------------------------

async function client(cle) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return new Anthropic({ apiKey: cle });
}

const parametres = (messages, reglages) => ({
  model: MODELE,
  max_tokens: reglages.maxTokens,
  thinking: { type: 'adaptive' },
  system: CONSIGNE,
  messages,
  output_config: { format: { type: 'json_schema', schema: SCHEMA } },
});

async function appelDirect({ cle, messages, reglages }) {
  const c = await client(cle);
  const m = await c.messages.stream(parametres(messages, reglages)).finalMessage();
  return { texte: m.content.filter((b) => b.type === 'text').map((b) => b.text).join(''), usage: m.usage };
}

async function appelParLot({ cle, messages, reglages, journal }) {
  const c = await client(cle);
  const lot = await c.messages.batches.create({
    requests: [{ custom_id: 'ap04-redaction', params: parametres(messages, reglages) }],
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
    if (r.custom_id !== 'ap04-redaction') continue;
    if (r.result.type !== 'succeeded') { const e = new Error(`le lot ${lot.id} s'est terminé en « ${r.result.type} »`); e.batchId = lot.id; throw e; }
    const m = r.result.message;
    return { texte: m.content.filter((b) => b.type === 'text').map((b) => b.text).join(''), usage: m.usage, batchId: lot.id };
  }
  const e = new Error(`le lot ${lot.id} n'a rendu aucun résultat`); e.batchId = lot.id; throw e;
}

// ---------------------------------------------------------------------------
// Dépôt dans le Studio
// ---------------------------------------------------------------------------

/**
 * Met l'article à la forme des blocs du site et le dépose en brouillon.
 *
 * La note de rédaction est ajoutée EN TÊTE du corps, dans un bloc `note` — le
 * rendu du site l'affiche en vert avec « ✅ Vérification ». Le rédacteur en
 * chef voit donc les réserves avant le texte, sans avoir à ouvrir un autre
 * outil. Elle est à retirer avant publication, et le dit.
 */
function enBlocsDuSite(article, dossier) {
  const note = [
    "Brouillon produit automatiquement (AP-04). À relire et à retirer avant publication.",
    article.reserves_editoriales ? `Réserves : ${article.reserves_editoriales}` : null,
    dossier.verdict_global ? `Vérification AP-03 : ${dossier.verdict_global} — ${dossier.motif_verdict}` : null,
    (dossier.a_obtenir || []).length ? `À obtenir : ${dossier.a_obtenir.join(' · ')}` : null,
    dossier.url ? `Source retenue : ${dossier.url}` : null,
  ].filter(Boolean).join('\n');

  return [
    { type: 'note', text: note },
    ...(article.blocs || []).map((b) =>
      b.type === 'quote' ? { type: 'quote', text: b.text, cite: b.cite ?? null } : { type: b.type, text: b.text }),
  ];
}

async function deposer(article, dossier, rubriques, reglages, jeton, fetcher) {
  const rubrique = rubriques.find((r) => r.slug === article.rubrique);
  const mots = (article.blocs || []).reduce((n, b) => n + String(b.text || '').split(/\s+/).length, 0);
  const corps = {
    slug: `${fabriquerSlug(article.title)}-${Date.now().toString(36).slice(-4)}`,
    title: article.title,
    kicker: article.kicker,
    dek: article.dek,
    body: enBlocsDuSite(article, dossier),
    rubriqueId: rubrique.id,
    tags: (article.tags || []).slice(0, 8),
    readingTime: Math.max(1, Math.round(mots / 220)),
  };

  if (reglages.simulation) return { statut: 'simule', corps };

  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), reglages.delaiApiMs);
  try {
    const r = await fetcher(`${reglages.siteUrl}/api/v1/articles`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    const rep = await r.json().catch(() => ({}));
    if (!r.ok) return { statut: 'echec', erreur: `HTTP ${r.status} ${rep?.error?.message ?? ''}`.trim(), corps };
    return { statut: 'depose', id: rep.id, slug: rep.slug, etat: rep.status, corps };
  } catch (e) {
    return { statut: 'echec', erreur: String(e.cause?.code || e.message).slice(0, 100), corps };
  } finally {
    clearTimeout(minuteur);
  }
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function executer(entree, options = {}) {
  const reglages = { ...REGLAGES, ...options.reglages };
  const journal = options.journal || (() => {});
  const fetcher = options.fetch || fetch;
  const debut = new Date();

  const jeu = entree?.dossiers ? entree : entree?.body;
  if (!jeu?.dossiers?.length) {
    return { workflow_id: entree?.workflow_id ?? null, source: 'AP-04', status: 'FAILED', error: "Aucun dossier reçu d'AP-03.", articles: [] };
  }

  // --- Tri : ce qui est rédigeable, ce qui ne l'est pas --------------------
  const redigeables = [];
  const ecartes = [];
  for (const d of jeu.dossiers) {
    if (reglages.verdictsRedigeables.includes(d.verdict_global)) redigeables.push(d);
    else ecartes.push({ candidate_id: d.candidate_id, title: d.title, verdict: d.verdict_global, motif: d.motif_verdict });
  }
  journal(`${redigeables.length} dossier(s) rédigeable(s), ${ecartes.length} écarté(s)`);

  const sortie = (extra) => ({
    workflow_id: jeu.workflow_id,
    source: 'AP-04',
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    collection_date: jeu.collection_date,
    simulation: reglages.simulation,
    // Les mentions d'amont se propagent : un article écrit sur une sélection
    // jamais relue doit le dire jusqu'au bout de la chaîne.
    selection_relue_par_un_modele: jeu.selection_relue_par_un_modele ?? null,
    verification_par_un_modele: jeu.verifie_par_un_modele ?? null,
    ecartes,
    ...extra,
  });

  if (redigeables.length === 0) {
    return sortie({ status: 'RIEN_A_ECRIRE', model: null, articles: [], statistics: { rediges: 0, ecartes: ecartes.length } });
  }

  const cle = options.cle || process.env.ANTHROPIC_API_KEY;
  if (!cle) {
    // Pas de repli possible : on ne rédige pas un article sans modèle.
    return sortie({ status: 'FAILED', error: 'Clé API Anthropic absente — AP-04 ne peut pas écrire sans modèle.', articles: [] });
  }

  let rubriques;
  try {
    rubriques = options.rubriques || await lireRubriques(reglages, fetcher);
  } catch (e) {
    return sortie({ status: 'FAILED', error: `Rubriques du site illisibles : ${e.message}`, articles: [] });
  }

  const charge = redigeables.map((d) => ({
    candidate_id: d.candidate_id,
    titre_source: d.title,
    region: d.region,
    angle: d.angle,
    verdict: d.verdict_global,
    faits_etablis: d.faits_etablis,
    points: (d.points || []).map((p) => ({ point: p.point, verdict: p.verdict, constat: p.constat, sources: p.sources })),
    citations: d.citations,
    a_obtenir: d.a_obtenir,
    base_documentaire: d.base_documentaire,
  }));

  const messages = [{
    role: 'user',
    content: `Rubriques disponibles : ${rubriques.map((r) => r.slug).join(', ')}\n\n${redigeables.length} dossier(s) à rédiger :\n\n${JSON.stringify(charge, null, 1)}`,
  }];

  const appeler = options.appelerClaude || (reglages.mode === 'direct' ? appelDirect : appelParLot);
  let reponse = null; let griefs = []; let usage = null; let batchId = null; let reprise = false;

  for (let essai = 0; essai < 2; essai++) {
    let brut;
    try {
      brut = await appeler({ cle, messages, reglages, journal });
    } catch (e) {
      return sortie({ status: 'FAILED', error: `Appel au modèle en échec : ${e.message}`, batch_id: e.batchId ?? null, articles: [] });
    }
    usage = brut.usage; batchId = brut.batchId ?? batchId;
    try { reponse = JSON.parse(brut.texte); } catch { griefs = ["La réponse n'est pas du JSON exploitable."]; reponse = null; }
    if (reponse) griefs = controlerArticles(reponse, redigeables, rubriques);
    if (griefs.length === 0) break;
    if (essai === 0) {
      reprise = true;
      journal(`reprise demandée : ${griefs.join(' ')}`);
      messages.push({ role: 'assistant', content: brut.texte });
      messages.push({ role: 'user', content: `Ta copie n'est pas publiable :\n\n${griefs.map((g) => `- ${g}`).join('\n')}\n\nCorrige-la. Rappel : aucune citation qui ne figure pas dans le dossier, et une rubrique prise dans la liste fournie.` });
    }
  }

  if (griefs.length > 0) {
    return sortie({ status: 'FAILED', error: 'La copie reste incorrecte après une reprise.', griefs, batch_id: batchId, articles: [] });
  }

  // --- Dépôt ---------------------------------------------------------------
  const jeton = options.jeton || process.env.A4A_API_TOKEN;
  if (!reglages.simulation && !jeton) {
    return sortie({ status: 'FAILED', error: "Jeton d'API du site absent : impossible de déposer. Repasser en simulation ou fournir le jeton.", articles: [] });
  }

  const parId = new Map(redigeables.map((d) => [d.candidate_id, d]));
  const resultats = [];
  for (const a of reponse.articles) {
    const d = parId.get(a.candidate_id);
    const r = await deposer(a, d, rubriques, reglages, jeton, fetcher);
    journal(`${a.candidate_id} : ${r.statut}${r.erreur ? ' — ' + r.erreur : ''}`);
    resultats.push({
      candidate_id: a.candidate_id,
      title: a.title, kicker: a.kicker, dek: a.dek, rubrique: a.rubrique,
      tags: a.tags, reserves_editoriales: a.reserves_editoriales,
      verdict_ap03: d.verdict_global,
      blocs: a.blocs.length,
      mots: a.blocs.reduce((n, b) => n + String(b.text || '').split(/\s+/).length, 0),
      depot: r,
    });
  }

  const fin = new Date();
  const deposes = resultats.filter((r) => r.depot.statut === 'depose').length;
  const echecs = resultats.filter((r) => r.depot.statut === 'echec');

  return sortie({
    status: echecs.length > 0 ? 'WARNING' : 'SUCCESS',
    model: MODELE,
    mode: reglages.mode,
    statistics: {
      rediges: resultats.length,
      ecartes: ecartes.length,
      deposes,
      echecs_depot: echecs.length,
      repaired: reprise,
      batch_id: batchId,
      input_tokens: usage?.input_tokens ?? null,
      output_tokens: usage?.output_tokens ?? null,
      duration_seconds: Math.round((fin - debut) / 1000),
    },
    articles: resultats,
  });
}


/** Point d'entrée attendu par Activepieces. */
export const code = async (inputs) => {
  return await executer(inputs?.dossiers, {
    cle: inputs?.apiKey,
    jeton: inputs?.jeton,
    reglages: inputs?.reglages || undefined,
  });
};
