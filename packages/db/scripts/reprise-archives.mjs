/**
 * Remise en état des archives reprises d'abidjan4all.net.
 *
 * La reprise a produit deux défauts, indépendants l'un de l'autre :
 *
 *  1. RUBRIQUES — 4 297 articles sur 4 299 sont tombés dans « Actualité ».
 *     La passe `--rubriques` les redistribue d'après regles-rubriques.mjs.
 *
 *  2. IMAGES — les visuels sont arrivés sous forme de Markdown `![alt](url)`
 *     déposé dans un bloc `paragraph`. Or le rendu traite `paragraph` comme du
 *     texte : le lecteur voit la syntaxe Markdown en clair au lieu de l'image.
 *     La passe `--images` promeut la première en image de une (`coverAssetId`)
 *     et convertit les suivantes en blocs `image`, que le rendu sait afficher.
 *
 *  3. DOUBLONS D'IMAGES — conséquence de la passe précédente : elle a repris
 *     les URL absolues du Markdown alors que le site travaille en relatif, ce
 *     qui a fait exister chaque fichier deux fois dans la médiathèque. La passe
 *     `--doublons-images` ramène tout au relatif et fusionne les fiches.
 *
 *  4. MÉNAGE — `--menage` efface les entrées qui ne sont pas des articles
 *     (fragments de live-blog, corps vides, page de mentions légales).
 *
 *  5. PUBLICATION — `--publier` met l'archive en ligne en lui rendant sa
 *     chronologie (voir `dates-archives.mjs`).
 *
 * Sans `--appliquer`, le script ne fait que compter et montrer — c'est le mode
 * par défaut, sur une base de quatre mille articles en production.
 *
 *   node scripts/reprise-archives.mjs --rubriques
 *   node scripts/reprise-archives.mjs --images --appliquer
 *   node scripts/reprise-archives.mjs --doublons-images --appliquer
 *   node scripts/reprise-archives.mjs --menage --publier --appliquer
 */
import { PrismaClient } from "@prisma/client";
import { classer } from "./regles-rubriques.mjs";
import { cadences, dateReconstituee, identifiantSource } from "./dates-archives.mjs";

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const APPLIQUER = args.has("--appliquer");
const LOT = 200;

/** Un paragraphe qui n'est QUE l'image : `![légende](url)`, rien d'autre. */
const IMAGE_SEULE = /^\s*!\[([^\]]*)\]\((\S+?)\)\s*$/;

function entete(titre) {
  console.log(`\n${"=".repeat(64)}\n${titre}${APPLIQUER ? "" : "   [SIMULATION]"}\n${"=".repeat(64)}`);
}

// ---------------------------------------------------------------------------
// Passe 1 — rubriques
// ---------------------------------------------------------------------------

async function passeRubriques() {
  entete("Reclassement des brouillons");

  const rubriques = await prisma.rubrique.findMany({ select: { id: true, slug: true } });
  const idParSlug = new Map(rubriques.map((r) => [r.slug, r.id]));

  const actualite = idParSlug.get("actualite");
  if (!actualite) throw new Error("Rubrique « actualite » introuvable : rien ne serait comparable.");

  // On ne touche qu'aux brouillons encore dans « Actualité ». Un article déjà
  // rangé à la main l'a été par un humain : la règle ne repasse pas derrière.
  const articles = await prisma.article.findMany({
    where: { status: "draft", rubriqueId: actualite },
    select: { id: true, title: true, dek: true, tags: true },
  });

  const parRubrique = new Map();
  const aDeplacer = [];
  for (const a of articles) {
    const verdict = classer(a);
    if (!verdict) continue;
    const cible = idParSlug.get(verdict.rubrique);
    if (!cible) continue; // rubrique absente de la base : on n'invente pas
    aDeplacer.push({ id: a.id, rubriqueId: cible });
    parRubrique.set(verdict.rubrique, (parRubrique.get(verdict.rubrique) ?? 0) + 1);
  }

  for (const [slug, n] of [...parRubrique].sort((x, y) => y[1] - x[1])) {
    console.log(`${String(n).padStart(5)} · ${slug}`);
  }
  console.log(`${String(articles.length - aDeplacer.length).padStart(5)} · (reste en Actualité)`);
  console.log(`\n${aDeplacer.length} / ${articles.length} brouillons déplacés.`);

  if (!APPLIQUER) return;

  // Regroupé par rubrique cible : un updateMany par rubrique plutôt que quatre
  // mille update unitaires.
  let fait = 0;
  const parCible = new Map();
  for (const d of aDeplacer) {
    if (!parCible.has(d.rubriqueId)) parCible.set(d.rubriqueId, []);
    parCible.get(d.rubriqueId).push(d.id);
  }
  for (const [rubriqueId, ids] of parCible) {
    for (let i = 0; i < ids.length; i += LOT) {
      const tranche = ids.slice(i, i + LOT);
      await prisma.article.updateMany({ where: { id: { in: tranche } }, data: { rubriqueId } });
      fait += tranche.length;
      process.stdout.write(`\r  écrit ${fait}/${aDeplacer.length}`);
    }
  }
  console.log("\n  terminé.");
}

// ---------------------------------------------------------------------------
// Passe 2 — images
// ---------------------------------------------------------------------------

/** MediaAsset pour une URL, réutilisé s'il existe déjà. */
async function asset(url, alt, uploadedById, cache) {
  const connu = cache.get(url);
  if (connu) return connu;

  const existant = await prisma.mediaAsset.findFirst({ where: { url }, select: { id: true } });
  const id = existant
    ? existant.id
    : (
        await prisma.mediaAsset.create({
          data: { type: "image", url, alt: alt || null, tags: ["archive"], uploadedById },
          select: { id: true },
        })
      ).id;

  cache.set(url, id);
  return id;
}

async function passeImages() {
  entete("Images des archives : Markdown → image de une + blocs image");

  const articles = await prisma.article.findMany({
    where: { status: "draft" },
    select: { id: true, slug: true, body: true, coverAssetId: true, authorId: true },
  });

  const cache = new Map();
  let concernes = 0;
  let couvertures = 0;
  let blocs = 0;
  let traites = 0;

  for (const a of articles) {
    if (!Array.isArray(a.body)) continue;

    // Repère les paragraphes qui ne sont qu'une image, dans l'ordre du corps.
    const trouvees = [];
    for (let i = 0; i < a.body.length; i++) {
      const bloc = a.body[i];
      if (!bloc || bloc.type !== "paragraph" || typeof bloc.text !== "string") continue;
      const m = IMAGE_SEULE.exec(bloc.text);
      if (m) trouvees.push({ index: i, alt: m[1], url: m[2] });
    }
    if (trouvees.length === 0) continue;
    concernes++;

    // La première image devient l'image de une — c'est la place qu'elle
    // occupait en tête d'article sur le site d'origine. Sauf si l'article en a
    // déjà une : une couverture posée à la main prime sur une règle.
    const premiere = a.coverAssetId ? null : trouvees[0];
    const enBlocs = premiere ? trouvees.slice(1) : trouvees;

    const nouveauCorps = [];
    for (let i = 0; i < a.body.length; i++) {
      const image = trouvees.find((t) => t.index === i);
      if (!image) {
        nouveauCorps.push(a.body[i]);
        continue;
      }
      if (premiere && image.index === premiere.index) continue; // retirée : elle passe en une
      nouveauCorps.push({ type: "image", url: image.url, alt: image.alt || null });
    }

    if (!APPLIQUER) {
      if (premiere) couvertures++;
      blocs += enBlocs.length;
      if (concernes <= 3) {
        console.log(`\n  ${a.slug}`);
        if (premiere) console.log(`    une   → ${premiere.url}`);
        for (const b of enBlocs) console.log(`    bloc  → ${b.url}`);
      }
      continue;
    }

    const coverAssetId = premiere
      ? await asset(premiere.url, premiere.alt, a.authorId, cache)
      : a.coverAssetId;
    for (const b of enBlocs) await asset(b.url, b.alt, a.authorId, cache);

    await prisma.article.update({
      where: { id: a.id },
      data: { body: nouveauCorps, ...(premiere ? { coverAssetId } : {}) },
    });

    if (premiere) couvertures++;
    blocs += enBlocs.length;
    traites++;
    if (traites % 100 === 0) process.stdout.write(`\r  écrit ${traites}/${concernes}`);
  }

  console.log(`\n\n  articles concernés : ${concernes}`);
  console.log(`  images de une      : ${couvertures}`);
  console.log(`  blocs image        : ${blocs}`);
  console.log(`  médias distincts   : ${cache.size || "(simulation)"}`);
}

// ---------------------------------------------------------------------------
// Passe 3 — dédoublonnage des images
// ---------------------------------------------------------------------------

/** `https://abidjan4all.info/uploads/x.jpg` → `/uploads/x.jpg`. */
const ABSOLUE = /^https?:\/\/[^/]+(\/uploads\/.+)$/;

/**
 * La passe `--images` a écrit les URL sous la forme absolue trouvée dans le
 * Markdown d'origine, alors que tout le reste du site — téléversement,
 * médiathèque, suppression de fichier — travaille en relatif `/uploads/…`.
 * Résultat : 6 542 fichiers présents deux fois dans la médiathèque, une fois
 * sous chaque forme.
 *
 * Ce n'est pas qu'une redite visuelle. `supprimerFichier` ne reconnaît que les
 * URL relatives : un visuel effacé depuis le Studio par sa fiche absolue
 * laisserait son fichier sur le disque, indéfiniment.
 *
 * On ramène donc tout au relatif, et l'exemplaire absolu s'efface au profit de
 * celui qui existait déjà — le plus ancien, celui que la médiathèque connaît.
 */
async function passeDoublonsImages() {
  entete("Dédoublonnage des images : URL absolues → relatives");

  const medias = await prisma.mediaAsset.findMany({
    where: { url: { contains: "/uploads/" } },
    select: { id: true, url: true, createdAt: true },
  });

  // Par nom de fichier : c'est lui qui dit « même image », pas l'URL.
  const parFichier = new Map();
  for (const m of medias) {
    const relative = ABSOLUE.exec(m.url)?.[1] ?? m.url;
    if (!parFichier.has(relative)) parFichier.set(relative, []);
    parFichier.get(relative).push({ ...m, estAbsolue: ABSOLUE.test(m.url) });
  }

  const aSupprimer = []; // { absolu, garde }
  const aNormaliser = []; // { id, url } — absolus sans jumeau relatif
  for (const [relative, exemplaires] of parFichier) {
    const absolus = exemplaires.filter((e) => e.estAbsolue);
    if (absolus.length === 0) continue;
    const garde = exemplaires.find((e) => !e.estAbsolue);
    if (garde) for (const a of absolus) aSupprimer.push({ absolu: a.id, garde: garde.id });
    // Aucun jumeau : on garde la fiche, on corrige seulement sa forme d'URL.
    else for (const a of absolus) aNormaliser.push({ id: a.id, url: relative });
  }

  console.log(`  fiches médias en double : ${aSupprimer.length}`);
  console.log(`  fiches à normaliser     : ${aNormaliser.length}`);

  // Les corps d'articles citent eux aussi la forme absolue dans leurs blocs
  // image : sans cette reprise, ils pointeraient vers des fiches supprimées.
  const articles = await prisma.article.findMany({ select: { id: true, body: true } });
  const corrections = [];
  for (const a of articles) {
    if (!Array.isArray(a.body)) continue;
    let touche = false;
    const corps = a.body.map((b) => {
      if (!b || b.type !== "image" || typeof b.url !== "string") return b;
      const rel = ABSOLUE.exec(b.url)?.[1];
      if (!rel) return b;
      touche = true;
      return { ...b, url: rel };
    });
    if (touche) corrections.push({ id: a.id, body: corps });
  }
  console.log(`  blocs image à réécrire  : ${corrections.length} articles`);

  if (!APPLIQUER) return;

  // Ordre imposé par la clé étrangère : on déplace les couvertures AVANT
  // d'effacer les fiches vers lesquelles elles pointent.
  let repointees = 0;
  for (const { absolu, garde } of aSupprimer) {
    const r = await prisma.article.updateMany({
      where: { coverAssetId: absolu },
      data: { coverAssetId: garde },
    });
    repointees += r.count;
  }
  console.log(`  images de une repointées : ${repointees}`);

  for (const n of aNormaliser) {
    await prisma.mediaAsset.update({ where: { id: n.id }, data: { url: n.url } });
  }

  for (const c of corrections) {
    await prisma.article.update({ where: { id: c.id }, data: { body: c.body } });
  }

  const ids = aSupprimer.map((s) => s.absolu);
  let effacees = 0;
  for (let i = 0; i < ids.length; i += LOT) {
    const r = await prisma.mediaAsset.deleteMany({ where: { id: { in: ids.slice(i, i + LOT) } } });
    effacees += r.count;
    process.stdout.write(`\r  fiches effacées ${effacees}/${ids.length}`);
  }
  console.log("\n  terminé.");
}

// ---------------------------------------------------------------------------
// Passe 4 — ménage : ce qui n'est pas un article
// ---------------------------------------------------------------------------

/**
 * La reprise a versé dans les articles des choses qui n'en sont pas : les
 * entrées minute par minute d'un live-blog France/Allemagne, une page de
 * mentions légales, deux imports sans titre ni contenu, deux corps vides, et
 * mon propre article de diagnostic du connecteur.
 *
 * Chaque titre est écrit en toutes lettres, jamais reconnu par motif. Un
 * premier essai par expression régulière (« titre commençant par un nombre »)
 * a ramassé 43 articles parfaitement légitimes — « 100 milliards de dollars :
 * le vrai poids de la diaspora africaine », « 49 soldats ivoiriens arrêtés au
 * Mali », « 66 ans de l'Indépendance ». Sur une opération irréversible, la
 * liste explicite est la seule forme honnête.
 */
const NON_ARTICLES = [
  "Test connexion Claude — article de diagnostic MCP",
  "Mentions Légales",
  // Fragments de live-blog : le direct d'un France/Allemagne, découpé en
  // entrées qui n'ont aucun sens comme articles autonomes.
  "78' MBAPPE S'ECROULE DANS LA SURFACE,",
  "84' BUT NON VALIDE DE KARIM BENZEMA",
  "90'   Temps additionnel : 6 minutes minimum.",
  "BUT DE LA FRANCE A LA 20e MINUTE",
  "BUT DE MBAPPE NON VALIDE POUR UN HORS JEU",
  "DOMINATION NETTE DE L'ALLEMAGNE DEPUIS LA 57è",
  "FIN DU MATCH APRES 99' DE JEU : VICTOIRE DE LA FRANCE",
  "MI-TEMPS DU MATCH FRANCE/ ALLEMAGNE",
  "REPRISE DE LA SECONDE MI-TEMPS DU MACTH FRANCE/ ALLEMAGNE",
  // Corps entièrement vides : un titre, et rien derrière.
  "132 civils tués au centre du Mali: La CEDEAO réagit",
];

/** Titres de la forme « Article n°3749 » : imports sans titre ni contenu. */
const SANS_TITRE = /^Article n°\d+$/;

async function passeMenage() {
  entete("Ménage : entrées qui ne sont pas des articles");

  const candidats = await prisma.article.findMany({
    where: { status: "draft" },
    select: { id: true, slug: true, title: true, status: true, body: true },
  });

  const aEffacer = candidats.filter(
    (a) =>
      NON_ARTICLES.includes(a.title) ||
      SANS_TITRE.test(a.title) ||
      // Corps littéralement vide (`[]`) : rien à publier.
      (Array.isArray(a.body) && a.body.length === 0)
  );

  for (const a of aEffacer) console.log(`  · ${a.title.slice(0, 68)}`);
  console.log(`\n  ${aEffacer.length} entrées à effacer.`);
  if (!APPLIQUER) return;

  // Le journal d'audit exige de savoir QUI a effacé : la traçabilité n'admet
  // pas d'auteur anonyme. Un script n'est pas une personne, on l'impute donc au
  // compte d'administration, et le nom affiché dit que la main était un script.
  const responsable = await prisma.user.findFirst({
    where: { role: "admin" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!responsable) throw new Error("Aucun compte administrateur : impossible d'imputer la suppression.");

  for (const a of aEffacer) {
    // Même précaution que la suppression de masse du Studio : l'instantané
    // est écrit AVANT l'effacement, dans la même transaction. Sans lui, une
    // erreur d'appréciation sur cette liste serait sans retour.
    await prisma.$transaction(
      async (tx) => {
        const complet = await tx.article.findUnique({ where: { id: a.id } });
        await tx.articleDeletion.create({
          data: {
            snapshot: complet,
            slug: a.slug,
            title: a.title,
            status: a.status,
            deletedById: responsable.id,
            deletedByName: "Reprise des archives (script)",
            batchId: "menage-archives",
          },
        });
        await tx.comment.deleteMany({ where: { articleId: a.id } });
        await tx.liveBlog.deleteMany({ where: { articleId: a.id } });
        await tx.article.delete({ where: { id: a.id } });
      },
      { timeout: 15_000, maxWait: 10_000 }
    );
  }
  console.log("  terminé.");
}

// ---------------------------------------------------------------------------
// Passe 5 — publication de l'archive
// ---------------------------------------------------------------------------

/**
 * Articles dont le fichier image a disparu du volume d'uploads : les publier
 * afficherait une image cassée. Georges les a explicitement exclus.
 */
const FICHIERS_ABSENTS = [
  "dabou-odieux-un-patriarche-assassine-dans-sa-plantation-deux-parmi-ses-fils-soup-4",
  "66-ans-de-l-independance-a-lahou-kpanda-une-celebration-sous-le-signe-de-la-rena-4",
  "face-a-la-coree-du-sud-les-elephants-jouent-deja-leur-avenir-mondial-4",
];

/**
 * Reste de Markdown d'image tronqué à la source.
 *
 * Volontairement large : la passe `--images` a converti TOUTES les images
 * Markdown complètes en blocs `image`. Un `![` encore présent dans un
 * paragraphe est donc forcément un fragment mutilé, quel que soit l'endroit où
 * la troncature est tombée — après l'URL (`…/uploa`), ou avant même le crochet
 * fermant (`![DINER GALA DU COLLECTIF S'UNIR PO`). Une expression calquée sur
 * la première forme rencontrée laissait passer la seconde.
 */
const MARKDOWN_TRONQUE = /!\[/;

async function passePublier() {
  entete("Publication de l'archive, chronologie reconstituée");

  console.log("  cadence des segments d'ancrage (identifiants/jour) :");
  for (const c of cadences()) console.log(`    ${c.de} → ${c.a} : ${c.parJour.toLocaleString("fr-FR")}`);

  const articles = await prisma.article.findMany({
    where: { status: "draft" },
    select: { id: true, slug: true, title: true, body: true, coverAsset: { select: { url: true } } },
  });

  const aPublier = [];
  const ecartes = { sansCouverture: 0, fichierAbsent: 0, nonDatable: 0 };

  for (const a of articles) {
    if (FICHIERS_ABSENTS.includes(a.slug)) {
      ecartes.fichierAbsent++;
      continue;
    }
    // Règle métier existante du Studio : pas de couverture, pas de mise en
    // ligne. Le script ne se donne pas le droit de la contourner.
    if (!a.coverAsset?.url || a.coverAsset.url.startsWith("placeholder://")) {
      ecartes.sansCouverture++;
      continue;
    }
    const date = dateReconstituee(identifiantSource(a.coverAsset.url));
    if (!date) {
      ecartes.nonDatable++;
      continue;
    }

    // Au passage : le fragment de Markdown dont l'URL est tronquée à la source
    // ne peut pas devenir une image et s'afficherait tel quel au lecteur. Rien
    // ne s'y perd — son texte alternatif est le titre de l'article.
    const corps =
      Array.isArray(a.body) && a.body.some((b) => b?.type === "paragraph" && MARKDOWN_TRONQUE.test(b.text ?? ""))
        ? a.body.filter((b) => !(b?.type === "paragraph" && MARKDOWN_TRONQUE.test(b.text ?? "")))
        : null;

    aPublier.push({ id: a.id, date, corps });
  }

  aPublier.sort((x, y) => y.date - x.date);
  console.log(`\n  à publier        : ${aPublier.length}`);
  console.log(`  écartés — sans couverture : ${ecartes.sansCouverture}`);
  console.log(`  écartés — fichier absent  : ${ecartes.fichierAbsent}`);
  console.log(`  écartés — non datable     : ${ecartes.nonDatable}`);
  if (aPublier.length > 0) {
    const f = (d) => d.toISOString().slice(0, 10);
    console.log(`  période couverte : ${f(aPublier[aPublier.length - 1].date)} → ${f(aPublier[0].date)}`);
  }

  if (!APPLIQUER) return;

  let fait = 0;
  for (const p of aPublier) {
    await prisma.article.update({
      where: { id: p.id },
      data: { status: "published", publishedAt: p.date, ...(p.corps ? { body: p.corps } : {}) },
    });
    if (++fait % 200 === 0) process.stdout.write(`\r  publiés ${fait}/${aPublier.length}`);
  }
  console.log(`\r  publiés ${fait}/${aPublier.length}\n  terminé.`);
}

// ---------------------------------------------------------------------------
// Passe 6 — fragments de Markdown mutilés
// ---------------------------------------------------------------------------

/**
 * Retire les paragraphes qui ne sont qu'un reste de Markdown d'image tronqué.
 * Séparée de `--publier` pour pouvoir repasser sur des articles DÉJÀ en ligne :
 * c'est le lecteur qui voit ces fragments, pas le rédacteur.
 */
async function passeFragments() {
  entete("Fragments de Markdown tronqués");

  const articles = await prisma.article.findMany({ select: { id: true, slug: true, body: true } });
  const corrections = [];
  for (const a of articles) {
    if (!Array.isArray(a.body)) continue;
    const propre = a.body.filter((b) => !(b?.type === "paragraph" && MARKDOWN_TRONQUE.test(b.text ?? "")));
    if (propre.length !== a.body.length) corrections.push({ id: a.id, slug: a.slug, body: propre });
  }

  for (const c of corrections) console.log(`  · ${c.slug.slice(0, 70)}`);
  console.log(`\n  ${corrections.length} articles à nettoyer.`);
  if (!APPLIQUER) return;

  for (const c of corrections) await prisma.article.update({ where: { id: c.id }, data: { body: c.body } });
  console.log("  terminé.");
}

// ---------------------------------------------------------------------------
// Passe 7 — redater les archives publiées à la main
// ---------------------------------------------------------------------------

/**
 * Fenêtre pendant laquelle l'import des archives a écrit ses lignes : les 17 et
 * 18 août 2026. Les articles écrits dans le Studio l'encadrent — du 12 juillet
 * au 16 août pour les précédents, à partir du 20 août pour les suivants —, si
 * bien qu'aucun ne tombe dedans. Mesuré : 4 263 lignes dans la fenêtre, toutes
 * porteuses d'un identifiant source, et aucune en dehors.
 *
 * Borner des deux côtés, et pas seulement « avant la fin de l'import », est ce
 * qui rend le critère discriminant : un article maison peut être illustré
 * d'une photo d'archive, et le redater à l'époque de sa photo serait un
 * contresens. La borne basse l'exclut sans avoir à en juger.
 */
const IMPORT_DEBUT = new Date("2026-08-17T00:00:00Z");
const IMPORT_FIN = new Date("2026-08-19T00:00:00Z");

/**
 * Écart en deçà duquel on ne réécrit pas : la date est déjà la bonne. Deux
 * jours suffisent — une tolérance large laissait passer les archives publiées
 * à la main dont l'article datait de quelques semaines seulement.
 */
const ECART_TOLERE_JOURS = 2;

/**
 * Une archive publiée depuis le Studio reçoit `publishedAt = maintenant`, parce
 * que l'action de publication ignore tout de la chronologie reconstituée. Un
 * fait divers de 2022 se retrouve alors en tête de l'accueil, daté du jour —
 * exactement ce que la reconstitution des dates servait à éviter.
 *
 * Cette passe compare, pour chaque article issu de l'import et portant un
 * identifiant du site source, la date affichée à la date reconstituée.
 *
 * Elle est idempotente : réappliquée, elle ne touche plus rien.
 */
async function passeRedater() {
  entete("Redatage des archives publiées à la main");

  const articles = await prisma.article.findMany({
    where: { status: "published", createdAt: { gte: IMPORT_DEBUT, lt: IMPORT_FIN } },
    select: { id: true, title: true, publishedAt: true, coverAsset: { select: { url: true } } },
  });

  const ecarts = [];
  for (const a of articles) {
    const id = identifiantSource(a.coverAsset?.url);
    if (!id || !a.publishedAt) continue;
    const cible = dateReconstituee(id);
    if (!cible) continue;
    const jours = Math.abs(a.publishedAt - cible) / 86_400_000;
    if (jours > ECART_TOLERE_JOURS) ecarts.push({ id: a.id, title: a.title, de: a.publishedAt, vers: cible, jours });
  }

  ecarts.sort((x, y) => y.vers - x.vers);
  const f = (d) => d.toISOString().slice(0, 10);
  for (const e of ecarts) {
    console.log(`  ${f(e.de)} → ${f(e.vers)}  (${Math.round(e.jours)} j)  ${e.title.slice(0, 46)}`);
  }
  console.log(`\n  ${ecarts.length} articles à redater.`);
  if (!APPLIQUER) return;

  for (const e of ecarts) {
    await prisma.article.update({ where: { id: e.id }, data: { publishedAt: e.vers } });
  }
  console.log("  terminé.");
}

// ---------------------------------------------------------------------------
// Passe 8 — verser les articles de santé dans leur rubrique
// ---------------------------------------------------------------------------

/**
 * La rubrique Santé n'existait pas au moment du premier classement : les
 * articles de santé sont donc tombés dans « Actualité », le fourre-tout.
 *
 * Ne sont déplacés que ceux qui s'y trouvent ENCORE. Un article rangé ailleurs
 * — à la main par la rédaction, ou par les règles — n'est pas repris : la
 * machine ne repasse pas derrière une décision déjà prise. Ceux-là sont
 * seulement signalés, pour que le choix reste humain.
 *
 * Les articles étant désormais publiés, le déplacement change leur adresse.
 * C'est sans danger : la page article redirige en 301 vers la nouvelle
 * rubrique quand le slug existe ailleurs (cf. app/[rubrique]/[slug]/page.tsx).
 */
async function passeSante() {
  entete("Rubrique Santé : reclassement");

  const rubriques = await prisma.rubrique.findMany({ select: { id: true, slug: true } });
  const idParSlug = new Map(rubriques.map((r) => [r.slug, r.id]));
  const sante = idParSlug.get("sante");
  const actualite = idParSlug.get("actualite");
  if (!sante) throw new Error("Rubrique « sante » introuvable — la créer d'abord dans le Studio.");
  if (!actualite) throw new Error("Rubrique « actualite » introuvable.");

  const articles = await prisma.article.findMany({
    select: { id: true, slug: true, title: true, dek: true, tags: true, rubriqueId: true },
  });

  const aDeplacer = [];
  const ailleurs = [];
  for (const a of articles) {
    if (a.rubriqueId === sante) continue;
    if (classer(a)?.rubrique !== "sante") continue;
    if (a.rubriqueId === actualite) aDeplacer.push(a);
    else ailleurs.push(a);
  }

  console.log(`  depuis « Actualité »  : ${aDeplacer.length}`);
  for (const a of aDeplacer.slice(0, 12)) console.log(`    · ${a.title.slice(0, 66)}`);
  if (aDeplacer.length > 12) console.log(`    … et ${aDeplacer.length - 12} autres`);

  if (ailleurs.length > 0) {
    console.log(`\n  déjà classés ailleurs, NON déplacés (à arbitrer) : ${ailleurs.length}`);
    for (const a of ailleurs.slice(0, 12)) console.log(`    · ${a.title.slice(0, 66)}`);
    if (ailleurs.length > 12) console.log(`    … et ${ailleurs.length - 12} autres`);
  }

  if (!APPLIQUER) return;

  for (let i = 0; i < aDeplacer.length; i += LOT) {
    const ids = aDeplacer.slice(i, i + LOT).map((a) => a.id);
    await prisma.article.updateMany({ where: { id: { in: ids } }, data: { rubriqueId: sante } });
  }
  console.log("\n  terminé.");
}

// ---------------------------------------------------------------------------

const passes = [];
if (args.has("--rubriques")) passes.push(passeRubriques);
if (args.has("--images")) passes.push(passeImages);
if (args.has("--doublons-images")) passes.push(passeDoublonsImages);
if (args.has("--menage")) passes.push(passeMenage);
if (args.has("--publier")) passes.push(passePublier);
if (args.has("--fragments")) passes.push(passeFragments);
if (args.has("--redater")) passes.push(passeRedater);
if (args.has("--sante")) passes.push(passeSante);

if (passes.length === 0) {
  console.error(
    "Usage : node scripts/reprise-archives.mjs [--rubriques] [--images] [--doublons-images] [--menage] [--publier] [--appliquer]"
  );
  process.exit(1);
}

try {
  for (const passe of passes) await passe();
  if (!APPLIQUER) console.log("\nSimulation : rien n'a été écrit. Ajouter --appliquer pour exécuter.");
} finally {
  await prisma.$disconnect();
}
