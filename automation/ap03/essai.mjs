/**
 * Eprouve AP-03. La RECUPERATION DES PAGES EST REELLE — vraies URL, vrais
 * paywalls, vraies pages anti-robot. Seul le modele est double.
 */
import { executer as collecter } from '../ap01/collecteur.mjs';
import { executer as selectionner } from '../ap02/selecteur.mjs';
import { executer as verifier, recupererTexte, validerDossiers } from './verificateur.mjs';

const jeu = await collecter();
// Selection de repli : elle ne demande pas de cle et donne sept vrais sujets.
const choix = await selectionner(jeu, { cle: null });
console.log(`AP-01 : ${jeu.candidates.length} candidats  ->  AP-02 (repli) : ${choix.selection.length} sujets\n`);

// --- 1. Les etats de recuperation, sur de vraies pages ---------------------
console.log('=== ETATS DE RECUPERATION, SUR DE VRAIES PAGES ===');
const echantillon = [
  ['un media qui laisse lire', jeu.candidates.find((c) => c.source.id === 'rfi-afrique')?.url],
  ['Le Monde (payant)', jeu.candidates.find((c) => c.source.id === 'lemonde-intl')?.url],
  ['un site ivoirien protege', jeu.candidates.find((c) => c.source.id === 'linfodrome')?.url],
  ['un lien Google News', jeu.candidates.find((c) => c.source.is_aggregator)?.url],
  ['une URL qui n existe pas', 'https://abidjan4all.info/cette-page-n-existe-pas-du-tout'],
];
for (const [nom, url] of echantillon) {
  if (!url) { console.log(`  ${nom.padEnd(28)} (absent du jeu)`); continue; }
  const r = await recupererTexte(url);
  console.log(`  ${nom.padEnd(28)} ${r.statut.padEnd(12)} ${String(r.longueur).padStart(6)} car.  ${r.motif ?? ''}`);
}

// --- 2. Le dossier complet, avec recuperation reelle ------------------------
console.log('\n=== DOSSIER DE REPLI (recuperation reelle, aucun modele) ===');
const traces = [];
const repli = await verifier(choix, { cle: null, journal: (m) => traces.push(m) });
console.log('  statut :', repli.status, '| verifie_par_un_modele :', repli.verifie_par_un_modele);
console.log('  selection_relue_par_un_modele :', repli.selection_relue_par_un_modele, '(propage depuis AP-02)');
console.log('  statistiques :', JSON.stringify(repli.statistics));
console.log('\n  base documentaire par sujet :');
for (const d of repli.dossiers) {
  const b = d.base_documentaire;
  console.log(`    ${d.candidate_id}  ${String(b.sources_lues) + '/' + b.sources_consultees} lues, ${b.sources_independantes} domaine(s), ${String(b.caracteres_lus).padStart(6)} car.${b.seulement_le_resume_rss ? '   AUCUN TEXTE' : ''}`);
  console.log(`        ${b.detail.map((x) => x.source + ':' + x.statut).join(' | ').slice(0, 110)}`);
}

// --- 3. Ce que la validation attrape ---------------------------------------
console.log('\n=== CE QUE LA VALIDATION ATTRAPE ===');
const bases = new Map(repli.dossiers.map((d) => [d.candidate_id, d.base_documentaire]));
const bon = () => ({ dossiers: choix.selection.map((s) => ({
  candidate_id: s.candidate_id, verdict_global: 'a_completer', motif_verdict: 'm',
  points: [{ point: 'p', verdict: 'concordant', constat: 'c', sources: ['RFI', 'BBC'] }],
  faits_etablis: [], citations: [], a_obtenir: [],
})) });
const sansTexte = repli.dossiers.find((d) => d.base_documentaire.seulement_le_resume_rss);
const cas = [
  ['reponse correcte', () => bon()],
  ['un sujet oublie', () => { const r = bon(); r.dossiers.pop(); return r; }],
  ['dossier pour un sujet inconnu', () => { const r = bon(); r.dossiers[0].candidate_id = 'A4A-CAND-999999'; return r; }],
  ['« concordant » avec une seule source', () => { const r = bon(); r.dossiers[0].points[0].sources = ['RFI']; return r; }],
  ['« solide » sans aucun texte lu', () => { const r = bon(); const d = r.dossiers.find((x) => x.candidate_id === sansTexte?.candidate_id); if (d) d.verdict_global = 'solide'; return r; }],
];
for (const [nom, f] of cas) {
  const g = validerDossiers(f(), choix.selection, bases);
  console.log(`  ${nom.padEnd(38)} ${g.length === 0 ? 'aucun grief' : g.length + ' : ' + g[0].slice(0, 76)}`);
}
if (!sansTexte) console.log('  (aucun sujet sans texte dans ce tirage : le controle « solide sans texte » n a pas pu etre declenche)');

// --- 4. Chemins vers le repli ----------------------------------------------
console.log('\n=== CHEMINS VERS LE REPLI ===');
for (const [nom, opts] of [
  ['API en panne', { cle: 'x', appelerClaude: async () => { throw new Error('529 overloaded_error'); } }],
  ['lot trop lent', { cle: 'x', appelerClaude: async () => { const e = new Error('le lot msgbatch_Q n a pas abouti'); e.batchId = 'msgbatch_Q'; throw e; } }],
]) {
  const r = await verifier(choix, opts);
  console.log(`  ${nom.padEnd(16)} ${r.status} | verifie=${r.verifie_par_un_modele} ${r.statistics.batch_id ? '| lot conserve : ' + r.statistics.batch_id : ''}`);
}

// --- 5. Poids transmis au modele -------------------------------------------
const avecModele = await verifier(choix, { cle: 'x', appelerClaude: async ({ messages }) => {
  console.log('\n=== POIDS TRANSMIS AU MODELE ===');
  const o = messages[0].content.length;
  console.log(`  ${Math.round(o / 1024)} ko, soit ~${Math.round(o / 3.6 / 1000)}k jetons d entree`);
  const p = (o / 3.6 / 1e6) * 5 + (6000 / 1e6) * 25;
  console.log(`  direct : ${p.toFixed(3)} $/jour (~${(p * 30).toFixed(2)} $/mois)   lot : ${(p / 2).toFixed(3)} $/jour (~${(p * 30 / 2).toFixed(2)} $/mois)`);
  return { texte: JSON.stringify(bon()), usage: { input_tokens: Math.round(o / 3.6), output_tokens: 6000 } };
} });
console.log('  statut final :', avecModele.status, '| verdicts :', JSON.stringify(avecModele.statistics.par_verdict));
