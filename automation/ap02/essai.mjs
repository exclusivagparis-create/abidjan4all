/**
 * Eprouve AP-02 sans cle API : le modele est remplace par une doublure.
 * On verifie ce que le schema NE garantit PAS, la reprise, les deux modes, et
 * surtout que le repli prend la main dans chacun des cas ou le modele est hors
 * d'atteinte — sans jamais se faire passer pour une selection relue.
 */
import { executer as collecter } from '../ap01/collecteur.mjs';
import { executer as selectionner, validerSelection, preparerCandidats } from './selecteur.mjs';

const jeu = await collecter();
console.log(`jeu AP-01 : ${jeu.candidates.length} candidats\n`);

const parRegion = (r, n) => jeu.candidates.filter((c) => c.region === r).slice(0, n).map((c) => c.candidate_id);
const bonneReponse = () => ({
  selection: [
    ...parRegion('Cote_Ivoire', 2).map((id, i) => ({ candidate_id: id, region: 'Cote_Ivoire', angle: 'a', justification: 'j', interet_diaspora: 'oui', reprises: [], verification_requise: ['chiffres'], priorite: i + 1 })),
    ...parRegion('Afrique', 2).map((id, i) => ({ candidate_id: id, region: 'Afrique', angle: 'a', justification: 'j', interet_diaspora: 'aucun', reprises: [], verification_requise: [], priorite: i + 3 })),
    ...parRegion('International', 3).map((id, i) => ({ candidate_id: id, region: 'International', angle: 'a', justification: 'j', interet_diaspora: 'oui', reprises: [], verification_requise: [], priorite: i + 5 })),
  ],
  reserves: 'aucune',
});

// --- 1. Ce que la validation attrape ---------------------------------------
const cas = [
  ['reponse correcte', () => bonneReponse()],
  ['identifiant invente', () => { const r = bonneReponse(); r.selection[0].candidate_id = 'A4A-CAND-999999'; return r; }],
  ['quota non respecte', () => { const r = bonneReponse(); r.selection.pop(); return r; }],
  ['meme sujet retenu deux fois', () => { const r = bonneReponse(); r.selection[1].candidate_id = r.selection[0].candidate_id; return r; }],
  ['region reclassee a sa convenance', () => { const r = bonneReponse(); r.selection[0].region = 'International'; r.selection[6].region = 'Cote_Ivoire'; return r; }],
  ['reprise inexistante', () => { const r = bonneReponse(); r.selection[0].reprises = ['A4A-CAND-888888']; return r; }],
];
console.log('=== CE QUE LA VALIDATION ATTRAPE ===');
for (const [nom, fabriquer] of cas) {
  const griefs = validerSelection(fabriquer(), jeu.candidates);
  console.log(`  ${nom.padEnd(36)} ${griefs.length === 0 ? 'aucun grief' : griefs.length + ' : ' + griefs[0].slice(0, 58)}`);
}

// --- 2. Reprise -------------------------------------------------------------
console.log('\n=== REPRISE ===');
let appels = 0;
const doublureReprise = async () => {
  appels++;
  const r = appels === 1 ? (() => { const x = bonneReponse(); x.selection[0].candidate_id = 'A4A-CAND-999999'; return x; })() : bonneReponse();
  return { texte: JSON.stringify(r), usage: { input_tokens: 21000, output_tokens: 1200 } };
};
const r1 = await selectionner(jeu, { cle: 'x', appelerClaude: doublureReprise });
console.log(`  appels : ${appels} | statut : ${r1.status} | reprise : ${r1.statistics.repaired} | relue : ${r1.relue_par_un_modele}`);

// --- 3. Les quatre chemins vers le repli ------------------------------------
console.log('\n=== LES QUATRE CHEMINS VERS LE REPLI ===');
const erreurLot = () => { const e = new Error("le lot msgbatch_ABC n'a pas abouti dans le délai accordé (45 min)"); e.batchId = 'msgbatch_ABC'; e.lotEnCours = true; return e; };
const chemins = [
  ['cle absente', { cle: null, appelerClaude: doublureReprise }],
  ['API en panne', { cle: 'x', appelerClaude: async () => { throw new Error('529 overloaded_error'); } }],
  ['lot trop lent', { cle: 'x', appelerClaude: async () => { throw erreurLot(); } }],
  ['selection invalide meme apres reprise', { cle: 'x', appelerClaude: async () => ({ texte: JSON.stringify((() => { const x = bonneReponse(); x.selection.pop(); return x; })()), usage: {} }) }],
];
for (const [nom, opts] of chemins) {
  const r = await selectionner(jeu, opts);
  console.log(`  ${nom.padEnd(38)} ${r.status.padEnd(9)} mode=${(r.mode || '-').padEnd(6)} relue=${r.relue_par_un_modele} ${r.statistics?.batch_id ? '| lot conserve : ' + r.statistics.batch_id : ''}`);
  console.log(`      motif : ${(r.motif_repli || '').slice(0, 92)}`);
}

// --- 4. La sortie de repli est-elle honnete ? -------------------------------
console.log('\n=== HONNETETE DE LA SORTIE DE REPLI ===');
const repli = await selectionner(jeu, { cle: null });
const s = repli.selection[0];
console.log('  statut               :', repli.status);
console.log('  relue_par_un_modele  :', repli.relue_par_un_modele);
console.log('  model                :', repli.model);
console.log('  repartition          :', JSON.stringify(repli.statistics.by_region));
console.log('  angle du 1er sujet   :', s.angle);
console.log('  justification        :', s.justification);
console.log('  verification_requise :', s.verification_requise[0].slice(0, 96));
console.log('  le sujet garde bien son titre et son URL :', Boolean(s.title && s.url));

// --- 5. Repli interdit ------------------------------------------------------
const sansRepli = await selectionner(jeu, { cle: null, reglages: { repliAutorise: false } });
console.log('\n=== REPLI INTERDIT ===');
console.log('  statut :', sansRepli.status, '|', sansRepli.error?.slice(0, 70));

// --- 6. Mode lot ------------------------------------------------------------
console.log('\n=== MODE LOT (doublure : le lot aboutit) ===');
const doublureLot = async ({ journal }) => {
  journal?.('lot msgbatch_XYZ soumis');
  return { texte: JSON.stringify(bonneReponse()), usage: { input_tokens: 21000, output_tokens: 1200 }, batchId: 'msgbatch_XYZ' };
};
const traces = [];
const r6 = await selectionner(jeu, { cle: 'x', appelerClaude: doublureLot, journal: (m) => traces.push(m) });
console.log(`  statut : ${r6.status} | mode : ${r6.mode} | lot : ${r6.statistics.batch_id} | journal : ${traces.join(' / ')}`);

// --- 7. Chargement et cout --------------------------------------------------
const compacts = preparerCandidats(jeu.candidates);
const o = JSON.stringify(compacts).length;
const jetons = Math.round(o / 3.6);
console.log('\n=== CHARGEMENT ET COUT ===');
console.log(`  transmis : ${Math.round(o / 1024)} ko, soit ~${Math.round(jetons / 1000)}k jetons d entree`);
const prixDirect = (jetons / 1e6) * 5 + (2000 / 1e6) * 25;
console.log(`  direct : ${prixDirect.toFixed(3)} $/jour  soit ~${(prixDirect * 30).toFixed(2)} $/mois`);
console.log(`  lot    : ${(prixDirect / 2).toFixed(3)} $/jour  soit ~${(prixDirect * 30 / 2).toFixed(2)} $/mois`);
