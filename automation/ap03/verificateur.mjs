/**
 * AP-03 — Vérification
 *
 * Reçoit la sélection d'AP-02, va chercher le texte réel des articles, le
 * recoupe entre sources, et rend un dossier de vérification par sujet.
 *
 * CE QU'IL FAIT, ET SURTOUT CE QU'IL NE PEUT PAS FAIRE
 *
 * Un modèle de langage n'établit pas la vérité d'un fait. Il ne peut que
 * COMPARER ce que disent les sources qu'on lui met sous les yeux. C'est une
 * distinction éditoriale, pas une nuance technique : « trois rédactions
 * indépendantes donnent le même chiffre » n'est pas « le chiffre est exact »,
 * et un dossier qui confondrait les deux ferait courir un risque au journal.
 *
 * Les verdicts sont donc énumérés, et aucun ne dit « vrai » :
 *   - `concordant`   : au moins deux sources indépendantes disent la même chose
 *   - `source_unique`: une seule source l'affirme, personne ne la corrobore
 *   - `divergent`    : les sources se contredisent — le point le plus précieux
 *   - `inverifiable` : rien dans les textes obtenus ne permet de trancher
 *
 * LA BASE DOCUMENTAIRE EST VARIABLE, ET C'EST LE POINT DÉLICAT
 *
 * Mesuré sur le jeu réel du 7 septembre 2026 : le texte intégral est
 * récupérable pour 83 % des articles de l'échantillon, mais pas pour tous.
 *
 *   RFI, BBC, The Guardian, France 24, ONU Info   texte complet (3 k à 11 k car.)
 *   Jeune Afrique                                  chapô libre seulement
 *   Le Monde                                       HTTP 402 — payant, 0/8
 *   L'Infodrome, Le Point Sur                      page d'attente anti-robot
 *   Google News                                    lien encodé, média d'origine masqué
 *
 * Chaque sujet porte donc sa `base_documentaire` : ce qui a été réellement lu.
 * Un dossier qui ne dirait pas « je n'avais qu'un résumé de trois cents
 * caractères » serait pire qu'inutile — il inviterait la rédaction à se fier à
 * une vérification qui n'a pas eu lieu.
 *
 * On ne contourne aucun paywall : un 402 est un refus, il est rapporté comme
 * tel.
 */

const MODELE = 'claude-opus-5';

export const REGLAGES = {
  mode: 'lot',
  maxTokens: 12000,
  attenteLotMs: 45 * 60 * 1000,
  sondageInitialMs: 10000,
  sondageMaxMs: 60000,
  repliAutorise: true,
  /** Récupération des pages. */
  delaiPageMs: 15000,
  parallelisme: 4,
  /** Reprises consultées par sujet : au-delà, on paie sans mieux recouper. */
  maxReprises: 4,
  /** Texte transmis au modèle par article. */
  maxCarsParTexte: 6000,
};

// ---------------------------------------------------------------------------
// Récupération du texte
// ---------------------------------------------------------------------------

const UA = 'Mozilla/5.0 (compatible; Abidjan4all-Verifier/1.0; +https://abidjan4all.info)';

/** Mots qui trahissent un article tronqué derrière un abonnement. */
const MOTS_PAYANTS = /(article r[eé]serv[eé] aux abonn|d[eé]j[aà] abonn|s.abonner pour lire|acc[eé]dez [aà] l.int[eé]gralit|subscribe to (read|continue))/i;

/** Page d'attente anti-robot : la classe `isloading` en est la signature. */
const PAGE_ATTENTE = /<html[^>]*class="[^"]*isloading|just a moment|checking your browser|enable javascript to continue/i;

export function extraireTexte(html) {
  // Retire ce qui n'est jamais du texte d'article AVANT de chercher les
  // paragraphes : une extraction naïve ramène les menus, les pieds de page et
  // les bandeaux de consentement, qui pollueraient le recoupement.
  const h = html.replace(/<(script|style|nav|header|footer|aside|form|figcaption)[\s\S]*?<\/\1>/gi, ' ');
  const paras = [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => m[1].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 60);
  return paras.join('\n\n');
}

/**
 * Va chercher une page. Ne lève jamais : rend toujours un état, parce qu'un
 * article inaccessible est une information utile pour le dossier, pas une
 * panne.
 */
export async function recupererTexte(url, reglages = REGLAGES) {
  const hote = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; } })();
  if (!url) return { statut: 'absent', hote: null, texte: '', longueur: 0 };
  if (hote === 'news.google.com') {
    return {
      statut: 'agregateur', hote, texte: '', longueur: 0,
      motif: "lien Google News encodé : le média d'origine n'est pas atteignable depuis ce lien",
    };
  }

  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), reglages.delaiPageMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' } });
    const hoteFinal = (() => { try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch { return hote; } })();
    if (r.status === 402 || r.status === 403 || r.status === 451) {
      return { statut: 'payant', hote: hoteFinal, texte: '', longueur: 0, motif: `le site refuse la lecture (HTTP ${r.status})` };
    }
    if (!r.ok) return { statut: 'injoignable', hote: hoteFinal, texte: '', longueur: 0, motif: `HTTP ${r.status}` };

    const html = await r.text();
    if (PAGE_ATTENTE.test(html.slice(0, 4000))) {
      return { statut: 'protege', hote: hoteFinal, texte: '', longueur: 0, motif: "page d'attente anti-robot : le texte n'est servi qu'à un navigateur" };
    }
    const texte = extraireTexte(html);
    if (texte.length < 400) {
      return { statut: 'maigre', hote: hoteFinal, texte, longueur: texte.length, motif: 'moins de 400 caractères extraits — page probablement rendue par script' };
    }
    if (MOTS_PAYANTS.test(html.slice(0, 40000)) && texte.length < 2500) {
      return { statut: 'partiel', hote: hoteFinal, texte, longueur: texte.length, motif: 'chapô libre seulement, la suite est réservée aux abonnés' };
    }
    return { statut: 'texte', hote: hoteFinal, texte, longueur: texte.length };
  } catch (e) {
    const cause = e.name === 'AbortError' ? `délai dépassé (${reglages.delaiPageMs} ms)` : (e.cause?.code || e.message);
    return { statut: 'injoignable', hote, texte: '', longueur: 0, motif: String(cause).slice(0, 100) };
  } finally {
    clearTimeout(minuteur);
  }
}

/** Récupère par lots bornés : on ne se jette pas à quinze sur les serveurs. */
async function recupererPlusieurs(urls, reglages) {
  const resultats = [];
  for (let i = 0; i < urls.length; i += reglages.parallelisme) {
    const lot = urls.slice(i, i + reglages.parallelisme);
    const regles = await Promise.allSettled(lot.map((u) => recupererTexte(u, reglages)));
    for (let j = 0; j < lot.length; j++) {
      const r = regles[j];
      resultats.push({ url: lot[j], ...(r.status === 'fulfilled' ? r.value : { statut: 'injoignable', texte: '', longueur: 0, motif: String(r.reason).slice(0, 80) }) });
    }
  }
  return resultats;
}

/**
 * Rassemble les pièces d'un sujet : l'article retenu, plus les reprises.
 *
 * Les reprises ne sont pas un ornement — ce sont ELLES qui rendent le
 * recoupement possible. Un fait affirmé par un seul média reste un fait
 * affirmé par un seul média, quelle que soit sa réputation. Et quand le sujet
 * a été repéré par un agrégateur, dont le lien est inexploitable, une reprise
 * est souvent le seul texte réellement lisible.
 */
export async function rassemblerPreuves(sujet, reglages = REGLAGES) {
  const urls = [sujet.url, ...(sujet.reprises_detail || []).map((r) => r.url)]
    .filter(Boolean)
    .filter((u, i, l) => l.indexOf(u) === i)
    .slice(0, 1 + reglages.maxReprises);

  const pieces = await recupererPlusieurs(urls, reglages);
  const nomPar = new Map([[sujet.url, sujet.source?.name ?? 'source retenue']]);
  for (const r of sujet.reprises_detail || []) nomPar.set(r.url, r.source ?? 'reprise');

  return pieces.map((p) => ({
    source: nomPar.get(p.url) ?? p.hote ?? 'inconnue',
    hote: p.hote,
    url: p.url,
    statut: p.statut,
    motif: p.motif ?? null,
    longueur: p.longueur,
    texte: p.texte.slice(0, reglages.maxCarsParTexte),
  }));
}

/** Résumé lisible de ce qui a été réellement lu, pour la sortie. */
export function resumerBase(pieces, sujet) {
  const lisibles = pieces.filter((p) => p.statut === 'texte' || p.statut === 'partiel');
  return {
    sources_consultees: pieces.length,
    sources_lues: lisibles.length,
    sources_independantes: new Set(lisibles.map((p) => p.hote)).size,
    caracteres_lus: lisibles.reduce((n, p) => n + p.longueur, 0),
    // Le résumé RSS reste la seule matière quand rien n'a pu être lu. On le
    // dit, parce que trois cents caractères ne vérifient rien.
    seulement_le_resume_rss: lisibles.length === 0,
    detail: pieces.map((p) => ({ source: p.source, statut: p.statut, motif: p.motif, caracteres: p.longueur })),
  };
}

// ---------------------------------------------------------------------------
// Consigne
// ---------------------------------------------------------------------------

const CONSIGNE = `Tu vérifies des sujets pour Abidjan4All, média ivoirien, AVANT que la rédaction n'écrive.

TU N'ÉTABLIS PAS LA VÉRITÉ. Tu compares ce que disent les textes qu'on te fournit, et rien d'autre. Tu n'utilises pas tes connaissances générales pour confirmer un fait : si les textes ne le disent pas, il est invérifiable ici, même si tu crois le savoir. Cette règle est absolue — un dossier qui présenterait un souvenir de modèle comme une vérification tromperait la rédaction.

Pour chaque point à vérifier, un verdict et un seul :
- "concordant"    : au moins DEUX sources indépendantes (deux domaines différents) disent la même chose. Cite-les.
- "source_unique" : une seule source l'affirme. Ce n'est pas une faute — beaucoup d'informations sortent quelque part en premier — mais la rédaction doit le savoir.
- "divergent"     : les sources se contredisent. C'est le verdict le plus précieux : dis exactement qui dit quoi.
- "inverifiable"  : rien dans les textes fournis ne permet de trancher.

Attention aux fausses corroborations. Ne comptent pas comme deux sources indépendantes :
- deux médias qui reprennent la même dépêche d'agence ;
- un blog, un agrégateur ou un message de réseau social qui renvoie à un article déjà compté — un relais n'est pas un témoin ;
- deux articles du même média, ou de deux titres du même groupe.
Si tu le repères, dis-le et classe en "source_unique".

Si le sujet vient d'un réseau social ou d'une piste non vérifiée, sois particulièrement strict : une rumeur relayée cent fois reste une rumeur relayée, pas un fait corroboré.

Pour chaque sujet, indique aussi :
- les faits saillants réellement établis par les textes, qui serviront de socle à la rédaction ;
- les citations exactes utilisables, avec leur auteur et leur source ;
- ce qui manque et qu'un journaliste devra aller chercher lui-même.

Puis un verdict global :
- "solide"    : le sujet peut être écrit sur cette base.
- "a_completer": écrivable, mais des points restent à obtenir.
- "fragile"   : la base documentaire est trop mince ou trop contradictoire ; écrire serait risqué. Dis pourquoi.

Sois franc sur la minceur d'un dossier. Un sujet dont tu n'as que le résumé RSS ne peut pas être "solide", quelle que soit la réputation du média.`;

const SCHEMA = {
  type: 'object',
  properties: {
    dossiers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          candidate_id: { type: 'string' },
          verdict_global: { type: 'string', enum: ['solide', 'a_completer', 'fragile'] },
          motif_verdict: { type: 'string', description: 'Pourquoi ce verdict, en une ou deux phrases.' },
          points: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                point: { type: 'string', description: 'Le point à vérifier, repris de la demande.' },
                verdict: { type: 'string', enum: ['concordant', 'source_unique', 'divergent', 'inverifiable'] },
                constat: { type: 'string', description: 'Ce que disent les textes, précisément.' },
                sources: { type: 'array', items: { type: 'string' }, description: 'Les sources qui appuient ce constat.' },
              },
              required: ['point', 'verdict', 'constat', 'sources'],
              additionalProperties: false,
            },
          },
          faits_etablis: { type: 'array', items: { type: 'string' }, description: 'Faits réellement soutenus par les textes.' },
          citations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                texte: { type: 'string' },
                auteur: { type: 'string' },
                source: { type: 'string' },
              },
              required: ['texte', 'auteur', 'source'],
              additionalProperties: false,
            },
          },
          a_obtenir: { type: 'array', items: { type: 'string' }, description: "Ce qu'un journaliste doit aller chercher lui-même." },
        },
        required: ['candidate_id', 'verdict_global', 'motif_verdict', 'points', 'faits_etablis', 'citations', 'a_obtenir'],
        additionalProperties: false,
      },
    },
  },
  required: ['dossiers'],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Appels du modèle
// ---------------------------------------------------------------------------

async function client(cle) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return new Anthropic({ apiKey: cle });
}

function parametresModele(messages, maxTokens) {
  return {
    model: MODELE,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    system: CONSIGNE,
    messages,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  };
}

async function appelDirect({ cle, messages, maxTokens }) {
  const c = await client(cle);
  const message = await c.messages.stream(parametresModele(messages, maxTokens)).finalMessage();
  return { texte: message.content.filter((b) => b.type === 'text').map((b) => b.text).join(''), usage: message.usage };
}

async function appelParLot({ cle, messages, maxTokens, reglages, journal }) {
  const c = await client(cle);
  const lot = await c.messages.batches.create({
    requests: [{ custom_id: 'ap03-verification', params: parametresModele(messages, maxTokens) }],
  });
  journal?.(`lot ${lot.id} soumis`);

  const echeance = Date.now() + reglages.attenteLotMs;
  let attente = reglages.sondageInitialMs;
  let etat = lot;
  while (etat.processing_status !== 'ended') {
    if (Date.now() > echeance) {
      const e = new Error(`le lot ${lot.id} n'a pas abouti dans le délai accordé (${Math.round(reglages.attenteLotMs / 60000)} min)`);
      e.batchId = lot.id;
      throw e;
    }
    await new Promise((ok) => setTimeout(ok, attente));
    attente = Math.min(attente * 1.5, reglages.sondageMaxMs);
    etat = await c.messages.batches.retrieve(lot.id);
  }
  for await (const r of await c.messages.batches.results(lot.id)) {
    if (r.custom_id !== 'ap03-verification') continue;
    if (r.result.type !== 'succeeded') {
      const e = new Error(`le lot ${lot.id} s'est terminé en « ${r.result.type} »`);
      e.batchId = lot.id;
      throw e;
    }
    const m = r.result.message;
    return { texte: m.content.filter((b) => b.type === 'text').map((b) => b.text).join(''), usage: m.usage, batchId: lot.id };
  }
  const e = new Error(`le lot ${lot.id} n'a rendu aucun résultat`);
  e.batchId = lot.id;
  throw e;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Ce que le schéma ne garantit pas : que le modèle traite bien les sujets
 * soumis, et qu'il ne décrète pas « solide » un dossier dont il n'avait que le
 * résumé RSS. Ce second contrôle est le plus important — c'est exactement la
 * complaisance qu'on veut empêcher.
 */
export function validerDossiers(reponse, sujets, bases) {
  const griefs = [];
  const attendus = new Set(sujets.map((s) => s.candidate_id));
  const dossiers = reponse?.dossiers;
  if (!Array.isArray(dossiers)) return ['La réponse ne contient pas de tableau "dossiers".'];

  if (dossiers.length !== sujets.length) griefs.push(`${dossiers.length} dossiers pour ${sujets.length} sujets.`);
  const vus = new Set();
  for (const d of dossiers) {
    if (!attendus.has(d.candidate_id)) griefs.push(`Le dossier ${d.candidate_id} ne correspond à aucun sujet soumis.`);
    if (vus.has(d.candidate_id)) griefs.push(`Deux dossiers pour ${d.candidate_id}.`);
    vus.add(d.candidate_id);

    const base = bases.get(d.candidate_id);
    if (base?.seulement_le_resume_rss && d.verdict_global === 'solide') {
      griefs.push(`${d.candidate_id} est déclaré « solide » alors qu'aucun texte n'a pu être lu — seul le résumé RSS était disponible.`);
    }
    for (const p of d.points || []) {
      if (p.verdict === 'concordant' && (p.sources || []).length < 2) {
        griefs.push(`Un point de ${d.candidate_id} est « concordant » mais ne cite qu'une source.`);
      }
    }
  }
  for (const id of attendus) if (!vus.has(id)) griefs.push(`Aucun dossier pour ${id}.`);
  return griefs;
}

// ---------------------------------------------------------------------------
// Repli
// ---------------------------------------------------------------------------

/**
 * Sans modèle, AP-03 peut tout de même rendre un service réel : dire ce qui a
 * été lu, combien de rédactions indépendantes couvrent le sujet, et ce qui
 * était inaccessible. Il ne prononce AUCUN verdict — tout est `non_verifie`.
 */
function dossiersDeRepli(sujets, bases) {
  return sujets.map((s) => {
    const base = bases.get(s.candidate_id);
    return {
      candidate_id: s.candidate_id,
      verdict_global: 'non_verifie',
      motif_verdict: `Aucun modèle n'a relu ce dossier. ${base.sources_lues} source(s) lisible(s) sur ${base.sources_consultees} consultée(s), ${base.sources_independantes} domaine(s) distinct(s).`,
      points: (s.verification_requise || []).map((p) => ({ point: p, verdict: 'non_verifie', constat: 'Non examiné : sélection de repli.', sources: [] })),
      faits_etablis: [],
      citations: [],
      a_obtenir: ['Tout : ce dossier n\'a pas été vérifié, le journaliste doit reprendre le sujet depuis les sources.'],
    };
  });
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export async function executer(entree, options = {}) {
  const reglages = { ...REGLAGES, ...options.reglages };
  const debut = new Date();
  const journal = options.journal || (() => {});

  const jeu = entree?.selection ? entree : entree?.body;
  if (!jeu?.selection?.length) {
    return { workflow_id: entree?.workflow_id ?? null, source: 'AP-03', status: 'FAILED', error: "Aucune sélection reçue d'AP-02.", dossiers: [] };
  }
  const sujets = jeu.selection;

  // --- Collecte des pièces, avant toute intervention du modèle -------------
  const pieces = new Map();
  const bases = new Map();
  for (const s of sujets) {
    const p = await rassemblerPreuves(s, reglages);
    pieces.set(s.candidate_id, p);
    bases.set(s.candidate_id, resumerBase(p, s));
    journal(`${s.candidate_id} : ${bases.get(s.candidate_id).sources_lues}/${p.length} source(s) lue(s)`);
  }

  const assembler = ({ dossiers, degrade, motif, extra }) => {
    const parId = new Map(sujets.map((s) => [s.candidate_id, s]));
    const fin = new Date();
    const enrichis = dossiers.map((d) => {
      const s = parId.get(d.candidate_id);
      return {
        ...d,
        title: s?.title, url: s?.url, region: s?.region, source: s?.source,
        angle: s?.angle ?? null, priorite: s?.priorite,
        base_documentaire: bases.get(d.candidate_id),
      };
    });
    return {
      workflow_id: jeu.workflow_id,
      source: 'AP-03',
      version: '1.0.0',
      generated_at: fin.toISOString(),
      collection_date: jeu.collection_date,
      status: degrade ? 'DEGRADED' : 'SUCCESS',
      mode: degrade ? 'repli' : (reglages.mode === 'direct' ? 'direct' : 'lot'),
      verifie_par_un_modele: !degrade,
      motif_repli: motif ?? null,
      model: degrade ? null : MODELE,
      // AP-02 pouvait déjà être dégradé : la mention se propage, sinon la
      // rédaction croirait relue une sélection qui ne l'a jamais été.
      selection_relue_par_un_modele: jeu.relue_par_un_modele ?? null,
      statistics: {
        sujets: sujets.length,
        sources_consultees: [...bases.values()].reduce((n, b) => n + b.sources_consultees, 0),
        sources_lues: [...bases.values()].reduce((n, b) => n + b.sources_lues, 0),
        sujets_sans_aucun_texte: [...bases.values()].filter((b) => b.seulement_le_resume_rss).length,
        par_verdict: enrichis.reduce((acc, d) => { acc[d.verdict_global] = (acc[d.verdict_global] || 0) + 1; return acc; }, {}),
        duration_seconds: Math.round((fin - debut) / 1000),
        ...extra,
      },
      dossiers: enrichis,
    };
  };

  const replier = (motif, extra = {}) => {
    if (!reglages.repliAutorise) {
      return { workflow_id: jeu.workflow_id, source: 'AP-03', status: 'FAILED', error: motif, dossiers: [] };
    }
    journal(`repli : ${motif}`);
    return assembler({ dossiers: dossiersDeRepli(sujets, bases), degrade: true, motif, extra });
  };

  const cle = options.cle || process.env.ANTHROPIC_API_KEY;
  if (!cle) return replier("Clé API Anthropic absente. La renseigner dans les entrées de l'étape, ou en variable ANTHROPIC_API_KEY.");

  // --- Chargement transmis au modèle --------------------------------------
  const charge = sujets.map((s) => ({
    candidate_id: s.candidate_id,
    titre: s.title,
    region: s.region,
    angle: s.angle,
    resume_rss: s.description ?? null,
    points_a_verifier: s.verification_requise || [],
    base_documentaire: bases.get(s.candidate_id).detail,
    textes: pieces.get(s.candidate_id)
      .filter((p) => p.texte)
      .map((p) => ({ source: p.source, domaine: p.hote, statut: p.statut, texte: p.texte })),
  }));

  const messages = [{
    role: 'user',
    content: `Exécution : ${jeu.workflow_id}\nDate : ${jeu.collection_date}\n\n${sujets.length} sujets à vérifier. Pour chacun, les textes réellement obtenus sont fournis ; quand un texte manque, son statut dit pourquoi.\n\n${JSON.stringify(charge, null, 1)}`,
  }];

  const appeler = options.appelerClaude || (reglages.mode === 'direct' ? appelDirect : appelParLot);
  let reponse = null; let griefs = []; let usage = null; let batchId = null; let reprise = false;

  for (let essai = 0; essai < 2; essai++) {
    let brut;
    try {
      brut = await appeler({ cle, messages, maxTokens: reglages.maxTokens, reglages, journal });
    } catch (e) {
      return replier(`Appel au modèle en échec : ${e.message}`, e.batchId ? { batch_id: e.batchId } : {});
    }
    usage = brut.usage; batchId = brut.batchId ?? batchId;
    try { reponse = JSON.parse(brut.texte); } catch { griefs = ["La réponse n'est pas du JSON exploitable."]; reponse = null; }
    if (reponse) griefs = validerDossiers(reponse, sujets, bases);
    if (griefs.length === 0) break;
    if (essai === 0) {
      reprise = true;
      journal(`reprise demandée : ${griefs.join(' ')}`);
      messages.push({ role: 'assistant', content: brut.texte });
      messages.push({ role: 'user', content: `Ton dossier n'est pas exploitable :\n\n${griefs.map((g) => `- ${g}`).join('\n')}\n\nCorrige-le. Rappel : un verdict « concordant » exige au moins deux sources indépendantes, et un sujet dont aucun texte n'a pu être lu ne peut pas être « solide ».` });
    }
  }

  if (griefs.length > 0) return replier(`Les dossiers restent invalides après une reprise : ${griefs[0]}`, { griefs, batch_id: batchId });

  return assembler({
    dossiers: reponse.dossiers, degrade: false,
    extra: { repaired: reprise, batch_id: batchId, input_tokens: usage?.input_tokens ?? null, output_tokens: usage?.output_tokens ?? null },
  });
}
