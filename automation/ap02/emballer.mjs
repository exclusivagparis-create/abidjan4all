// Fabrique l'etape Code d'Activepieces a partir du module eprouve.
// On DERIVE plutot que de recopier : une seule source de verite.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('./selecteur.mjs', 'utf8');
const corps = src.replace(/^export (const|function|async function) /gm, '$1 ');

const entete = `/**
 * AP-02 — Sélection éditoriale · étape « Code » d'Activepieces
 *
 * Fichier ENGENDRE depuis selecteur.mjs — ne pas modifier ici, modifier la
 * source et régénérer, sinon les deux versions divergeront.
 *
 * DEPENDANCE. Coller ceci dans le champ packageJson de l'étape :
 *   {"dependencies":{"@anthropic-ai/sdk":"0.124.0"}}
 * Version épinglée, et non « ^0.124.0 » : sur un flux quotidien, une mise à
 * jour mineure qui change un comportement passerait inaperçue jusqu'au jour où
 * la sélection casse.
 *
 * ENTREES de l'étape :
 *   - \`dataset\`  : la sortie d'AP-01 (souvent {{step_1}} ou {{trigger.body}})
 *   - \`apiKey\`   : la clé Anthropic — à ranger dans un secret Activepieces,
 *                  jamais en clair dans le champ.
 */

`;

const pied = `

/** Point d'entrée attendu par Activepieces. */
export const code = async (inputs) => {
  return await executer(inputs?.dataset, {
    cle: inputs?.apiKey,
    reglages: inputs?.reglages || undefined,
  });
};
`;

writeFileSync('./ap02-code-step.js', entete + corps + pied);
console.log('etape Code engendree :', (entete + corps + pied).length, 'caracteres');
