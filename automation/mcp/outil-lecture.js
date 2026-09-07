/**
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
 * `texte`, `partiel` (chapô libre d'un site payant), `payant` (HTTP 402),
 * `protege` (page d'attente anti-robot), `agregateur` (lien Google News
 * encodé), `injoignable`.
 *
 * Aucun paywall n'est contourné : un refus est rapporté comme un refus.
 */

const REGLAGES = { delaiPageMs: 15000, parallelisme: 4, maxUrls: 10, maxCarsParTexte: 6000 };

const UA = 'Mozilla/5.0 (compatible; Abidjan4all-Verifier/1.0; +https://abidjan4all.info)';

/** Mots qui trahissent un article tronqué derrière un abonnement. */
const MOTS_PAYANTS = /(article r[eé]serv[eé] aux abonn|d[eé]j[aà] abonn|s.abonner pour lire|acc[eé]dez [aà] l.int[eé]gralit|subscribe to (read|continue))/i;

/** Page d'attente anti-robot : la classe `isloading` en est la signature. */
const PAGE_ATTENTE = /<html[^>]*class="[^"]*isloading|just a moment|checking your browser|enable javascript to continue/i;

function extraireTexte(html) {
  // Retire ce qui n'est jamais du texte d'article AVANT de chercher les
  // paragraphes : une extraction naïve ramène les menus, les pieds de page et
  // les bandeaux de consentement, qui pollueraient le recoupement.
  const h = html.replace(/<(script|style|nav|header|footer|aside|form|figcaption)[\s\S]*?<\/\1>/gi, ' ');
  const paras = [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => m[1].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 60);
  return paras.join('\n\n');
}

async function recupererTexte(url, reglages = REGLAGES) {
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

export const code = async (inputs) => {
  const urls = String(inputs?.urls || '')
    .split(/[\n,;]+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u))
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
