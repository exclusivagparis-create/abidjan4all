// Fabrique l'etape Code d'Activepieces a partir du module eprouve.
// On DERIVE plutot que de recopier : une seule source de verite, donc pas de
// version qui vieillit en silence pendant que l'autre est corrigee.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('./collecteur.mjs', 'utf8');

// L'import de crypto remonte en tete : dans un module, les imports ne peuvent
// pas rester au milieu du fichier. La regle vise TOUTE forme de cet import —
// avec ou sans prefixe, guillemets simples ou doubles. Une regle trop precise
// a deja laisse passer un doublon apres un changement de prefixe, et le module
// engendre ne se chargeait plus : « createHash has already been declared ».
let corps = src.replace(/^import \{ createHash \} from ['"](?:node:)?crypto['"];\n/m, '');
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
// IMPORTANT : « crypto », et NON « node:crypto ».
// Le bac a sable d'Activepieces rejette tout specificateur portant un schema —
// sa regle est /^[a-z][a-z0-9+.-]*:/ et « node: » en est un. La forme nue
// passe, esbuild y compilant avec platform node, qui traite les modules
// internes comme externes. Verifie dans le compilateur de l'instance apres
// l'echec des deux premieres executions du flow.
import { createHash } from 'crypto';

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
