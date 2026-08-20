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
 * Aucune passe ne publie ni ne change de statut : les brouillons restent des
 * brouillons. La publication reste une décision de la rédaction.
 *
 * Sans `--appliquer`, le script ne fait que compter et montrer — c'est le mode
 * par défaut, sur une base de quatre mille articles en production.
 *
 *  3. DOUBLONS D'IMAGES — conséquence de la passe précédente : elle a repris
 *     les URL absolues du Markdown alors que le site travaille en relatif, ce
 *     qui a fait exister chaque fichier deux fois dans la médiathèque. La passe
 *     `--doublons-images` ramène tout au relatif et fusionne les fiches.
 *
 *   node scripts/reprise-archives.mjs --rubriques
 *   node scripts/reprise-archives.mjs --images --appliquer
 *   node scripts/reprise-archives.mjs --doublons-images --appliquer
 */
import { PrismaClient } from "@prisma/client";
import { classer } from "./regles-rubriques.mjs";

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

const passes = [];
if (args.has("--rubriques")) passes.push(passeRubriques);
if (args.has("--images")) passes.push(passeImages);
if (args.has("--doublons-images")) passes.push(passeDoublonsImages);

if (passes.length === 0) {
  console.error(
    "Usage : node scripts/reprise-archives.mjs [--rubriques] [--images] [--doublons-images] [--appliquer]"
  );
  process.exit(1);
}

try {
  for (const passe of passes) await passe();
  if (!APPLIQUER) console.log("\nSimulation : rien n'a été écrit. Ajouter --appliquer pour exécuter.");
} finally {
  await prisma.$disconnect();
}
