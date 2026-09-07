/**
 * Eprouve AP-01b sans cle API. Le jeu d'AP-01 est REEL ; seul le modele est
 * double. On verifie surtout ce qui protege du pire defaut possible ici : des
 * URL inventees, des pages d'accueil prises pour des articles, et des doublons
 * de ce que les flux ont deja rapporte.
 */
import { executer as collecter } from '../ap01/collecteur.mjs';
import * as outils from '../ap01/collecteur.mjs';
import { executer as chercher, urlDArticle, controlerTrouvailles } from './recherche-web.mjs';

const jeu = await collecter();
console.log(`jeu AP-01 : ${jeu.candidates.length} candidats\n`);

// --- 1. Ce qui est une URL d article, et ce qui n en est pas ---------------
console.log('=== RECONNAISSANCE D UNE URL D ARTICLE ===');
for (const [u, attendu] of [
  ['https://www.koaci.com/article/2026/09/07/cote-divoire/politique/le-titre-de-l-article_123456.html', true],
  ['https://www.koaci.com/', false],
  ['https://www.koaci.com', false],
  ['https://www.fratmat.info/politique', false],
  ['https://www.fratmat.info/article/456789/politique/un-titre-assez-long-pour-etre-un-slug', true],
  ['javascript:alert(1)', false],
  ['pas une url du tout', false],
]) {
  const obtenu = urlDArticle(u);
  console.log(`  ${obtenu === attendu ? 'OK   ' : 'ECHEC'} ${String(obtenu).padEnd(6)} ${u.slice(0, 76)}`);
}

// --- 2. Le controle des trouvailles ----------------------------------------
console.log('\n=== CE QUE LE CONTROLE ECARTE ===');
const dejaLa = jeu.candidates[0];
const trouvailles = [
  { titre: 'Un vrai sujet ivoirien absent des flux', url: 'https://www.koaci.com/article/2026/09/07/cote-divoire/economie/cacao-prix-bord-champ_987654.html', source: 'Koaci', region: 'Cote_Ivoire', publie: new Date().toISOString(), resume: 'r', apport: 'a' },
  { titre: 'Page d accueil prise pour un article', url: 'https://www.koaci.com/', source: 'Koaci', region: 'Cote_Ivoire', publie: new Date().toISOString(), resume: 'r', apport: 'a' },
  { titre: dejaLa.title, url: 'https://autre-site.example/article/quelque-chose-de-long-ici', source: 'Autre', region: dejaLa.region, publie: new Date().toISOString(), resume: 'r', apport: 'a' },
  { titre: 'Article deja collecte par les flux', url: dejaLa.url, source: 'Doublon', region: dejaLa.region, publie: new Date().toISOString(), resume: 'r', apport: 'a' },
  { titre: 'Un article de l an dernier', url: 'https://www.fratmat.info/article/111/politique/un-vieux-sujet-de-l-annee-passee', source: 'Fratmat', region: 'Cote_Ivoire', publie: '2025-01-15T10:00:00Z', resume: 'r', apport: 'a' },
  { titre: 'Un vrai sujet ivoirien absent des flux', url: 'https://www.koaci.com/article/2026/09/07/cote-divoire/economie/cacao-prix-bord-champ_987654.html', source: 'Koaci', region: 'Cote_Ivoire', publie: new Date().toISOString(), resume: 'r', apport: 'a' },
];
const { retenues, ecartees } = controlerTrouvailles(trouvailles, jeu, outils);
console.log(`  proposees ${trouvailles.length} | retenues ${retenues.length} | ecartees ${ecartees.length}`);
for (const e of ecartees) console.log(`    ecartee : ${e.motif.padEnd(42)} ${e.titre.slice(0, 44)}`);

// --- 3. Le pipeline complet, avec doublure ---------------------------------
console.log('\n=== PIPELINE, AVEC UNE DOUBLURE QUI TROUVE 2 ARTICLES ===');
const doublure = async ({ journal }) => {
  journal?.('recherche simulee');
  return {
    texte: JSON.stringify({ trouvailles: trouvailles.slice(0, 2), remarques: 'aucune' }),
    usage: { input_tokens: 9000, output_tokens: 2200, server_tool_use: { web_search_requests: 6 } },
  };
};
const traces = [];
const enrichi = await chercher(jeu, { cle: 'x', appelerClaude: doublure, outils, journal: (m) => traces.push(m) });
console.log('  statut :', enrichi.recherche_web.statut);
console.log('  candidats :', jeu.candidates.length, '->', enrichi.candidates.length);
console.log('  recherches facturees :', enrichi.recherche_web.recherches_facturees, '| cout :', enrichi.recherche_web.cout_recherches_usd, '$');
const neuf = enrichi.candidates.find((c) => c.source.type === 'RECHERCHE_WEB');
console.log('  le candidat ajoute :', JSON.stringify({ id: neuf.candidate_id, source: neuf.source.name, primaire: neuf.source.is_primary, piste: neuf.piste_a_verifier, score: neuf.technical_score }));
console.log('  journal :', traces.join(' / '));

// --- 4. L echec ne casse jamais la chaine ----------------------------------
console.log('\n=== L ECHEC LAISSE PASSER LE JEU INTACT ===');
for (const [nom, opts] of [
  ['cle absente', { cle: null, outils }],
  ['API en panne', { cle: 'x', outils, appelerClaude: async () => { throw new Error('529 overloaded_error'); } }],
  ['reponse illisible', { cle: 'x', outils, appelerClaude: async () => ({ texte: 'Voici ce que j ai trouve :', usage: {} }) }],
  ['aucune trouvaille', { cle: 'x', outils, appelerClaude: async () => ({ texte: JSON.stringify({ trouvailles: [], remarques: 'rien de neuf' }), usage: {} }) }],
]) {
  const r = await chercher(jeu, opts);
  const intact = r.candidates.length === jeu.candidates.length;
  console.log(`  ${nom.padEnd(20)} statut=${(r.recherche_web.statut).padEnd(8)} candidats intacts=${intact}  ${(r.recherche_web.motif || r.recherche_web.remarques || '').slice(0, 52)}`);
}

// --- 5. Cout ---------------------------------------------------------------
console.log('\n=== COUT ESTIME PAR EXECUTION ===');
const jetonsEntree = 9000, jetonsSortie = 2200, recherches = 8;
const direct = (jetonsEntree / 1e6) * 5 + (jetonsSortie / 1e6) * 25 + recherches * 0.01;
console.log(`  ${recherches} recherches a 0,01 $ = ${(recherches * 0.01).toFixed(2)} $ (meme prix en lot)`);
console.log(`  direct : ${direct.toFixed(3)} $/jour (~${(direct * 30).toFixed(2)} $/mois)`);
console.log(`  lot    : ${((direct - recherches * 0.01) / 2 + recherches * 0.01).toFixed(3)} $/jour (~${(((direct - recherches * 0.01) / 2 + recherches * 0.01) * 30).toFixed(2)} $/mois)`);
