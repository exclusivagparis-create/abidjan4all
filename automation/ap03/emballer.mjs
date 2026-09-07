// Fabrique l'etape Code d'Activepieces a partir du module eprouve.
import { readFileSync, writeFileSync } from 'node:fs';
const corps = readFileSync('./verificateur.mjs', 'utf8').replace(/^export (const|function|async function) /gm, '$1 ');
const entete = `/**
 * AP-03 — Vérification · étape « Code » d'Activepieces
 *
 * Fichier ENGENDRE depuis verificateur.mjs — ne pas modifier ici, modifier la
 * source et régénérer, sinon les deux versions divergeront.
 *
 * DEPENDANCE, dans le champ packageJson de l'étape :
 *   {"dependencies":{"@anthropic-ai/sdk":"0.124.0"}}
 *
 * ENTREES :
 *   - \`selection\` : la sortie d'AP-02 ({{trigger.body}} ou {{step_1}})
 *   - \`apiKey\`    : la clé Anthropic, rangée dans un secret Activepieces
 */

`;
const pied = `

/** Point d'entrée attendu par Activepieces. */
export const code = async (inputs) => {
  return await executer(inputs?.selection, {
    cle: inputs?.apiKey,
    reglages: inputs?.reglages || undefined,
  });
};
`;
writeFileSync('./ap03-code-step.js', entete + corps + pied);
console.log('etape Code engendree :', (entete + corps + pied).length, 'caracteres');
