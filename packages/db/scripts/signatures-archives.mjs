/**
 * Lecture des signatures dans le corps des articles repris d'abidjan4all.net.
 *
 * L'import a attribué les 4 263 archives à Georges AKA, faute de champ auteur
 * dans la source. Mais la signature est là, en clair : la rédaction la posait
 * en dernier paragraphe. « Norbert Nkaka », « Osmose Kahiga ( Correspondant
 * régional) », « Une correspondance de Madouce Boniking ».
 *
 * Ce fichier ne devine rien. Il reconnaît une liste de signataires écrite en
 * toutes lettres, avec leurs variantes d'orthographe relevées sur la base ;
 * tout le reste est laissé de côté et signalé. Attribuer un article au mauvais
 * journaliste est pire que de le laisser à l'administration : la signature
 * engage une personne réelle.
 */

/**
 * Signataires reconnus. `variantes` liste les orthographes RÉELLEMENT
 * rencontrées — « Norbert N'Kaka », « Norbert NKaka », « Norbert N'kaka » sont
 * la même personne sous trois plumes de saisie.
 *
 * `compte` désigne le nom exact d'un utilisateur existant, quand la personne a
 * déjà un compte sous une autre forme de son nom. Sinon le compte est créé.
 */
export const SIGNATAIRES = [
  {
    cle: "norbert-nkaka",
    nom: "Norbert Nkaka",
    // « Koffi NKaka Norbert » est le nom civil du signataire (ordre ivoirien,
    // nom de famille en tête) ; « Norbert Nkaka » est sa signature. Georges
    // l'a confirmé le 2026-08-20. Le rapprochement compte : 1 419 articles en
    // dépendent, et deux fiches pour une même personne couperaient sa
    // signature en deux sur le site.
    compte: "Koffi NKaka Norbert",
    variantes: [/^norbert\s*n['’]?kaka$/i],
  },
  { cle: "osmose-kahiga", nom: "Osmose Kahiga", variantes: [/^osmose\s*kahiga$/i] },
  { cle: "serge-bry", nom: "Serge Bry", variantes: [/^serge\s*bry$/i] },
  { cle: "junior-gnapie", nom: "Junior Gnapié", compte: "Junior Gnapié", variantes: [/^junior\s*gnapi[ée]$/i] },
  { cle: "houa-k", nom: "Houa K.", variantes: [/^houa\s*k\.?$/i] },
  {
    cle: "madouce-boniking",
    nom: "Madouce Boniking",
    // Signe dans les deux ordres, et parfois suivi du lieu (« à Gagnoa »).
    variantes: [/^madouce\s*boniking$/i, /^boniking\s*madouce$/i],
  },
  { cle: "koffi-ange", nom: "Koffi Ange", variantes: [/^koffi\s*ange$/i] },
  { cle: "ange-colombe", nom: "Ange Colombe", variantes: [/^ange\s*colombe$/i] },
  { cle: "herman-bleoue", nom: "Herman Bléoué", variantes: [/^herman\s*bl[ée]ou[ée]$/i] },
];

/**
 * Mentions qui ne désignent personne. « Une correspondance particulière » dit
 * qu'un article vient d'un contributeur extérieur non nommé : lui inventer un
 * auteur serait une signature fausse.
 */
const ANONYMES = [/^\(?\s*(une\s+)?correspondance\s+particuli[èe]re\s*\)?$/i, /^(une\s+)?correspondance$/i];

/**
 * Sigles de la maison — « M2K », « R.A ». Reconnus pour être COMPTÉS, jamais
 * attribués : un sigle n'est pas un nom, et seule la rédaction sait qui se
 * cache derrière. Ils sont rapportés à part.
 */
export const SIGLES = [/^m2k$/i, /^r\.?\s*a\.?$/i, /^b\.?v\.?$/i];

/** Annotations de fonction ou de source, à retirer avant reconnaissance. */
function nettoyer(texte) {
  return (
    texte
      // « Une correspondance de X », « Correspondance de X » → X
      .replace(/^\(?\s*(une\s+)?correspondance\s+(particuli[èe]re\s+)?de\s+/i, "")
      // Tout ce qui suit une parenthèse : fonction (« ( Correspondant régional) »),
      // source (« ( Info : Osmose Kahiga) »), contribution. L'auteur est devant.
      .replace(/\s*\(.*$/s, "")
      // Fonction accolée sans parenthèses, ou lieu de reportage.
      .replace(/[,\s]+(envoy[ée]\s*sp[ée]cial(e)?|stagiaire|correspondant(e)?(\s+r[ée]gional(e)?)?)\s*$/i, "")
      .replace(/\s+[àa]\s+[A-ZÉÈÀ][\p{L}-]+\s*$/u, "")
      .replace(/\s+avec\s+sercom\s*$/i, "")
      .replace(/^[\s.,;:—–-]+|[\s.,;:—–-]+$/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Dernier paragraphe non vide d'un corps d'article. */
function dernierParagraphe(body) {
  if (!Array.isArray(body)) return null;
  for (let i = body.length - 1; i >= 0; i--) {
    const b = body[i];
    if (b?.type !== "paragraph" || typeof b.text !== "string") continue;
    const t = b.text.trim();
    if (t.length > 0) return t;
  }
  return null;
}

function reconnaitre(candidat) {
  for (const s of SIGNATAIRES) {
    if (s.variantes.some((v) => v.test(candidat))) return s;
  }
  return null;
}

/**
 * Signature d'un article.
 *
 * @returns {{ type: "signataire", signataire: object }
 *         | { type: "anonyme" | "sigle" | "inconnu", texte: string }
 *         | null}
 */
export function lireSignature(body) {
  const fin = dernierParagraphe(body);
  if (!fin) return null;

  // Paragraphe long : ce n'est pas une ligne de signature, mais la rédaction
  // colle parfois le nom à la fin du dernier paragraphe. On ne regarde alors
  // que sa queue, et seulement pour y trouver un nom déjà connu — chercher
  // large dans un texte suivi produirait des faux positifs à la pelle.
  if (fin.length > 80) {
    const queue = nettoyer(fin.slice(-40));
    const morceaux = queue.split(/\s{2,}|[.!?]\s+/).filter(Boolean);
    const dernier = morceaux[morceaux.length - 1]?.trim();
    if (!dernier) return null;
    const s = reconnaitre(dernier);
    return s ? { type: "signataire", signataire: s } : null;
  }

  const candidat = nettoyer(fin);
  if (!candidat) return null;
  if (ANONYMES.some((r) => r.test(fin.trim()) || r.test(candidat))) return { type: "anonyme", texte: fin };
  if (SIGLES.some((r) => r.test(candidat))) return { type: "sigle", texte: candidat };

  const s = reconnaitre(candidat);
  if (s) return { type: "signataire", signataire: s };

  // Un paragraphe court qui n'est pas une signature — souvent la dernière
  // phrase d'un article bref. Rapporté sans être utilisé.
  return { type: "inconnu", texte: candidat };
}
