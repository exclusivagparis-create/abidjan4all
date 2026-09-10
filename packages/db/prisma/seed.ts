/**
 * Seed de développement — contenus repris des maquettes du handoff
 * (Page Accueil.dc.html, Page Article.dc.html). Idempotent : purge puis recrée.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// mot de passe commun des comptes de démo : « abidjan2026 »
const DEMO_HASH = bcrypt.hashSync("abidjan2026", 10);

const p = (text: string) => ({ type: "paragraph", text });
const h2 = (text: string) => ({ type: "h2", text });
const quote = (text: string, cite: string) => ({ type: "quote", text, cite });

// petit corps générique pour les articles secondaires
function corps(sujet: string): Prisma.JsonArray {
  return [
    p(
      `${sujet} — les acteurs du secteur observent une accélération nette depuis le début de l'année, portée par la demande régionale et les capitaux de la diaspora.`
    ),
    h2("Ce que disent les chiffres"),
    p(
      "Les données compilées par la rédaction montrent une tendance de fond : la valeur se déplace vers Abidjan, et les investisseurs suivent."
    ),
    p(
      "Reste une inconnue : la capacité des infrastructures à absorber cette croissance sans créer de goulots d'étranglement."
    ),
  ];
}

async function main() {
  // purge (ordre inverse des FK)
  await prisma.$transaction([
    prisma.liveUpdate.deleteMany(),
    prisma.liveBlog.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.newsletterSubscription.deleteMany(),
    prisma.newsletter.deleteMany(),
    prisma.enrollment.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.course.deleteMany(),
    prisma.episode.deleteMany(),
    prisma.podcast.deleteMany(),
    prisma.factCheck.deleteMany(),
    prisma.glossaryTerm.deleteMany(),
    prisma.listing.deleteMany(),
    prisma.adCampaign.deleteMany(),
    prisma.article.deleteMany(),
    prisma.mediaAsset.deleteMany(),
    prisma.rubrique.deleteMany(),
    prisma.group.deleteMany(),
    prisma.badge.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // ---- Rubriques (README §Design tokens ; slug SEO façon DATA_MODEL "cacao-marches")
  const rubriquesData = [
    { slug: "cacao-marches", name: "Cacao & Marchés", color: "#8A5A2B", kind: "freemium", order: 1 },
    { slug: "diaspora", name: "Diaspora", color: "#2E5AAC", kind: "gratuit", order: 2 },
    { slug: "business", name: "Business", color: "#0E8A5F", kind: "premium", order: 3 },
    { slug: "femmes", name: "Femmes", color: "#B0347A", kind: "gratuit", order: 4 },
    { slug: "environnement", name: "Environnement", color: "#3C8F4E", kind: "gratuit", order: 5 },
    { slug: "videos", name: "Vidéos", color: "#D6282D", kind: "gratuit", order: 6 },
    { slug: "en-direct", name: "En Direct", color: "#E8641A", kind: "gratuit", order: 7 },
    { slug: "africa-in-english", name: "Africa in English", color: "#147C82", kind: "gratuit", order: 8 },
    { slug: "tourisme", name: "Tourisme", color: "#C98A17", kind: "affiliation", order: 9 },
    { slug: "religion", name: "Religion", color: "#6A5AA6", kind: "gratuit", order: 10 },
    { slug: "politique", name: "Politique", color: "#364152", kind: "gratuit", order: 11 },
    { slug: "economie", name: "Économie", color: "#1A6E8E", kind: "premium", order: 12 },
    { slug: "culture", name: "Culture", color: "#C0562B", kind: "gratuit", order: 13 },
    { slug: "sport", name: "Sport", color: "#157A3B", kind: "gratuit", order: 14 },
  ] as const;

  const rub: Record<string, string> = {};
  for (const r of rubriquesData) {
    const created = await prisma.rubrique.create({ data: { ...r, kind: r.kind } });
    rub[r.slug] = created.id;
  }

  // ---- Badges & utilisateurs
  const [bJournalist, bDiaspora, bExpertCacao] = await Promise.all([
    prisma.badge.create({ data: { slug: "journalist", label: "Journaliste" } }),
    prisma.badge.create({ data: { slug: "diaspora", label: "Diaspora" } }),
    prisma.badge.create({ data: { slug: "expert_cacao", label: "Expert cacao" } }),
  ]);

  const admin = await prisma.user.create({
    data: { email: "admin@abidjan4all.net", name: "Administration A4A", role: "admin", verified: true, country: "CI", passwordHash: DEMO_HASH },
  });
  const editrice = await prisma.user.create({
    data: { email: "mariam.toure@abidjan4all.net", name: "Mariam Touré", role: "editor", verified: true, country: "CI", passwordHash: DEMO_HASH },
  });
  const awa = await prisma.user.create({
    data: {
      email: "awa.kone@abidjan4all.net",
      name: "Awa Koné",
      role: "journalist",
      passwordHash: DEMO_HASH,
      bio: "Data journaliste — cacao, marchés et économie ivoirienne.",
      verified: true,
      country: "CI",
      badges: { connect: [{ id: bJournalist.id }, { id: bExpertCacao.id }] },
    },
  });
  const koffi = await prisma.user.create({
    data: {
      email: "koffi.diallo@abidjan4all.net",
      name: "Koffi Diallo",
      role: "journalist",
      passwordHash: DEMO_HASH,
      bio: "Correspondant diaspora, Montréal.",
      verified: true,
      country: "CA",
      badges: { connect: [{ id: bJournalist.id }, { id: bDiaspora.id }] },
    },
  });
  const lecteur = await prisma.user.create({
    data: {
      email: "ngoran.kouassi@gmail.com",
      name: "N'Goran Kouassi",
      role: "member",
      passwordHash: DEMO_HASH,
      country: "FR",
      interests: [rub["cacao-marches"]!, rub["diaspora"]!, rub["sport"]!],
      badges: { connect: [{ id: bDiaspora.id }] },
    },
  });

  // ---- Groupes communauté (maquette Espace Membre — compteurs marketing du design)
  await Promise.all([
    prisma.group.create({
      data: {
        slug: "entrepreneurs-ci",
        name: "Entrepreneurs CI",
        color: "#0E8A5F",
        membersCount: 4210,
        members: { connect: [{ id: lecteur.id }] },
      },
    }),
    prisma.group.create({
      data: {
        slug: "diaspora-quebec",
        name: "Diaspora Québec",
        color: "#2E5AAC",
        membersCount: 1830,
        members: { connect: [{ id: lecteur.id }, { id: koffi.id }] },
      },
    }),
    prisma.group.create({
      data: { slug: "cacao-filiere", name: "Cacao Filière", color: "#8A5A2B", membersCount: 960 },
    }),
  ]);

  // ---- Régie publicitaire (démonstration — encart AdSlot sur les rubriques)
  //
  // Le visuel, l'accroche, le lien et les compteurs appartiennent à AdBanner,
  // pas à la campagne : une campagne porte plusieurs bannières, de formats
  // différents. Ce seed les posait encore sur AdCampaign — d'où l'échec
  // `Unknown argument 'format'`, qui laissait la CI rouge.
  await Promise.all([
    prisma.adCampaign.create({
      data: {
        advertiser: "Air Côte d'Ivoire",
        cpm: 2500,
        targeting: { rubriques: ["cacao-marches", "economie", "business"], geo: ["CI", "FR"] },
        startAt: new Date("2026-07-01T00:00:00Z"),
        endAt: new Date("2026-09-30T00:00:00Z"),
        status: "active",
        banners: {
          create: [
            {
              format: "leaderboard_728x90",
              headline: "Abidjan–Paris : vols directs dès 450 000 FCFA",
              linkUrl: "https://www.aircotedivoire.com",
              impressions: 12480,
              clicks: 187,
            },
          ],
        },
      },
    }),
    prisma.adCampaign.create({
      data: {
        advertiser: "SIB — Société Ivoirienne de Banque",
        cpm: 1800,
        targeting: { rubriques: ["diaspora"], geo: ["FR", "CA", "US"] },
        startAt: new Date("2026-08-01T00:00:00Z"),
        endAt: new Date("2026-10-31T00:00:00Z"),
        status: "draft",
        banners: {
          create: [{ format: "native", headline: "Épargnez en FCFA depuis la diaspora" }],
        },
      },
    }),
  ]);

  // abonné A4A+ Essentiel avec un paiement et sa facture.
  //
  // `plan` référence désormais Offer : les offres sont insérées par la
  // migration et ce seed ne purge pas cette table, donc « essentiel » existe.
  // `since` au 28 janvier fait de ce jeu d'essai un cas utile : le 28 est un
  // jour anniversaire que février sait honorer, contrairement au 31.
  const sub = await prisma.subscription.create({
    data: {
      userId: lecteur.id,
      plan: "essentiel",
      status: "active",
      method: "momo",
      methodMask: "07 •• •• 89",
      currentPeriodEnd: new Date("2026-07-28T00:00:00Z"),
      since: new Date("2026-01-28T00:00:00Z"),
    },
  });
  const pay = await prisma.payment.create({
    data: {
      subscriptionId: sub.id,
      // L'offre est inscrite sur le paiement, plus déduite du montant : c'est
      // ce que fait le checkout depuis que les remises existent.
      offerId: "essentiel",
      amount: 2000,
      listAmount: 2000,
      currency: "XOF",
      provider: "paydunya",
      providerRef: "PDY-2026-06-000412",
      status: "succeeded",
      createdAt: new Date("2026-06-28T09:12:00Z"),
    },
  });
  await prisma.invoice.create({
    data: { paymentId: pay.id, number: "A4A-2026-000412", url: "/invoices/A4A-2026-000412.pdf", issuedAt: pay.createdAt },
  });

  // ---- Médias (placeholders — aucune imagerie éditoriale dans le handoff)
  const cover = (caption: string) =>
    prisma.mediaAsset.create({
      data: { type: "image", url: `placeholder://${caption}`, alt: caption, tags: ["placeholder"], uploadedById: editrice.id },
    });
  const covPort = await cover("photo — port autonome d'abidjan");
  const covSechage = await cover("photo — séchage des fèves, san-pédro");
  const covMontreal = await cover("photo — quartier ivoirien, montréal");
  const covBrvm = await cover("photo — salle de cotation, brvm");

  // ---- Articles (titres des maquettes)
  const j = (d: string) => new Date(d);
  /**
   * `views` reste à zéro partout.
   *
   * Ce jeu d'amorçage donnait à ses articles de démonstration des compteurs
   * inventés — jusqu'à 15 320 lectures. Comme il a servi à installer le site,
   * ces chiffres se sont retrouvés en production : ils occupaient à eux seuls
   * le classement « Les plus lus » de l'accueil et faussaient les
   * statistiques du Studio. Un article d'exemple n'a jamais été lu ; son
   * compteur doit le dire.
   */
  type Art = {
    slug: string; title: string; kicker?: string; dek: string; rubrique: string;
    author: string; premium?: boolean; readingTime: number; views: number;
    publishedAt: string; coverAssetId?: string; body?: Prisma.JsonArray; tags?: string[];
  };
  const articles: Art[] = [
    {
      slug: "transformation-locale-feve",
      title: "Abidjan mise sur la transformation locale de la fève",
      kicker: "Enquête",
      dek: "La Côte d'Ivoire veut broyer davantage sur son sol pour capter la valeur ajoutée — un tournant que scrutent de près les investisseurs de la diaspora.",
      rubrique: "cacao-marches", author: awa.id, premium: true, readingTime: 6, views: 0,
      publishedAt: "2026-06-30T06:00:00Z", coverAssetId: covPort.id,
      tags: ["cacao", "transformation", "industrie"],
      body: [
        p("Le port d'Abidjan a enregistré ce trimestre un volume record de fèves transformées sur place. Derrière ce chiffre, une ambition assumée : cesser d'exporter la matière brute pour capter, enfin, la valeur ajoutée du chocolat mondial."),
        p("Longtemps, la Côte d'Ivoire — premier producteur mondial — n'a broyé qu'une fraction de sa récolte. Le reste partait vers l'Europe et l'Amérique du Nord, où se jouait l'essentiel de la marge."),
        quote("« Transformer chez nous, c'est refuser d'exporter nos emplois avec nos fèves. »", "Un industriel de la zone de San-Pédro"),
        p("Le gouvernement mise désormais sur de nouvelles unités de broyage, avec un objectif : transformer la moitié de la production nationale d'ici cinq ans. Les premiers résultats sont là, mais la cadence interroge encore."),
        h2("La diaspora en première ligne"),
        p("De Montréal à Paris, les fonds d'investissement portés par la diaspora ivoirienne se positionnent sur la filière. Les tickets restent modestes, mais le signal est clair : la transformation locale est devenue un actif crédible."),
        p("Prochaine étape : la certification des unités de broyage aux standards européens, condition d'accès aux marchés premium du chocolat d'origine."),
      ],
    },
    {
      slug: "chaine-mondiale-chocolat",
      title: "Qui contrôle vraiment la chaîne mondiale du chocolat ?",
      kicker: "Enquête",
      dek: "Des cabosses de Daloa aux rayons européens, la carte du pouvoir et de la valeur.",
      rubrique: "cacao-marches", author: awa.id, premium: true, readingTime: 9, views: 0,
      publishedAt: "2026-06-27T06:00:00Z", coverAssetId: covSechage.id,
      tags: ["cacao", "négoce"], body: corps("La chaîne mondiale du chocolat"),
    },
    {
      slug: "demande-asiatique-cacao",
      title: "La demande asiatique redessine la carte du cacao",
      dek: "Broyeurs indonésiens, chocolatiers japonais : les flux se déplacent vers l'Est.",
      rubrique: "cacao-marches", author: awa.id, readingTime: 5, views: 0,
      publishedAt: "2026-06-25T06:00:00Z", tags: ["cacao", "asie"], body: corps("La demande asiatique de cacao"),
    },
    {
      slug: "ivoiriens-montreal-investir",
      title: "Ces Ivoiriens de Montréal qui reviennent investir au pays",
      dek: "Portraits d'une génération qui fait le chemin inverse, capitaux en poche.",
      rubrique: "diaspora", author: koffi.id, readingTime: 3, views: 0,
      publishedAt: "2026-06-29T10:00:00Z", coverAssetId: covMontreal.id,
      tags: ["diaspora", "investissement", "canada"], body: corps("Le retour des investisseurs de Montréal"),
    },
    {
      slug: "brvm-nouvelle-vague-pme",
      title: "La BRVM attire une nouvelle vague de PME ivoiriennes",
      dek: "Le troisième compartiment de la bourse régionale séduit les entreprises familiales.",
      rubrique: "business", author: awa.id, premium: true, readingTime: 4, views: 0,
      publishedAt: "2026-06-28T08:00:00Z", coverAssetId: covBrvm.id,
      tags: ["brvm", "pme", "bourse"], body: corps("La cote des PME à la BRVM"),
    },
    {
      slug: "franc-cfa-coeur-debat",
      title: "Le franc CFA de nouveau au cœur du débat",
      dek: "Entre l'eco annoncé et les réalités monétaires, où en est vraiment la réforme ?",
      rubrique: "economie", author: awa.id, readingTime: 7, views: 0,
      publishedAt: "2026-06-26T06:00:00Z", tags: ["cfa", "eco", "uemoa"], body: corps("La réforme du franc CFA"),
    },
    {
      slug: "elephants-liste-26-can",
      title: "Éléphants : la liste des 26 pour la CAN",
      dek: "Le sélectionneur a tranché — surprises en attaque, retours en défense.",
      rubrique: "sport", author: koffi.id, readingTime: 2, views: 0,
      publishedAt: "2026-07-01T18:00:00Z", tags: ["can", "elephants", "football"], body: corps("La liste des Éléphants"),
    },
    {
      slug: "attieke-femmes-filiere",
      title: "Attiéké : ces femmes qui réinventent la filière",
      dek: "De Dabou aux rayons parisiens, une IGP qui change l'échelle du métier.",
      rubrique: "femmes", author: koffi.id, readingTime: 5, views: 0,
      publishedAt: "2026-06-24T06:00:00Z", tags: ["attieke", "igp", "agroalimentaire"], body: corps("La filière attiéké"),
    },
  ];

  const artIds: Record<string, string> = {};
  for (const a of articles) {
    const created = await prisma.article.create({
      data: {
        slug: a.slug, title: a.title, kicker: a.kicker ?? null, dek: a.dek,
        body: (a.body ?? corps(a.title)) as Prisma.InputJsonValue,
        status: "published", premium: a.premium ?? false,
        publishedAt: j(a.publishedAt), rubriqueId: rub[a.rubrique]!,
        authorId: a.author, coverAssetId: a.coverAssetId ?? null,
        tags: a.tags ?? [], readingTime: a.readingTime, views: a.views,
        seo: { metaTitle: a.title, metaDescription: a.dek } as Prisma.InputJsonValue,
      },
    });
    artIds[a.slug] = created.id;
  }

  // Africa in English — contenu anglophone (DF-05, i18n)
  await prisma.article.create({
    data: {
      slug: "ivorian-cocoa-grinding-push",
      title: "Ivory Coast bets big on grinding its own cocoa",
      kicker: "Analysis",
      dek: "The world's top producer wants to process half its harvest at home by 2028 — investors from the diaspora are paying attention.",
      body: [
        p("Abidjan's port has just recorded its highest quarterly volume of locally processed beans. Behind the number lies a deliberate strategy: stop exporting raw commodities and capture the value added of the global chocolate industry."),
        h2("Why it matters"),
        p("For decades, the country shipped most of its harvest to Europe and North America, where the margins were made. New grinding plants around San-Pédro aim to change that equation."),
      ] as Prisma.InputJsonValue,
      status: "published",
      publishedAt: j("2026-06-28T12:00:00Z"),
      rubriqueId: rub["africa-in-english"]!,
      authorId: koffi.id,
      tags: ["cocoa", "industry", "english"],
      readingTime: 4,
      views: 0,
      seo: { metaTitle: "Ivory Coast bets big on grinding its own cocoa", metaDescription: "Processing half the harvest at home by 2028." } as Prisma.InputJsonValue,
    },
  });

  // workflow : un brouillon + un programmé
  await prisma.article.create({
    data: {
      slug: "guichet-consulaire-montreal", title: "Diaspora : nouveau guichet consulaire à Montréal",
      dek: "Les démarches simplifiées pour les Ivoiriens du Québec.", body: corps("Le guichet consulaire de Montréal") as Prisma.InputJsonValue,
      status: "draft", rubriqueId: rub["diaspora"]!, authorId: koffi.id, readingTime: 3,
      seo: {} as Prisma.InputJsonValue,
    },
  });
  await prisma.article.create({
    data: {
      slug: "can-2027-calendrier-renovations", title: "CAN 2027 : le calendrier des rénovations dévoilé",
      dek: "Stades, voiries, hôtels : le compte à rebours est lancé.", body: corps("Les chantiers de la CAN 2027") as Prisma.InputJsonValue,
      status: "scheduled", scheduledAt: j("2026-07-04T06:00:00Z"),
      rubriqueId: rub["sport"]!, authorId: awa.id, readingTime: 4,
      seo: {} as Prisma.InputJsonValue,
    },
  });

  // ---- Commentaires (lead article)
  const lead = artIds["transformation-locale-feve"]!;
  await prisma.comment.create({
    data: {
      articleId: lead, userId: lecteur.id, status: "approved",
      body: "Enfin un dossier sérieux sur la transformation locale. La diaspora n'attend que ça pour investir davantage.",
      reactions: { "👍": 24, "🔥": 6 } as Prisma.InputJsonValue,
    },
  });
  await prisma.comment.create({
    data: { articleId: lead, userId: lecteur.id, status: "pending", body: "Et les planteurs dans tout ça ?", reactions: {} as Prisma.InputJsonValue },
  });

  // ---- Live-blog (ticker « En Direct »)
  const live = await prisma.liveBlog.create({
    data: {
      title: "Cacao : la fève franchit 4 000 $ à Londres",
      dek: "Suivez la séance et les réactions de la filière en direct.",
      rubriqueId: rub["en-direct"]!, status: "live", startedAt: j("2026-07-02T07:30:00Z"), updatesCount: 3,
    },
  });
  await prisma.liveUpdate.create({
    data: { liveBlogId: live.id, time: j("2026-07-02T07:31:00Z"), type: "text", title: "Ouverture en fanfare", body: "La tonne de fève s'échange à 4 015 $ dès l'ouverture, du jamais-vu depuis 2024." },
  });
  await prisma.liveUpdate.create({
    data: { liveBlogId: live.id, time: j("2026-07-02T08:05:00Z"), type: "stat", title: "BRVM", body: "Le composite clôture en hausse de 1,8 %.", pinned: true },
  });
  await prisma.liveUpdate.create({
    data: { liveBlogId: live.id, time: j("2026-07-02T09:12:00Z"), type: "quote", body: "« Le marché rémunère enfin l'origine ivoirienne », réagit un négociant d'Abidjan." },
  });

  // ---- Newsletters, glossaire, fact-check, podcast
  const nl = await prisma.newsletter.create({
    data: { slug: "essentiel-du-matin", name: "L'Essentiel du matin", cadence: "quotidienne", description: "L'actualité ivoirienne qui compte, chaque matin à 7h.", subscribersCount: 1 },
  });
  await prisma.newsletter.create({
    data: { slug: "cacao-hebdo", name: "Cacao Hebdo", cadence: "hebdomadaire", description: "Prix, volumes, négoce : la semaine de la fève." },
  });
  await prisma.newsletterSubscription.create({
    data: { newsletterId: nl.id, userId: lecteur.id, email: lecteur.email, confirmed: true },
  });

  await prisma.glossaryTerm.createMany({
    data: [
      { term: "BRVM", category: "Finance", definition: "Bourse régionale des valeurs mobilières, commune aux huit pays de l'UEMOA, basée à Abidjan." },
      { term: "IGP", category: "Agroalimentaire", definition: "Indication géographique protégée — l'attiéké des Lagunes en bénéficie depuis 2023." },
      { term: "Broyage", category: "Cacao", definition: "Première transformation de la fève en masse de cacao, étape clé de la captation de valeur." },
    ],
  });

  await prisma.factCheck.create({
    data: {
      claim: "Le franc CFA sera remplacé par l'eco dès la fin de l'année.",
      verdict: "trompeur", topic: "Économie",
      body: "Aucun calendrier officiel ne fixe la bascule à la fin de l'année ; les critères de convergence ne sont pas réunis.",
      sources: ["Communiqué UEMOA (mai 2026)", "Rapport BCEAO 2025"],
      articleId: artIds["franc-cfa-coeur-debat"]!,
    },
  });

  // ---- E-learning (DF-05)
  const courseCacao = await prisma.course.create({
    data: {
      slug: "investir-filiere-cacao",
      title: "Investir dans la filière cacao",
      category: "Business",
      level: "Intermédiaire",
      price: 15000,
      isPremium: true,
      lessonsCount: 3,
      rating: 4.7,
    },
  });
  await prisma.lesson.createMany({
    data: [
      { courseId: courseCacao.id, order: 1, module: "Fondamentaux", title: "Comprendre la chaîne de valeur", durationSec: 900, videoUrl: "placeholder://video-cacao-1", resources: [] },
      { courseId: courseCacao.id, order: 2, module: "Fondamentaux", title: "Lire les cours mondiaux", durationSec: 1200, videoUrl: "placeholder://video-cacao-2", resources: [] },
      { courseId: courseCacao.id, order: 3, module: "Pratique", title: "Monter un dossier d'investissement", durationSec: 1500, videoUrl: "placeholder://video-cacao-3", resources: [] },
    ],
  });
  const courseDiaspora = await prisma.course.create({
    data: {
      slug: "entreprendre-depuis-la-diaspora",
      title: "Entreprendre en Côte d'Ivoire depuis la diaspora",
      category: "Entrepreneuriat",
      level: "Débutant",
      price: 0,
      isPremium: false,
      lessonsCount: 2,
      rating: 4.4,
    },
  });
  await prisma.lesson.createMany({
    data: [
      { courseId: courseDiaspora.id, order: 1, module: "Démarrer", title: "Choisir sa structure juridique", durationSec: 840, videoUrl: "placeholder://video-diaspora-1", resources: [] },
      { courseId: courseDiaspora.id, order: 2, module: "Démarrer", title: "Ouvrir et opérer à distance", durationSec: 960, videoUrl: "placeholder://video-diaspora-2", resources: [] },
    ],
  });

  const pod = await prisma.podcast.create({
    data: { slug: "abidjan-decode", title: "Abidjan Décodé", category: "Actualité", cadence: "hebdomadaire", coverUrl: "placeholder://cover — abidjan décodé" },
  });
  await prisma.episode.createMany({
    data: [
      { podcastId: pod.id, number: 1, title: "Le cacao peut-il enrichir la Côte d'Ivoire ?", description: "Avec Awa Koné, data journaliste.", audioUrl: "placeholder://audio-ep1", durationSec: 1860, publishedAt: j("2026-06-20T05:00:00Z") },
      { podcastId: pod.id, number: 2, title: "Diaspora : le grand retour des capitaux", description: "Avec Koffi Diallo, depuis Montréal.", audioUrl: "placeholder://audio-ep2", durationSec: 2100, publishedAt: j("2026-06-27T05:00:00Z") },
    ],
  });

  const counts = await prisma.$transaction([
    prisma.rubrique.count(), prisma.user.count(), prisma.article.count(), prisma.liveUpdate.count(),
  ]);
  console.log(`Seed OK — rubriques: ${counts[0]}, users: ${counts[1]}, articles: ${counts[2]}, liveUpdates: ${counts[3]}`);
  console.log(`(admin non utilisé pour l'instant : ${admin.email})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
