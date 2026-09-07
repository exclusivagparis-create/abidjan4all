/**
 * AP-01 — News Collector
 *
 * Collecte, normalise, filtre, dedoublonne et classe les actualites du jour,
 * puis produit le jeu de candidats destine a AP-02.
 *
 * Choix d'architecture, et pourquoi.
 *
 * 1. UNE seule etape de code, et non les quatorze du plan. Le plan le
 *    recommandait deja pour les dix branches de collecte ; la meme raison vaut
 *    pour la suite. Quatorze etapes chainees dans Activepieces recopient le jeu
 *    complet des articles a chaque passage — plusieurs mega-octets de JSON
 *    serialises treize fois, sur une machine qui dispose de 1,8 Go. Ici tout
 *    tient dans une seule execution, et le jeu n'est serialise qu'une fois, a
 *    la sortie.
 *
 * 2. AUCUNE dependance npm. Un `npm install` au demarrage d'une etape est le
 *    point de panne classique : il depend du reseau, du cache du conteneur et
 *    du registre. L'analyseur RSS/Atom tient en trente lignes, autant l'ecrire.
 *
 * 3. Les sources sont interrogees en PARALLELE BORNE (six a la fois). En serie,
 *    quarante sources a quinze secondes de delai maximal font dix minutes dans
 *    le pire cas ; toutes en meme temps saturent les deux coeurs de la machine,
 *    que le site partage.
 *
 * 4. Une source qui echoue n'arrete jamais rien (regle 1 du plan) : chaque
 *    collecte est isolee, son echec est journalise et devient une ligne du
 *    rapport.
 */

// ---------------------------------------------------------------------------
// Registre des sources
// ---------------------------------------------------------------------------

/**
 * Registre centralise, comme demande : une source se desactive en passant
 * `enabled` a false, sans toucher au code.
 *
 * `priority` est le score technique du plan. Il ne dit PAS qu'un article est
 * vrai : il dit de quelle distance editoriale il vient. Un agregateur a 50
 * parce qu'il fait decouvrir un sujet, pas parce qu'il le garantit.
 */
export const REGISTRE = [
  // --- Cote d'Ivoire -------------------------------------------------------
  // AIP est l'agence de presse d'Etat : c'est la source la plus proche de
  // l'institution, d'ou sa priorite. Les autres sont des medias prives.
  //
  // Koaci, Fraternite Matin, Abidjan.net, RTI et 7info figuraient au plan mais
  // n'ont AUCUN flux exploitable — verifie sur dix-neuf adresses : 404 pour les
  // uns, page sans article pour les autres, certificat expire pour RTI. Ils
  // restent inscrits plus bas, desactives, avec le motif : quand l'un d'eux
  // ouvrira un flux, il suffira de repasser `enabled` a true.
  { id: 'aip', name: 'AIP', type: 'MEDIA_CI', region: 'Cote_Ivoire', country: 'CI', lang: 'fr', priority: 90, enabled: true, url: 'https://www.aip.ci/feed/' },
  { id: 'linfodrome', name: "L'Infodrome", type: 'MEDIA_CI', region: 'Cote_Ivoire', country: 'CI', lang: 'fr', priority: 75, enabled: true, url: 'https://www.linfodrome.com/rss' },
  { id: 'afriksoir', name: 'Afriksoir', type: 'MEDIA_CI', region: 'Cote_Ivoire', country: 'CI', lang: 'fr', priority: 70, enabled: true, url: 'https://www.afriksoir.net/feed/' },
  { id: 'lepointsur', name: 'Le Point Sur', type: 'MEDIA_CI', region: 'Cote_Ivoire', country: 'CI', lang: 'fr', priority: 65, enabled: true, url: 'https://www.lepointsur.com/feed/' },
  { id: 'yeclo', name: 'Yeclo', type: 'MEDIA_CI', region: 'Cote_Ivoire', country: 'CI', lang: 'fr', priority: 65, enabled: true, url: 'https://www.yeclo.com/feed/' },
  { id: 'connectionivoirienne', name: 'Connectionivoirienne', type: 'MEDIA_CI', region: 'Cote_Ivoire', country: 'CI', lang: 'fr', priority: 65, enabled: true, url: 'https://www.connectionivoirienne.net/feed' },

  // --- Afrique -------------------------------------------------------------
  { id: 'jeuneafrique', name: 'Jeune Afrique', type: 'MEDIA_AFRICA', region: 'Afrique', country: null, lang: 'fr', priority: 85, enabled: true, url: 'https://www.jeuneafrique.com/feed/' },
  { id: 'rfi-afrique', name: 'RFI Afrique', type: 'MEDIA_AFRICA', region: 'Afrique', country: null, lang: 'fr', priority: 85, enabled: true, url: 'https://www.rfi.fr/fr/afrique/rss' },
  { id: 'bbc-afrique', name: 'BBC Afrique', type: 'MEDIA_AFRICA', region: 'Afrique', country: null, lang: 'fr', priority: 85, enabled: true, url: 'https://feeds.bbci.co.uk/afrique/rss.xml' },
  { id: 'lemonde-afrique', name: 'Le Monde Afrique', type: 'MEDIA_AFRICA', region: 'Afrique', country: null, lang: 'fr', priority: 85, enabled: true, url: 'https://www.lemonde.fr/afrique/rss_full.xml' },
  { id: 'france24-afrique', name: 'France 24 Afrique', type: 'MEDIA_AFRICA', region: 'Afrique', country: null, lang: 'fr', priority: 85, enabled: true, url: 'https://www.france24.com/fr/afrique/rss' },

  // --- International -------------------------------------------------------
  { id: 'lemonde-intl', name: 'Le Monde International', type: 'MEDIA_INTL', region: 'International', country: null, lang: 'fr', priority: 80, enabled: true, url: 'https://www.lemonde.fr/international/rss_full.xml' },
  { id: 'france24-monde', name: 'France 24 Monde', type: 'MEDIA_INTL', region: 'International', country: null, lang: 'fr', priority: 80, enabled: true, url: 'https://www.france24.com/fr/rss' },
  { id: 'euronews-fr', name: 'Euronews', type: 'MEDIA_INTL', region: 'International', country: null, lang: 'fr', priority: 75, enabled: true, url: 'https://fr.euronews.com/rss' },
  { id: 'bbc-world', name: 'BBC World', type: 'MEDIA_INTL', region: 'International', country: null, lang: 'en', priority: 80, enabled: true, url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'guardian-world', name: 'The Guardian', type: 'MEDIA_INTL', region: 'International', country: null, lang: 'en', priority: 80, enabled: true, url: 'https://www.theguardian.com/world/rss' },
  { id: 'aljazeera', name: 'Al Jazeera', type: 'MEDIA_INTL', region: 'International', country: null, lang: 'en', priority: 75, enabled: true, url: 'https://www.aljazeera.com/xml/rss/all.xml' },

  // --- Institutionnel ------------------------------------------------------
  { id: 'un-news-fr', name: 'ONU Info', type: 'INSTITUTION', region: 'International', country: null, lang: 'fr', priority: 100, enabled: true, url: 'https://news.un.org/feed/subscribe/fr/news/all/rss.xml' },

  // --- Agregateurs ---------------------------------------------------------
  // Couche de DECOUVERTE, jamais source primaire (regle 2 du plan) : priorite
  // basse, et `is_aggregator` marque explicitement dans chaque candidat pour
  // qu'AP-02 sache qu'il faut remonter au media d'origine.
  { id: 'gnews-ci', name: 'Google News — Côte d\'Ivoire', type: 'GOOGLE_NEWS', region: 'Cote_Ivoire', country: 'CI', lang: 'fr', priority: 50, enabled: true, url: 'https://news.google.com/rss/search?q=C%C3%B4te+d%27Ivoire&hl=fr&gl=CI&ceid=CI:fr' },
  { id: 'gnews-abidjan', name: 'Google News — Abidjan', type: 'GOOGLE_NEWS', region: 'Cote_Ivoire', country: 'CI', lang: 'fr', priority: 50, enabled: true, url: 'https://news.google.com/rss/search?q=Abidjan&hl=fr&gl=CI&ceid=CI:fr' },
  { id: 'gnews-eco-ci', name: 'Google News — Économie CI', type: 'GOOGLE_NEWS', region: 'Cote_Ivoire', country: 'CI', lang: 'fr', priority: 50, enabled: true, url: 'https://news.google.com/rss/search?q=%C3%A9conomie+C%C3%B4te+d%27Ivoire&hl=fr&gl=CI&ceid=CI:fr' },
  { id: 'gnews-gouv-ci', name: 'Google News — Gouvernement ivoirien', type: 'GOOGLE_NEWS', region: 'Cote_Ivoire', country: 'CI', lang: 'fr', priority: 50, enabled: true, url: 'https://news.google.com/rss/search?q=gouvernement+ivoirien&hl=fr&gl=CI&ceid=CI:fr' },
  { id: 'gnews-afrique', name: 'Google News — Afrique', type: 'GOOGLE_NEWS', region: 'Afrique', country: null, lang: 'fr', priority: 50, enabled: true, url: 'https://news.google.com/rss/search?q=Afrique&hl=fr&gl=FR&ceid=FR:fr' },
  { id: 'gnews-cedeao', name: 'Google News — CEDEAO', type: 'GOOGLE_NEWS', region: 'Afrique', country: null, lang: 'fr', priority: 50, enabled: true, url: 'https://news.google.com/rss/search?q=CEDEAO&hl=fr&gl=CI&ceid=CI:fr' },

  // --- Ecartees, conservees pour memoire -----------------------------------
  // Sondees le 2026-09-07 : aucune n'expose de flux exploitable. Elles restent
  // ici pour qu'on n'ait pas a redecouvrir le probleme dans six mois, et pour
  // qu'une remise en service tienne en un mot.
  { id: 'koaci', name: 'Koaci', type: 'MEDIA_CI', region: 'Cote_Ivoire', country: 'CI', lang: 'fr', priority: 80, enabled: false, url: 'https://www.koaci.com/rss', motif: 'HTTP 404 sur /rss, /feed, /rss.xml et ?feed=rss2' },
  { id: 'fratmat', name: 'Fraternité Matin', type: 'MEDIA_CI', region: 'Cote_Ivoire', country: 'CI', lang: 'fr', priority: 85, enabled: false, url: 'https://www.fratmat.info/rss', motif: 'répond, mais aucun article dans le flux' },
  { id: 'abidjannet', name: 'Abidjan.net', type: 'MEDIA_CI', region: 'Cote_Ivoire', country: 'CI', lang: 'fr', priority: 75, enabled: false, url: 'https://news.abidjan.net/rss', motif: 'flux vide ; /rss/ en 404' },
  { id: 'rti', name: 'RTI', type: 'MEDIA_CI', region: 'Cote_Ivoire', country: 'CI', lang: 'fr', priority: 80, enabled: false, url: 'https://www.rti.ci/feed', motif: 'certificat TLS expiré — à ne pas contourner' },
  { id: 'presidence-ci', name: 'Présidence de Côte d\'Ivoire', type: 'INSTITUTION', region: 'Cote_Ivoire', country: 'CI', lang: 'fr', priority: 100, enabled: false, url: 'https://www.presidence.ci/feed/', motif: 'chaîne de certificats incomplète' },
  { id: 'apanews', name: 'APA News', type: 'MEDIA_AFRICA', region: 'Afrique', country: null, lang: 'fr', priority: 80, enabled: false, url: 'https://apanews.net/feed/', motif: 'HTTP 403 — refuse les robots' },
  { id: 'agenceecofin', name: 'Agence Ecofin', type: 'MEDIA_AFRICA', region: 'Afrique', country: null, lang: 'fr', priority: 80, enabled: false, url: 'https://www.agenceecofin.com/component/obrss/rss-accueil', motif: 'HTTP 403 — refuse les robots' },
];

// ---------------------------------------------------------------------------
// Reglages
// ---------------------------------------------------------------------------

export const REGLAGES = {
  fenetreHeures: 24,          // articles publies depuis N heures
  toleranceHeures: 6,         // tolerance pour les sources retardataires
  delaiSourceMs: 15000,
  parallelisme: 6,
  quotas: { Cote_Ivoire: 50, Afrique: 50, International: 50 },
  maxParSource: 40,           // bride un flux bavard qui ecraserait les autres
  similariteDoublon: 0.62,    // seuil de rapprochement des titres
};

// ---------------------------------------------------------------------------
// Analyse RSS / Atom
// ---------------------------------------------------------------------------

const decoderEntites = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
   .replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
   .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
   .replace(/&amp;/g, '&');

const sansCdata = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

/** Contenu de la premiere balise trouvee parmi `noms`. */
function baliseTexte(bloc, noms) {
  for (const nom of noms) {
    const m = bloc.match(new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`, 'i'));
    if (m) return decoderEntites(sansCdata(m[1])).trim();
  }
  return '';
}

/** Attribut d'une balise auto-fermante, ex. <link href="…"/> d'Atom. */
function baliseAttribut(bloc, nom, attribut) {
  const m = bloc.match(new RegExp(`<${nom}[^>]*\\b${attribut}=["']([^"']+)["']`, 'i'));
  return m ? decoderEntites(m[1]).trim() : '';
}

/**
 * Decoupe un flux en articles bruts. Gere RSS 2.0 (`<item>`) et Atom
 * (`<entry>`), les deux formats rencontres sur les dix-huit flux retenus.
 */
export function analyserFlux(xml) {
  const blocs = [];
  for (const balise of ['item', 'entry']) {
    const re = new RegExp(`<${balise}(?:\\s[^>]*)?>([\\s\\S]*?)</${balise}>`, 'gi');
    let m;
    while ((m = re.exec(xml)) !== null) blocs.push(m[1]);
    if (blocs.length > 0) break; // un flux ne mele pas les deux
  }

  return blocs.map((bloc) => {
    // Atom porte le lien en attribut ; RSS dans le contenu de la balise.
    let url = baliseTexte(bloc, ['link']);
    if (!url || url.startsWith('<')) url = baliseAttribut(bloc, 'link', 'href');
    if (!url) url = baliseTexte(bloc, ['guid']);

    return {
      title: baliseTexte(bloc, ['title']),
      description: baliseTexte(bloc, ['description', 'summary', 'content:encoded', 'content']),
      url,
      published_raw: baliseTexte(bloc, ['pubDate', 'published', 'updated', 'dc:date']),
      author: baliseTexte(bloc, ['dc:creator', 'author', 'name']) || null,
      image_url: baliseAttribut(bloc, 'media:content', 'url')
              || baliseAttribut(bloc, 'media:thumbnail', 'url')
              || baliseAttribut(bloc, 'enclosure', 'url')
              || null,
    };
  });
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/** Texte lisible : balises retirees, espaces reduits. */
export function nettoyerTexte(valeur) {
  if (!valeur) return '';
  return decoderEntites(String(valeur))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * URL canonique : parametres de tracage retires, ancre supprimee.
 *
 * Ce n'est pas de la coquetterie — c'est ce qui fait que le meme article, vu
 * par deux chemins differents, porte la meme adresse et se dedoublonne. Les
 * parametres `utm_*` sont ajoutes par les agregateurs et diffèrent a chaque
 * passage.
 */
export function canoniserUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url.trim());
    const aJeter = [];
    for (const cle of u.searchParams.keys()) {
      if (/^(utm_|fbclid|gclid|ref|ref_src|spm|at_|xtor|_ga)/i.test(cle)) aJeter.push(cle);
    }
    for (const cle of aJeter) u.searchParams.delete(cle);
    u.hash = '';
    let s = u.toString();
    if (s.endsWith('?')) s = s.slice(0, -1);
    return s;
  } catch {
    return url.trim();
  }
}

/** Date en ISO 8601, ou null si l'entree est illisible. */
export function normaliserDate(brut) {
  if (!brut) return null;
  const d = new Date(brut);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Filtrage editorial
// ---------------------------------------------------------------------------

/**
 * Rejets manifestes, avant toute intervention de Claude : publicite, jeux,
 * horoscopes, resultats bruts.
 *
 * Volontairement CONSERVATEUR. Un filtre trop large ecarte une vraie
 * information, et rien ne le signale — l'article n'arrive simplement jamais.
 * Mieux vaut laisser passer un peu de bruit qu'AP-02 saura ecarter.
 */
const MOTIFS_REJET = [
  /\b(publi[- ]?r[eé]dactionnel|publireportage|contenu sponsoris|sponsored|advertorial)\b/i,
  /\b(horoscope|astrologie|voyance)\b/i,
  /\b(jeu[- ]concours|grand jeu|tentez de gagner|gagnez un)\b/i,
  /\b(promo(tion)?s? exclusives?|bons? plans?|code promo|soldes)\b/i,
  /\b(r[eé]sultats? (du|des) (loto|pmu|tirage)|num[eé]ros gagnants)\b/i,
  /\b(petites annonces|offre d.emploi)\b/i,
];

export function rejeteParFiltre(article) {
  if (!article.title || article.title.length < 12) return 'titre absent ou trop court';
  if (!article.url) return 'url absente';
  const texte = `${article.title} ${article.description}`;
  for (const motif of MOTIFS_REJET) {
    if (motif.test(texte)) return 'contenu non editorial';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Classification geographique
// ---------------------------------------------------------------------------

const MOTS_CI = /\b(c[oô]te d.ivoire|ivoirien|ivoirienne|abidjan|yamoussoukro|bouak[eé]|san[- ]p[eé]dro|korhogo|daloa|ouattara|rhdp|pdci|ppa[- ]ci|plateau|cocody|yopougon|treichville|adjam[eé]|marcory|attieke|cnps|brvm|uemoa)\b/i;
const MOTS_AFRIQUE = /\b(afrique|africain|africaine|s[eé]n[eé]gal|mali|burkina|guin[eé]e|ghana|nigeria|niger|togo|b[eé]nin|cameroun|gabon|congo|kenya|[eé]thiopie|maroc|alg[eé]rie|tunisie|afrique du sud|cedeao|union africaine|sahel|dakar|bamako|ouagadougou|accra|lagos|nairobi|addis)\b/i;

const MOTS_INTL = /\b([eé]tats[- ]unis|washington|pentagone|maison[- ]blanche|trump|biden|chine|p[eé]kin|xi jinping|russie|moscou|poutine|ukraine|kiev|isra[eë]l|gaza|iran|t[eé]h[eé]ran|inde|japon|br[eé]sil|otan|union europ[eé]enne|bruxelles|londres|berlin|wall street|r[eé]serve f[eé]d[eé]rale|fmi|banque mondiale|onu|nations unies)\b/i;

/**
 * Classification PROVISOIRE, comme le veut le plan : AP-02 pourra la corriger.
 *
 * L'ordre compte, et il a ete corrige apres la premiere execution reelle. La
 * version initiale retombait sur la region declaree de la source quand aucun
 * mot-cle ne correspondait — si bien qu'un article de L'Infodrome intitule
 * « A court de munitions contre Teheran, le Pentagone… » etait classe ivoirien,
 * et occupait une des cinquante places du quota Cote d'Ivoire. Un media
 * national parle du monde entier : sa nationalite ne dit rien du sujet.
 *
 * Le texte prime donc toujours sur la source ; la source ne sert qu'a defaut.
 */
export function classerRegion(article, source) {
  const texte = `${article.title} ${article.description}`;
  if (MOTS_CI.test(texte)) return 'Cote_Ivoire';
  if (MOTS_AFRIQUE.test(texte)) return 'Afrique';
  if (MOTS_INTL.test(texte)) return 'International';
  if (source.region === 'Cote_Ivoire') return 'Cote_Ivoire';
  if (source.region === 'Afrique') return 'Afrique';
  return 'International';
}

// ---------------------------------------------------------------------------
// Empreinte et rapprochement
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';

/** Titre reduit a sa substance : minuscules, sans accents ni ponctuation. */
export function titreNormalise(titre) {
  return String(titre || '')
    .toLowerCase()
    .normalize('NFD')
    // Signes combinants en ECHAPPEMENTS, et non en clair : ce fichier est
    // destine au copier-coller dans un champ de navigateur, ou des caracteres
    // combinants — invisibles a l ecran — peuvent etre recomposes au collage.
    // La classe deviendrait fausse sans que rien ne se voie.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function empreinte(article) {
  return createHash('sha256')
    .update(`${titreNormalise(article.title)}|${(article.published_at || '').slice(0, 10)}`)
    .digest('hex');
}

/** Mots signifiants d'un titre — les outils grammaticaux sont ecartes. */
const VIDES = new Set(('le la les un une des du de d au aux a et ou ou mais donc or ni car en dans sur pour par avec sans sous chez que qui quoi dont ne pas plus moins tres son sa ses leur leurs ce cet cette ces il elle ils elles on nous vous se est sont etre avoir fait apres avant entre vers the a an and or of in on for to with at by from is are be as it its this that').split(' '));

function jetons(titre) {
  return new Set(titreNormalise(titre).split(' ').filter((m) => m.length > 2 && !VIDES.has(m)));
}

/** Recouvrement de Jaccard entre deux titres. */
export function similarite(a, b) {
  const A = jetons(a); const B = jetons(b);
  if (A.size === 0 || B.size === 0) return 0;
  let commun = 0;
  for (const m of A) if (B.has(m)) commun++;
  return commun / (A.size + B.size - commun);
}

// ---------------------------------------------------------------------------
// Collecte
// ---------------------------------------------------------------------------

async function tenterUneFois(source) {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), REGLAGES.delaiSourceMs);
  try {
    const r = await fetch(source.url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Abidjan4all-NewsCollector/1.0 (+https://abidjan4all.info)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    if (!r.ok) return { erreur: `HTTP ${r.status}`, reessayable: r.status >= 500 || r.status === 429 };
    return { xml: await r.text() };
  } catch (e) {
    const cause = e.name === 'AbortError' ? `délai dépassé (${REGLAGES.delaiSourceMs} ms)` : (e.cause?.code || e.message);
    return { erreur: String(cause).slice(0, 120), reessayable: true };
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * Une source, avec UN nouvel essai.
 *
 * Ajoute apres la premiere execution reelle : l'AIP — l'agence de presse
 * ivoirienne, donc la source la plus precieuse du registre — a repondu 500
 * alors qu'elle fonctionnait quelques minutes plus tot. Une panne passagere
 * privait le collecteur de sa meilleure source ivoirienne pour la journee
 * entiere. On ne reessaie que ce qui a des chances d'aboutir : un 500, un 429
 * ou une coupure reseau, jamais un 404 ni un 403, qui ne changeront pas.
 */
async function collecterSource(source) {
  const t0 = Date.now();
  let r = await tenterUneFois(source);
  let reessai = false;
  if (r.erreur && r.reessayable) {
    await new Promise((ok) => setTimeout(ok, 2000));
    reessai = true;
    r = await tenterUneFois(source);
  }
  if (r.erreur) {
    return { source, status: 'ERROR', error: r.erreur + (reessai ? ' (après un nouvel essai)' : ''), ms: Date.now() - t0, articles: [] };
  }
  const articles = analyserFlux(r.xml).slice(0, REGLAGES.maxParSource);
  if (articles.length === 0) return { source, status: 'EMPTY', error: 'aucun article analysable', ms: Date.now() - t0, articles: [] };
  return { source, status: 'OK', error: null, ms: Date.now() - t0, articles, reessai };
}

/** Execute par lots de `parallelisme` : ni tout en serie, ni tout d'un coup. */
async function collecterToutes(sources) {
  const resultats = [];
  for (let i = 0; i < sources.length; i += REGLAGES.parallelisme) {
    const lot = sources.slice(i, i + REGLAGES.parallelisme);
    // `allSettled` et non `all` : une source qui echoue ne doit rien
    // interrompre — c'est la regle 1 du plan, appliquee au niveau du lot.
    const regles = await Promise.allSettled(lot.map(collecterSource));
    for (const r of regles) {
      resultats.push(r.status === 'fulfilled' ? r.value : { source: { id: 'inconnue' }, status: 'ERROR', error: String(r.reason).slice(0, 120), ms: 0, articles: [] });
    }
  }
  return resultats;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export async function executer(options = {}) {
  const reglages = { ...REGLAGES, ...options.reglages };
  const sources = (options.registre || REGISTRE).filter((s) => s.enabled);

  const debut = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  // Horodatage en Europe/Paris, comme le demande le plan — et non en UTC :
  // `A4A-2026-09-07-120000` doit correspondre au declenchement de midi vu de
  // Paris, sinon l'identifiant ment de deux heures l'ete.
  const paris = new Date(debut.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const workflowId = `A4A-${paris.getFullYear()}-${pad(paris.getMonth() + 1)}-${pad(paris.getDate())}-${pad(paris.getHours())}${pad(paris.getMinutes())}${pad(paris.getSeconds())}`;

  const erreurs = [];
  const resultats = await collecterToutes(sources);

  // --- Normalisation -------------------------------------------------------
  const limiteBasse = Date.now() - (reglages.fenetreHeures + reglages.toleranceHeures) * 3600 * 1000;
  let brutsCollectes = 0;
  let rejetesDate = 0;
  let rejetesFiltre = 0;
  const normalises = [];

  for (const res of resultats) {
    if (res.status !== 'OK') {
      erreurs.push({ source: res.source.id, status: res.status, error: res.error });
      continue;
    }
    for (const brut of res.articles) {
      brutsCollectes++;
      const publie = normaliserDate(brut.published_raw);
      const article = {
        source_id: res.source.id,
        source_name: res.source.name,
        source_type: res.source.type,
        region: res.source.region,
        country: res.source.country,
        language: res.source.lang,
        title: nettoyerTexte(brut.title),
        description: nettoyerTexte(brut.description).slice(0, 600),
        url: canoniserUrl(brut.url),
        published_at: publie,
        author: brut.author ? nettoyerTexte(brut.author) : null,
        image_url: brut.image_url,
        collection_method: res.source.type === 'GOOGLE_NEWS' ? 'google_news' : 'rss',
        is_aggregator: res.source.type === 'GOOGLE_NEWS' || res.source.type === 'AGGREGATOR',
        source_priority: res.source.priority,
      };

      // Une date absente n'est pas un motif de rejet : certains flux n'en
      // portent pas. On la remplace par l'heure de collecte et on le dit.
      if (!article.published_at) {
        article.published_at = debut.toISOString();
        article.published_estimated = true;
      } else if (new Date(article.published_at).getTime() < limiteBasse) {
        rejetesDate++;
        continue;
      }

      const motif = rejeteParFiltre(article);
      if (motif) { rejetesFiltre++; continue; }

      article.editorial_region = classerRegion(article, res.source);
      article.fingerprint = empreinte(article);
      normalises.push(article);
    }
  }

  // --- Deduplication -------------------------------------------------------
  // Trois niveaux, du plus sur au plus approximatif. A chaque rencontre, on
  // garde l'exemplaire de plus forte priorite : entre Reuters et un
  // agregateur qui le recopie, c'est Reuters qu'on transmet.
  const parCle = new Map();
  let doublonsUrl = 0;
  let doublonsEmpreinte = 0;

  const garderLeMeilleur = (cle, article, compteur) => {
    const existant = parCle.get(cle);
    if (!existant) { parCle.set(cle, article); return 0; }
    if (article.source_priority > existant.source_priority) parCle.set(cle, article);
    return compteur + 1;
  };

  for (const a of normalises) {
    const cleUrl = a.url ? `u:${a.url}` : null;
    if (cleUrl && parCle.has(cleUrl)) { doublonsUrl = garderLeMeilleur(cleUrl, a, doublonsUrl); continue; }
    const cleEmp = `f:${a.fingerprint}`;
    if (parCle.has(cleEmp)) { doublonsEmpreinte = garderLeMeilleur(cleEmp, a, doublonsEmpreinte); continue; }
    parCle.set(cleUrl || cleEmp, a);
    if (cleUrl) parCle.set(cleEmp, a); // indexe aussi par empreinte
  }

  const uniques = [...new Set(parCle.values())];

  // Niveau 3 : rapprochement des titres. Le plan le signale — « Ouattara
  // reçoit… » et « le chef de l'État ivoirien s'entretient… » sont le meme
  // evenement sous deux plumes. Le recouvrement de mots en attrape une partie ;
  // le reste releve d'AP-02, qui seul comprend le sens.
  const groupes = [];
  let doublonsSemantiques = 0;
  for (const a of uniques.sort((x, y) => y.source_priority - x.source_priority)) {
    const proche = groupes.find((g) => similarite(g.chef.title, a.title) >= reglages.similariteDoublon);
    if (proche) {
      // Une meme source peut couvrir le sujet deux fois — c'est frequent chez
      // les agregateurs, qui recopient plusieurs medias. On ne la cite qu'une
      // fois : « aussi couvert par Google News, Google News » n'apprend rien.
      if (!proche.aussi.some((x) => x.source === a.source_name)) {
        proche.aussi.push({ source: a.source_name, url: a.url });
      }
      doublonsSemantiques++;
    } else {
      groupes.push({ chef: a, aussi: [] });
    }
  }

  // --- Scoring et selection ------------------------------------------------
  const maintenant = Date.now();
  const candidats = groupes.map((g, i) => {
    const a = g.chef;
    const ageH = (maintenant - new Date(a.published_at).getTime()) / 3600000;
    // Trois termes : la source, la fraicheur, et le nombre de redactions qui
    // couvrent le sujet — un evenement repris par cinq medias merite l'examen.
    const fraicheur = Math.max(0, 12 - ageH) * 1.2;
    const reprises = Math.min(g.aussi.length, 5) * 4;
    return {
      candidate_id: `A4A-CAND-${String(i + 1).padStart(6, '0')}`,
      title: a.title,
      description: a.description,
      url: a.url,
      source: { id: a.source_id, name: a.source_name, type: a.source_type, priority: a.source_priority, is_aggregator: a.is_aggregator },
      published_at: a.published_at,
      published_estimated: a.published_estimated || false,
      country: a.country,
      region: a.editorial_region,
      language: a.language,
      collection_method: a.collection_method,
      fingerprint: a.fingerprint,
      technical_score: Math.round(a.source_priority + fraicheur + reprises),
      also_covered_by: g.aussi.slice(0, 6),
      status: 'candidate',
    };
  });

  // Quotas par region, comme demande : Claude doit avoir de quoi choisir dans
  // les trois, sans qu'une region bavarde n'ecrase les autres.
  const retenus = [];
  for (const [region, quota] of Object.entries(reglages.quotas)) {
    retenus.push(...candidats.filter((c) => c.region === region).sort((a, b) => b.technical_score - a.technical_score).slice(0, quota));
  }
  retenus.sort((a, b) => b.technical_score - a.technical_score);
  retenus.forEach((c, i) => { c.candidate_id = `A4A-CAND-${String(i + 1).padStart(6, '0')}`; });

  const fin = new Date();
  const reussies = resultats.filter((r) => r.status === 'OK').length;

  return {
    workflow_id: workflowId,
    source: 'AP-01',
    version: '1.0.0',
    generated_at: fin.toISOString(),
    collection_date: workflowId.slice(4, 14),
    status: reussies === 0 ? 'FAILED' : (erreurs.length > 0 ? 'WARNING' : 'SUCCESS'),
    quota: { cote_ivoire: 2, afrique: 2, international: 3 },
    statistics: {
      sources_attempted: sources.length,
      sources_success: reussies,
      sources_failed: sources.length - reussies,
      articles_collected: brutsCollectes,
      rejected_too_old: rejetesDate,
      rejected_by_filter: rejetesFiltre,
      articles_after_filter: normalises.length,
      duplicates_url: doublonsUrl,
      duplicates_fingerprint: doublonsEmpreinte,
      duplicates_semantic: doublonsSemantiques,
      unique_topics: candidats.length,
      candidates: retenus.length,
      by_region: {
        Cote_Ivoire: retenus.filter((c) => c.region === 'Cote_Ivoire').length,
        Afrique: retenus.filter((c) => c.region === 'Afrique').length,
        International: retenus.filter((c) => c.region === 'International').length,
      },
      duration_seconds: Math.round((fin - debut) / 1000),
    },
    errors: erreurs,
    candidates: retenus,
  };
}
