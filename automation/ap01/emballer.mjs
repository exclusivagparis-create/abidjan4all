// Fabrique l'etape Code d'Activepieces a partir du module eprouve.
// On DERIVE plutot que de recopier : une seule source de verite, donc pas de
// version qui vieillit en silence pendant que l'autre est corrigee.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('./collecteur.mjs', 'utf8');

// L'import de node:crypto remonte en tete : dans un module, les imports ne
// peuvent pas rester au milieu du fichier.
let corps = src.replace(/^import \{ createHash \} from 'node:crypto';\n/m, '');
corps = corps.replace(/^export (const|function|async function) /gm, '$1 ');

const entete = `/**
 * AP-01 — News Collector · étape « Code » d'Activepieces
 *
 * Fichier ENGENDRE depuis collecteur.mjs — ne pas modifier ici, modifier la
 * source et régénérer, sinon les deux versions divergeront.
 *
 * À coller dans une étape Code. Aucune dépendance npm : le champ packageJson
 * reste vide.
 */
import { createHash } from 'node:crypto';

`;

const pied = `

/**
 * Point d'entrée attendu par Activepieces.
 *
 * \`inputs\` permet de surcharger le registre et les réglages depuis l'interface
 * sans toucher au code — c'est ce qui rend le registre administrable, comme le
 * demande le plan : désactiver une source ne demande pas de rouvrir l'éditeur.
 */
export const code = async (inputs) => {
  return await executer({
    registre: inputs?.registre || undefined,
    reglages: inputs?.reglages || undefined,
  });
};
`;

writeFileSync("./ap01-code-step.js", entete + corps + pied);
console.log('etape Code engendree :', (entete + corps + pied).length, 'caracteres');
