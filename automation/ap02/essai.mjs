/**
 * Eprouve AP-02 sans cle API : le modele est remplace par une doublure qui
 * repond ce qu'on lui dit de repondre. On verifie ainsi ce que le schema NE
 * garantit PAS — identifiants inventes, quotas non respectes, region reclassee,
 * doublons — et que la reprise fonctionne.
 */
import { executer as collecter } from './collecteur.mjs';
import { executer as selectionner, validerSelection, preparerCandidats } from './selecteur.mjs';

const jeu = await collecter();
console.log(`jeu AP-01 : ${jeu.candidates.length} candidats\n`);

const parRegion = (r, n) => jeu.candidates.filter((c) => c.region === r).slice(0, n).map((c) => c.candidate_id);
const bonneReponse = () => ({
  selection: [
    ...parRegion('Cote_Ivoire', 2).map((id, i) => ({ candidate_id: id, region: 'Cote_Ivoire', angle: 'angle', justification: 'j', interet_diaspora: 'oui', reprises: [], verification_requise: ['chiffres'], priorite: i + 1 })),
    ...parRegion('Afrique', 2).map((id, i) => ({ candidate_id: id, region: 'Afrique', angle: 'angle', justification: 'j', interet_diaspora: 'aucun', reprises: [], verification_requise: [], priorite: i + 3 })),
    ...parRegion('International', 3).map((id, i) => ({ candidate_id: id, region: 'International', angle: 'angle', justification: 'j', interet_diaspora: 'oui', reprises: [], verification_requise: [], priorite: i + 5 })),
  ],
  reserves: 'aucune',
});

const cas = [
  ['reponse correcte', () => bonneReponse()],
  ['identifiant invente', () => { const r = bonneReponse(); r.selection[0].candidate_id = 'A4A-CAND-999999'; return r; }],
  ['quota non respecte', () => { const r = bonneReponse(); r.selection.pop(); return r; }],
  ['meme sujet retenu deux fois', () => { const r = bonneReponse(); r.selection[1].candidate_id = r.selection[0].candidate_id; return r; }],
  ['region reclassee a sa convenance', () => { const r = bonneReponse(); r.selection[0].region = 'International'; r.selection[6].region = 'Cote_Ivoire'; return r; }],
  ['reprise inexistante', () => { const r = bonneReponse(); r.selection[0].reprises = ['A4A-CAND-888888']; return r; }],
  ['reponse qui n est pas du JSON', () => null],
];

console.log('=== CE QUE LA VALIDATION ATTRAPE ===');
for (const [nom, fabriquer] of cas) {
  const r = fabriquer();
  const griefs = r ? validerSelection(r, jeu.candidates) : ['non applicable'];
  console.log(`  ${nom.padEnd(38)} ${griefs.length === 0 ? 'aucun grief' : griefs.length + ' grief(s) : ' + griefs[0].slice(0, 62)}`);
}

console.log('\n=== LA REPRISE FONCTIONNE-T-ELLE ? ===');
let appels = 0;
const doublure = async ({ messages }) => {
  appels++;
  // Premier appel : reponse fautive. Deuxieme : correcte — comme le ferait le
  // modele apres avoir lu le reproche.
  const r = appels === 1 ? (() => { const x = bonneReponse(); x.selection[0].candidate_id = 'A4A-CAND-999999'; return x; })() : bonneReponse();
  return { texte: JSON.stringify(r), usage: { input_tokens: 41000, output_tokens: 1200 } };
};
const res = await selectionner(jeu, { cle: 'essai', appelerClaude: doublure });
console.log('  appels au modele :', appels, '(1 fautif + 1 reprise)');
console.log('  statut           :', res.status);
console.log('  reprise signalee :', res.statistics.repaired);
console.log('  repartition      :', JSON.stringify(res.statistics.by_region));
console.log('  le reproche transmis contenait bien l identifiant fautif :',
  JSON.stringify(res.statistics.repaired));

console.log('\n=== ECHEC FRANC APRES DEUX ESSAIS RATES ===');
const toujoursFautif = async () => ({ texte: JSON.stringify((() => { const x = bonneReponse(); x.selection.pop(); return x; })()), usage: {} });
const echec = await selectionner(jeu, { cle: 'essai', appelerClaude: toujoursFautif });
console.log('  statut :', echec.status, '|', echec.error);
console.log('  griefs :', echec.griefs?.[0]);

console.log('\n=== ABSENCE DE CLE ===');
const sansCle = await selectionner(jeu, { appelerClaude: doublure, cle: null });
console.log('  statut :', sansCle.status, '|', sansCle.error);

console.log('\n=== SORTIE AP-02, PREMIER SUJET ===');
const s = res.selection[0];
console.log(JSON.stringify({ candidate_id: s.candidate_id, region: s.region, priorite: s.priorite, title: s.title?.slice(0, 70), url: s.url?.slice(0, 70), source: s.source?.name, verification_requise: s.verification_requise }, null, 1));

console.log('\n=== POIDS ENVOYE AU MODELE ===');
const compacts = preparerCandidats(jeu.candidates);
const octetsCompacts = JSON.stringify(compacts).length;
const octetsBruts = JSON.stringify(jeu.candidates).length;
console.log(`  jeu complet : ${Math.round(octetsBruts / 1024)} ko`);
console.log(`  transmis    : ${Math.round(octetsCompacts / 1024)} ko  (${Math.round(100 - 100 * octetsCompacts / octetsBruts)} % de moins)`);
console.log(`  soit environ ${Math.round(octetsCompacts / 3.6 / 1000)}k jetons d entree`);
