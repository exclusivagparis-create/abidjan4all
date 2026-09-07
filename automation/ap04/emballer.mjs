import { readFileSync, writeFileSync } from 'node:fs';
const corps = readFileSync('./redacteur.mjs', 'utf8').replace(/^export (const|function|async function) /gm, '$1 ');
const entete = `/**
 * AP-04 — Rédaction · étape « Code » d'Activepieces
 *
 * Fichier ENGENDRE depuis redacteur.mjs — ne pas modifier ici.
 *
 * DEPENDANCE, dans le champ packageJson :
 *   {"dependencies":{"@anthropic-ai/sdk":"0.124.0"}}
 *
 * ENTREES :
 *   - \`dossiers\`   : la sortie d'AP-03 ({{trigger.body}} ou {{step_1}})
 *   - \`apiKey\`     : la clé Anthropic (secret Activepieces)
 *   - \`jeton\`      : le jeton d'API du site (secret Activepieces) — nécessaire
 *                    seulement quand la simulation est désactivée
 *   - \`reglages\`   : {"simulation": false} pour déposer réellement
 *
 * PAR DEFAUT, RIEN N'EST DEPOSE. La simulation rend ce qui aurait été écrit.
 * Désactiver la simulation demande un geste délibéré — c'est voulu pour une
 * étape qui écrit dans la base d'un journal.
 */

`;
const pied = `

/** Point d'entrée attendu par Activepieces. */
export const code = async (inputs) => {
  return await executer(inputs?.dossiers, {
    cle: inputs?.apiKey,
    jeton: inputs?.jeton,
    reglages: inputs?.reglages || undefined,
  });
};
`;
writeFileSync('./ap04-code-step.js', entete + corps + pied);
console.log('etape Code engendree :', (entete + corps + pied).length, 'caracteres');
