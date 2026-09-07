import { readFileSync, writeFileSync } from 'node:fs';
// AP-01b importe les outils d'AP-01. Dans une etape Activepieces il n'y a pas
// de systeme de fichiers partage : les trois fonctions necessaires sont donc
// recopiees dans l'etape, prises telles quelles a la source pour qu'elles ne
// puissent pas diverger.
const ap01 = readFileSync('../ap01/collecteur.mjs', 'utf8');
const prendre = (nom) => {
  const i = ap01.indexOf(`export function ${nom}(`);
  if (i < 0) throw new Error(`fonction ${nom} introuvable dans AP-01`);
  let n = 0, j = ap01.indexOf('{', i);
  for (let k = j; k < ap01.length; k++) {
    if (ap01[k] === '{') n++;
    else if (ap01[k] === '}') { n--; if (n === 0) return ap01.slice(i, k + 1).replace(/^export /, ''); }
  }
  throw new Error(`fin de ${nom} introuvable`);
};
const dep = ['canoniserUrl', 'titreNormalise', 'similarite', 'empreinte'].map(prendre).join('\n\n');
const vides = ap01.match(/const VIDES = new Set\([\s\S]*?\);/)[0];
const corps = readFileSync('./recherche-web.mjs', 'utf8')
  .replace(/^export (const|function|async function) /gm, '$1 ')
  .replace(/  const outils = options\.outils \|\| await import\('\.\.\/ap01\/collecteur\.mjs'\);/,
           '  const outils = options.outils || OUTILS_AP01;');

const entete = `/**
 * AP-01b — Recherche web · étape « Code » d'Activepieces
 *
 * Fichier ENGENDRE depuis recherche-web.mjs — ne pas modifier ici.
 *
 * DEPENDANCE, dans le champ packageJson :
 *   {"dependencies":{"@anthropic-ai/sdk":"0.124.0"}}
 *
 * ENTREES :
 *   - \`dataset\` : la sortie d'AP-01 ({{step_1}} ou {{trigger.body}})
 *   - \`apiKey\`  : la clé Anthropic, rangée dans un secret Activepieces
 *
 * Se place ENTRE AP-01 et AP-02, et rend le jeu enrichi.
 */

// IMPORTANT : « crypto », et NON « node:crypto ».
// Le bac a sable d'Activepieces rejette tout specificateur portant un schema —
// sa regle est /^[a-z][a-z0-9+.-]*:/ et « node: » en est un. La forme nue
// passe, esbuild y compilant avec platform node, qui traite les modules
// internes comme externes. Verifie dans le compilateur de l'instance apres
// l'echec des deux premieres executions du flow.
import { createHash } from 'crypto';

// --- Outils repris d'AP-01, a l'identique -----------------------------------
// Canoniser une URL et rapprocher deux titres doivent se faire EXACTEMENT de
// la meme facon des deux cotes, sinon un doublon passe entre les mailles.
${vides}

${dep}

const OUTILS_AP01 = { canoniserUrl, similarite, empreinte, titreNormalise };

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
writeFileSync('./ap01b-code-step.js', entete + corps + pied);
console.log('etape Code engendree :', (entete + corps + pied).length, 'caracteres');
