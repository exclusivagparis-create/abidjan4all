/**
 * Eprouve AP-04. Les rubriques du site sont lues REELLEMENT ; seul le modele
 * est double, et aucun brouillon n'est depose (simulation).
 */
import { executer as rediger, controlerArticles, lireRubriques, enBlocsDuSite, fabriquerSlug } from './redacteur.mjs';

const rubriques = await lireRubriques();
console.log(`rubriques lues sur le site : ${rubriques.length} — ${rubriques.slice(0, 6).map((r) => r.slug).join(', ')}…\n`);

// --- Un jeu de dossiers AP-03, avec les quatre verdicts ---------------------
const dossier = (id, verdict, citations = []) => ({
  candidate_id: id, verdict_global: verdict, motif_verdict: 'motif',
  title: `Titre du sujet ${id}`, url: `https://exemple.test/${id}`, region: 'Cote_Ivoire',
  angle: 'un angle', points: [{ point: 'un chiffre', verdict: 'concordant', constat: 'c', sources: ['AIP', 'RFI'] }],
  faits_etablis: ['Un fait etabli par deux sources.'], citations, a_obtenir: ['une confirmation officielle'],
  base_documentaire: { sources_lues: 2, sources_consultees: 2, sources_independantes: 2, caracteres_lus: 8000, seulement_le_resume_rss: false },
});
const citationVraie = { texte: "Nous avons pris nos responsabilites des le premier jour", auteur: 'Le ministre', source: 'AIP' };
const jeu = {
  workflow_id: 'A4A-2026-09-07-120000', collection_date: '2026-09-07',
  selection_relue_par_un_modele: true, verifie_par_un_modele: true,
  dossiers: [
    dossier('A4A-CAND-000001', 'solide', [citationVraie]),
    dossier('A4A-CAND-000002', 'a_completer'),
    dossier('A4A-CAND-000003', 'fragile'),
    dossier('A4A-CAND-000004', 'non_verifie'),
  ],
};

// --- 1. Le tri par verdict --------------------------------------------------
console.log('=== CE QUI EST REDIGEABLE, ET CE QUI NE L EST PAS ===');
const article = (id, blocs) => ({
  candidate_id: id, rubrique: rubriques[0].slug, kicker: 'Cacao', title: `Un titre suffisamment long pour ${id}`,
  dek: 'Deux phrases de chapo. Voila la seconde.', blocs, tags: ['cacao'], reserves_editoriales: 'il manque une confirmation',
});
const blocsCorrects = [
  { type: 'paragraph', text: 'Premier paragraphe qui dit le fait.' },
  { type: 'paragraph', text: 'Deuxieme paragraphe qui developpe.' },
];
const doublure = async ({ journal }) => {
  journal?.('redaction simulee');
  return { texte: JSON.stringify({ articles: [article('A4A-CAND-000001', [...blocsCorrects, { type: 'quote', text: citationVraie.texte, cite: 'Le ministre' }]), article('A4A-CAND-000002', blocsCorrects)] }), usage: { input_tokens: 14000, output_tokens: 5200 } };
};
const traces = [];
const r = await rediger(jeu, { cle: 'x', appelerClaude: doublure, rubriques, journal: (m) => traces.push(m) });
console.log('  statut :', r.status, '| simulation :', r.simulation);
console.log('  rediges :', r.statistics.rediges, '| ecartes :', r.statistics.ecartes);
for (const e of r.ecartes) console.log(`    ecarte : ${e.candidate_id}  verdict=${e.verdict}`);
console.log('  journal :', traces.join(' / '));

// --- 2. La citation inventee ------------------------------------------------
console.log('\n=== LE CONTROLE DES CITATIONS ===');
const cas = [
  ['citation exacte du dossier', [{ type: 'quote', text: citationVraie.texte, cite: 'Le ministre' }]],
  ['citation reformulee de pres', [{ type: 'quote', text: 'nous avons pris nos responsabilites', cite: 'Le ministre' }]],
  ['CITATION INVENTEE', [{ type: 'quote', text: "Je demissionnerai avant la fin du mois", cite: 'Le ministre' }]],
];
for (const [nom, q] of cas) {
  const g = controlerArticles({ articles: [article('A4A-CAND-000001', [...blocsCorrects, ...q])] }, jeu.dossiers, rubriques);
  console.log(`  ${nom.padEnd(30)} ${g.length === 0 ? 'acceptee' : 'REFUSEE : ' + g[0].slice(0, 74)}`);
}

// --- 3. Les autres controles ------------------------------------------------
console.log('\n=== LES AUTRES CONTROLES ===');
for (const [nom, fabriquer] of [
  ['rubrique inexistante', () => { const a = article('A4A-CAND-000001', blocsCorrects); a.rubrique = 'rubrique-fantome'; return a; }],
  ['un seul paragraphe', () => article('A4A-CAND-000001', [blocsCorrects[0]])],
  ['titre trop court', () => { const a = article('A4A-CAND-000001', blocsCorrects); a.title = 'Court'; return a; }],
  ['dossier inconnu', () => article('A4A-CAND-999999', blocsCorrects)],
]) {
  const g = controlerArticles({ articles: [fabriquer()] }, jeu.dossiers, rubriques);
  console.log(`  ${nom.padEnd(24)} ${g.length === 0 ? 'aucun grief' : g[0].slice(0, 78)}`);
}

// --- 4. La note de redaction en tete du corps -------------------------------
console.log('\n=== CE QUI EST DEPOSE ===');
const corps = r.articles[0].depot.corps;
console.log('  slug :', corps.slug);
console.log('  temps de lecture :', corps.readingTime, 'min | blocs :', corps.body.length);
console.log('  premier bloc (' + corps.body[0].type + ') :');
for (const l of corps.body[0].text.split('\n')) console.log('      ' + l.slice(0, 96));

// --- 5. Aucun dossier redigeable -------------------------------------------
const rien = await rediger({ ...jeu, dossiers: jeu.dossiers.filter((d) => d.verdict_global === 'fragile') }, { cle: 'x', appelerClaude: doublure, rubriques });
console.log('\n=== AUCUN DOSSIER REDIGEABLE ===');
console.log('  statut :', rien.status, '| articles :', rien.articles.length, '| ecartes :', rien.ecartes.length);

// --- 6. Refus d ecrire sans modele, et sans jeton ---------------------------
console.log('\n=== REFUS ===');
const sansCle = await rediger(jeu, { cle: null, rubriques });
console.log('  sans cle    :', sansCle.status, '|', sansCle.error);
const sansJeton = await rediger(jeu, { cle: 'x', appelerClaude: doublure, rubriques, jeton: null, reglages: { simulation: false } });
console.log('  sans jeton  :', sansJeton.status, '|', (sansJeton.error || '').slice(0, 92));

// --- 7. Propagation des mentions d amont ------------------------------------
const degrade = await rediger({ ...jeu, selection_relue_par_un_modele: false, verifie_par_un_modele: false }, { cle: 'x', appelerClaude: doublure, rubriques });
console.log('\n=== PROPAGATION DES MENTIONS D AMONT ===');
console.log('  selection relue :', degrade.selection_relue_par_un_modele, '| verification par un modele :', degrade.verification_par_un_modele);

// --- 8. Cout ---------------------------------------------------------------
const e = 14000, s = 5200;
const direct = (e / 1e6) * 5 + (s / 1e6) * 25;
console.log('\n=== COUT ===');
console.log(`  direct : ${direct.toFixed(3)} $/jour (~${(direct * 30).toFixed(2)} $/mois)   lot : ${(direct / 2).toFixed(3)} $/jour (~${(direct * 30 / 2).toFixed(2)} $/mois)`);
