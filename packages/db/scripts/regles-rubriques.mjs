/**
 * Reclassement des archives reprises d'abidjan4all.net.
 *
 * La reprise a versé 4 297 articles dans « Actualité », rubrique fourre-tout.
 * Ce fichier porte les règles qui les répartissent dans les 19 rubriques
 * réelles, à partir du titre, du chapeau et des mots-clés.
 *
 * Principe : un score par rubrique, et non la première règle qui correspond.
 * Un article sur « le procès Gbagbo devant la CPI » touche à la fois la
 * politique et les faits divers ; le premier-arrivé donnerait un résultat qui
 * dépend de l'ordre d'écriture des règles, ce qui n'est pas une décision mais
 * un hasard. Le score tranche, et le poids dit ce qui compte : un mot du titre
 * pèse plus qu'un mot du chapeau.
 *
 * En dessous du seuil, l'article RESTE dans « Actualité ». Une rubrique fausse
 * est pire qu'une rubrique générique : elle égare le lecteur et fausse les
 * pages de rubrique, alors qu'« Actualité » est simplement neutre.
 */

/** Poids par champ. Le titre est le plus intentionnel, les mots-clés viennent
 *  de la rédaction d'origine, le chapeau est plus bavard donc plus bruyant. */
const POIDS = { titre: 3, motsCles: 2, chapeau: 1 };

/** Score minimal pour déplacer un article hors d'« Actualité ». */
export const SEUIL = 3;

/**
 * Règles par rubrique. Les termes sont comparés sans accents ni casse, sur des
 * frontières de mots — « CAN » ne doit pas se déclencher sur « canal ».
 */
const REGLES = {
  politique: [
    "politique", "gouvernement", "ministre", "ministere", "president", "presidence",
    "election", "electorale", "presidentielle", "legislative", "senat", "assemblee nationale",
    "parti", "opposition", "rhdp", "pdci", "fpi", "ppa-ci", "gps", "cei",
    "ouattara", "gbagbo", "bedie", "soro", "affi n'guessan", "thiam", "cpi",
    "depute", "remaniement", "constitution", "referendum", "coup d'etat", "putsch",
    "diplomatie", "ambassadeur", "cedeao", "union africaine",
    // Pas « sommet » seul : « un fou au sommet d'un poteau » n'est pas de la
    // diplomatie. Le mot ne devient politique qu'accompagné.
    "sommet de l", "sommet du", "sommet des chefs", "sommet extraordinaire",
  ],
  "faits-divers": [
    "police", "gendarmerie", "gendarme", "braquage", "braqueur", "meurtre", "homicide",
    "assassinat", "arrestation", "interpelle", "interpellation", "cambriolage",
    "accident", "collision", "noye", "noyade", "incendie", "drame", "corps sans vie",
    "drogue", "stupefiant", "escroquerie", "viol", "enlevement", "kidnapping",
    "proces", "tribunal", "condamne", "prison", "justice", "parquet", "enquete judiciaire",
    "sinistre", "effondrement", "fait divers",
    // « trafic » seul attrape la circulation routière ; le trafiquant, non.
    "trafiquant", "trafic de drogue", "trafic d'enfants", "trafic d'etres humains",
    // Verbes et substantifs de la violence : sans eux, « un homme abat sa
    // femme » n'était rattrapé que par le mot « femme » et partait en
    // rubrique Femmes, ce qui est un contresens.
    "tue par", "tuee", "abattu", "poignarde", "mortellement", "cadavre", "depouille",
    "agression", "agresseur", "voleur", "bandit", "malfaiteur", "lynche", "sequestre",
  ],
  sport: [
    "football", "foot", "elephants", "match", "selection", "entraineur", "selectionneur",
    "but", "buteur", "championnat", "ligue", "can", "chan",
    "fif", "caf", "fifa", "joueur", "club", "transfert", "stade",
    "basket", "handball", "athletisme", "jeux olympiques", "olympique", "boxe",
    "asec", "africa sports", "sport",
    // « coupe » et « mondial » nus ramassaient « a coupé le contact » et
    // « réseau mondial des villes » : on les qualifie.
    "coupe du monde", "coupe d'afrique", "coupe de la ligue", "coupe nationale",
    "mondial 2018", "mondial 2022", "mondial 2026", "mondial 2030",
    "finale", "demi-finale", "quart de finale", "eliminatoires", "ligue des champions",
    "penalty", "attaquant", "gardien de but", "arbitre", "mi-temps",
  ],
  economie: [
    "economie", "economique", "budget", "finance", "fmi", "banque mondiale", "bceao",
    "croissance", "inflation", "impot", "fiscalite", "dette", "subvention",
    "prix du carburant", "pouvoir d'achat", "salaire", "smig", "emploi", "chomage",
    "commerce", "importation", "exportation", "douane", "franc cfa", "monnaie",
  ],
  "cacao-marches": [
    "cacao", "cafe", "hevea", "anacarde", "noix de cajou", "coton", "palmier a huile",
    "planteur", "producteur agricole", "filiere", "recolte", "campagne agricole",
    "conseil cafe-cacao", "brvm", "cours mondial", "matieres premieres", "agriculture",
  ],
  business: [
    "entreprise", "societe privee", "pme", "investissement", "investisseur", "patronat",
    "cgeci", "start-up", "startup", "chiffre d'affaires", "marche public", "appel d'offres",
    "partenariat", "usine", "industrie", "immobilier", "assurance",
  ],
  "tech-numerique": [
    "numerique", "internet", "application mobile", "applications mobiles", "smartphone",
    "reseaux sociaux", "instagram",
    "facebook", "whatsapp", "tiktok", "intelligence artificielle", "cybercriminalite",
    "cybersecurite", "informatique", "logiciel", "operateur telecom", "fibre optique",
    "mobile money", "innovation technologique", "startup numerique",
  ],
  culture: [
    "culture", "musique", "artiste", "chanteur", "chanteuse", "album", "concert",
    "cinema", "film", "acteur", "festival", "livre", "ecrivain", "roman", "litterature",
    "theatre", "danse", "peinture", "exposition", "patrimoine", "coupe-decale", "zouglou",
    "griot", "tradition",
  ],
  "actu-people": [
    "people", "star", "celebrite", "mariage de", "divorce", "fiancailles", "demande en mariage",
    "showbiz", "influenceuse", "influenceur", "buzz", "polemique sur les reseaux",
    // « instagram » retiré : il faisait basculer « Moscou interdit Méta et
    // Instagram » dans les potins. Le réseau social relève du numérique.
  ],
  religion: [
    "religion", "eglise", "mosquee", "pasteur", "imam", "priere", "catholique", "musulman",
    "chretien", "protestant", "evangelique", "cardinal", "eveque", "archeveque", "revered",
    "reverende", "ramadan", "careme", "pelerinage", "la mecque", "paque", "noel",
  ],
  education: [
    "ecole", "universite", "etudiant", "eleve", "enseignant", "professeur", "bac",
    "baccalaureat", "bepc", "cepe", "examen", "concours", "rentree scolaire", "education",
    "ministere de l'education", "formation professionnelle", "bourse d'etude",
  ],
  environnement: [
    "environnement", "climat", "rechauffement", "pollution", "dechet", "ordure",
    "foret", "deforestation", "reboisement", "inondation", "pluie diluvienne",
    "lagune", "biodiversite", "espece protegee", "energie renouvelable", "assainissement",
  ],
  femmes: [
    "femme", "feminin", "feminine", "genre", "maternite", "sage-femme", "grossesse",
    "violence conjugale", "excision", "droits des femmes", "autonomisation des femmes",
    "journee de la femme", "veuve", "mere celibataire",
  ],
  diaspora: [
    "diaspora", "ivoiriens de l'etranger", "expatrie", "consulat", "ambassade de cote",
    "immigration", "migrant", "visa", "titre de sejour", "rapatriement", "refugie",
  ],
  tourisme: [
    "tourisme", "touristique", "hotel", "hotellerie", "plage", "station balneaire",
    "voyage", "destination", "grand-bassam", "assinie", "parc national", "safari",
    "compagnie aerienne", "aeroport", "vol vers",
  ],
};

// Ces rubriques ne reçoivent jamais d'archive automatiquement : « Vidéos » et
// « En Direct » sont des formats, pas des sujets ; « Africa in English » se
// décide sur la langue (voir ci-dessous) ; « Actualité » est le repli.
const HORS_REGLES = ["videos", "en-direct", "africa-in-english", "actualite"];

/** Retire accents et casse pour comparer sur un pied d'égalité. */
function normaliser(texte) {
  return (texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Nombre d'occurrences d'un terme, sur frontières de mots. */
function occurrences(texte, terme) {
  const t = normaliser(terme).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const motif = new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`, "g");
  return (texte.match(motif) ?? []).length;
}

/**
 * Détecte un article rédigé en anglais — la rubrique « Africa in English » se
 * reconnaît à la langue, pas au sujet. Mots outils uniquement : ils sont
 * fréquents en anglais et quasi absents d'un texte français.
 */
function estAnglais(titre) {
  const t = normaliser(titre);
  const outils = [" the ", " of ", " and ", " to ", " in ", " for ", " with ", " on ", " is ", " as "];
  const touches = outils.filter((m) => t.includes(m)).length;
  // Deux mots outils distincts dans un titre : la coïncidence devient improbable.
  return touches >= 2 && !/ (le|la|les|des|une|dans|pour|avec|sur) /.test(t);
}

/**
 * Propose une rubrique pour un article, ou null s'il doit rester en
 * « Actualité ». Renvoie aussi le score et les termes qui ont décidé, pour que
 * la décision reste explicable — c'est ce qui permet d'auditer un lot de
 * quatre mille avant de l'appliquer.
 */
export function classer({ title, dek, tags }) {
  if (estAnglais(title)) {
    return { rubrique: "africa-in-english", score: 99, motifs: ["titre en anglais"] };
  }

  const champs = [
    { texte: normaliser(title), poids: POIDS.titre },
    { texte: normaliser((tags ?? []).join(" ")), poids: POIDS.motsCles },
    { texte: normaliser(dek), poids: POIDS.chapeau },
  ];

  let meilleure = null;
  for (const [rubrique, termes] of Object.entries(REGLES)) {
    let score = 0;
    const motifs = [];
    for (const terme of termes) {
      for (const champ of champs) {
        const n = occurrences(champ.texte, terme);
        if (n > 0) {
          score += n * champ.poids;
          if (!motifs.includes(terme)) motifs.push(terme);
        }
      }
    }
    if (score > 0 && (!meilleure || score > meilleure.score)) meilleure = { rubrique, score, motifs };
  }

  return meilleure && meilleure.score >= SEUIL ? meilleure : null;
}

export { HORS_REGLES, REGLES };
