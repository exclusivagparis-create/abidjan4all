/**
 * Connecteur MCP (Model Context Protocol) d'Abidjan4All.
 *
 * Permet à une application Claude — bureau, web, Claude Code — de consulter et
 * d'alimenter le site depuis une conversation : chercher un article, le lire,
 * rédiger un brouillon, consulter l'audience.
 *
 * Transport : JSON-RPC 2.0 sur HTTP POST (« Streamable HTTP » sans flux SSE —
 * chaque appel tient dans une requête/réponse, aucun besoin de canal ouvert).
 * Authentification : en-tête `Authorization: Bearer a4a_…`, jeton créé dans
 * Studio ▸ Accès API. Les portées du jeton et le rôle du compte porteur
 * décident de ce qui est autorisé (cf. lib/api-auth.ts).
 *
 * Garde-fou éditorial : ce connecteur ne publie jamais. Il crée et modifie des
 * brouillons ; la mise en ligne reste un geste humain, dans le Studio.
 */
import { prisma, Prisma } from "@a4a/db";
import { autorise, verifierJeton, type ApiIdentity, type Scope } from "@/lib/api-auth";
import { telechargerImage } from "@/lib/telechargement-image";
import { compterSensibles, supprimerArticles } from "@/lib/suppression-articles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Version du protocole que nous parlons. */
const PROTOCOL_VERSION = "2025-06-18";
const VERSIONS_CONNUES = ["2025-06-18", "2025-03-26", "2024-11-05"];

const SERVER_INFO = { name: "abidjan4all", title: "Abidjan4All", version: "1.0.0" };

const INSTRUCTIONS = [
  "Ce serveur donne accès à la rédaction d'Abidjan4All, média ivoirien.",
  "Les articles se rédigent en français, registre journalistique.",
  "Aucun outil ne publie : `creer_brouillon` et `modifier_brouillon` déposent le texte",
  "en brouillon dans le Studio, où un rédacteur le relit et le met en ligne.",
].join(" ");

// ---------------------------------------------------------------------------
// Enveloppe JSON-RPC
// ---------------------------------------------------------------------------

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

const ERREUR = {
  parse: -32700,
  requeteInvalide: -32600,
  methodeInconnue: -32601,
  parametresInvalides: -32602,
  interne: -32603,
} as const;

function resultat(id: JsonRpcId, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function erreur(id: JsonRpcId, code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}

/** Résultat d'outil : texte simple, tel que l'attend un client MCP. */
function texte(contenu: string) {
  return { content: [{ type: "text", text: contenu }] };
}

/** Résultat d'outil en échec : le modèle le voit et peut corriger son appel. */
function echec(contenu: string) {
  return { content: [{ type: "text", text: contenu }], isError: true };
}

// ---------------------------------------------------------------------------
// Catalogue d'outils
// ---------------------------------------------------------------------------

interface Outil {
  name: string;
  title: string;
  description: string;
  scope: Scope;
  /** Écrit-il dans la base ? Sert au bandeau d'avertissement des clients MCP. */
  ecrit?: boolean;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>, moi: ApiIdentity) => Promise<unknown>;
}

const OUTILS: Outil[] = [
  {
    name: "rechercher_articles",
    title: "Rechercher des articles",
    scope: "articles:read",
    description:
      "Cherche dans les articles du site par mots-clés, rubrique ou statut. Renvoie titre, slug, rubrique, statut et date. Utiliser d'abord ceci pour retrouver le slug d'un article avant de le lire ou de le modifier.",
    inputSchema: {
      type: "object",
      properties: {
        requete: { type: "string", description: "Mots-clés cherchés dans le titre et le chapeau. Facultatif." },
        rubrique: { type: "string", description: "Slug de rubrique, ex. « economie ». Facultatif." },
        statut: {
          type: "string",
          enum: ["draft", "review", "scheduled", "published"],
          description: "Filtre sur le statut. Par défaut, tous statuts confondus.",
        },
        limite: { type: "integer", minimum: 1, maximum: 50, description: "Nombre de résultats (20 par défaut)." },
      },
      additionalProperties: false,
    },
    async run(args) {
      const where: Prisma.ArticleWhereInput = {};
      const requete = typeof args.requete === "string" ? args.requete.trim() : "";
      if (requete) {
        where.OR = [
          { title: { contains: requete, mode: "insensitive" } },
          { dek: { contains: requete, mode: "insensitive" } },
        ];
      }
      if (typeof args.rubrique === "string" && args.rubrique) {
        where.rubrique = { slug: args.rubrique };
      }
      if (typeof args.statut === "string" && args.statut) {
        where.status = args.statut as Prisma.ArticleWhereInput["status"];
      }
      const take = Math.min(50, Math.max(1, Number(args.limite) || 20));

      const rows = await prisma.article.findMany({
        where,
        take,
        orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
        select: {
          slug: true,
          title: true,
          dek: true,
          status: true,
          premium: true,
          views: true,
          publishedAt: true,
          updatedAt: true,
          rubrique: { select: { slug: true, name: true } },
          author: { select: { name: true } },
        },
      });

      if (rows.length === 0) return texte("Aucun article ne correspond.");
      return texte(
        rows
          .map(
            (a) =>
              `• ${a.title}\n  slug: ${a.slug} · rubrique: ${a.rubrique.name} · statut: ${a.status}` +
              `${a.premium ? " · A4A+" : ""} · ${a.views} vues · signé ${a.author.name}` +
              `\n  ${a.dek ?? "(pas de chapeau)"}`
          )
          .join("\n\n")
      );
    },
  },

  {
    name: "lire_article",
    title: "Lire un article",
    scope: "articles:read",
    description:
      "Renvoie le texte intégral d'un article à partir de son slug : titre, chapeau, corps, rubrique, tags, statut.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Slug de l'article, ex. « port-abidjan-terminal »." } },
      required: ["slug"],
      additionalProperties: false,
    },
    async run(args) {
      const slug = String(args.slug ?? "");
      const a = await prisma.article.findUnique({
        where: { slug },
        select: {
          slug: true,
          title: true,
          kicker: true,
          dek: true,
          body: true,
          status: true,
          premium: true,
          tags: true,
          views: true,
          publishedAt: true,
          rubrique: { select: { name: true, slug: true } },
          author: { select: { name: true } },
        },
      });
      if (!a) return echec(`Aucun article avec le slug « ${slug} ».`);

      const entete = [
        a.kicker ? `Surtitre : ${a.kicker}` : null,
        `Titre : ${a.title}`,
        a.dek ? `Chapeau : ${a.dek}` : null,
        `Rubrique : ${a.rubrique.name} (${a.rubrique.slug}) · Statut : ${a.status}` +
          `${a.premium ? " · réservé A4A+" : ""} · ${a.views} vues`,
        `Signature : ${a.author.name}`,
        a.tags.length ? `Mots-clés : ${a.tags.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      return texte(`${entete}\n\n---\n\n${blocsVersTexte(a.body)}`);
    },
  },

  {
    name: "lister_rubriques",
    title: "Lister les rubriques",
    scope: "articles:read",
    description:
      "Liste les rubriques du site avec leur slug. Indispensable avant de créer un brouillon, qui doit en désigner une.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run() {
      const rows = await prisma.rubrique.findMany({
        select: { slug: true, name: true, _count: { select: { articles: true } } },
        orderBy: { name: "asc" },
      });
      return texte(rows.map((r) => `• ${r.name} — slug: ${r.slug} (${r._count.articles} articles)`).join("\n"));
    },
  },

  {
    name: "creer_brouillon",
    title: "Créer un brouillon",
    scope: "articles:write",
    ecrit: true,
    description:
      "Dépose un nouvel article en BROUILLON dans le Studio. Ne publie rien : un rédacteur relit puis met en ligne. Le corps s'écrit en texte simple — une ligne commençant par « ## » devient un intertitre, une ligne commençant par « > » une citation, le reste des paragraphes.",
    inputSchema: {
      type: "object",
      properties: {
        titre: { type: "string", description: "Titre de l'article (3 caractères minimum)." },
        rubrique: { type: "string", description: "Slug de la rubrique — voir lister_rubriques." },
        chapeau: { type: "string", description: "Chapeau de deux ou trois phrases. Recommandé." },
        surtitre: { type: "string", description: "Surtitre court au-dessus du titre. Facultatif." },
        corps: { type: "string", description: "Le texte de l'article, paragraphes séparés par une ligne vide." },
        tags: { type: "array", items: { type: "string" }, description: "Jusqu'à 12 mots-clés." },
        premium: { type: "boolean", description: "Réserver aux abonnés A4A+. Faux par défaut." },
      },
      required: ["titre", "rubrique", "corps"],
      additionalProperties: false,
    },
    async run(args, moi) {
      const titre = String(args.titre ?? "").trim();
      if (titre.length < 3) return echec("Titre trop court.");

      const rubrique = await prisma.rubrique.findUnique({
        where: { slug: String(args.rubrique ?? "") },
        select: { id: true, name: true },
      });
      if (!rubrique) return echec(`Rubrique inconnue : « ${args.rubrique} ». Appelez lister_rubriques.`);

      const slug = await slugLibre(titre);
      const blocks = texteVersBlocs(String(args.corps ?? ""));
      if (blocks.length === 0) return echec("Le corps de l'article est vide.");

      const dek = typeof args.chapeau === "string" ? args.chapeau.trim() : "";
      const article = await prisma.article.create({
        data: {
          slug,
          title: titre,
          kicker: typeof args.surtitre === "string" && args.surtitre.trim() ? args.surtitre.trim() : null,
          dek: dek || null,
          body: blocks as unknown as Prisma.InputJsonValue,
          status: "draft",
          premium: args.premium === true,
          tags: Array.isArray(args.tags) ? args.tags.map(String).slice(0, 12) : [],
          readingTime: tempsDeLecture(blocks),
          rubriqueId: rubrique.id,
          authorId: moi.userId,
          seo: { metaTitle: titre, metaDescription: dek } as Prisma.InputJsonValue,
        },
        select: { slug: true },
      });

      return texte(
        `Brouillon créé dans la rubrique ${rubrique.name}, signé ${moi.name}.\n` +
          `Slug : ${article.slug}\n` +
          `À relire dans le Studio : ${lienStudio(`/admin/articles`)}\n` +
          `Il n'est pas publié — la mise en ligne se fait depuis le Studio.`
      );
    },
  },

  {
    name: "modifier_brouillon",
    title: "Modifier un brouillon",
    scope: "articles:write",
    ecrit: true,
    description:
      "Modifie un article encore en brouillon ou en relecture (titre, chapeau, corps, mots-clés). Refuse de toucher à un article déjà publié ou programmé — ceux-là se corrigent dans le Studio.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Slug de l'article à modifier." },
        titre: { type: "string" },
        chapeau: { type: "string" },
        corps: { type: "string", description: "Remplace intégralement le corps. Même format que creer_brouillon." },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["slug"],
      additionalProperties: false,
    },
    async run(args) {
      const slug = String(args.slug ?? "");
      const actuel = await prisma.article.findUnique({
        where: { slug },
        select: { id: true, status: true, title: true },
      });
      if (!actuel) return echec(`Aucun article avec le slug « ${slug} ».`);
      if (actuel.status !== "draft" && actuel.status !== "review") {
        return echec(
          `« ${actuel.title} » est au statut « ${actuel.status} ». Le connecteur ne modifie que les brouillons et les articles en relecture.`
        );
      }

      const data: Prisma.ArticleUpdateInput = {};
      if (typeof args.titre === "string" && args.titre.trim().length >= 3) data.title = args.titre.trim();
      if (typeof args.chapeau === "string") data.dek = args.chapeau.trim() || null;
      if (Array.isArray(args.tags)) data.tags = args.tags.map(String).slice(0, 12);
      if (typeof args.corps === "string" && args.corps.trim()) {
        const blocks = texteVersBlocs(args.corps);
        data.body = blocks as unknown as Prisma.InputJsonValue;
        data.readingTime = tempsDeLecture(blocks);
      }
      if (Object.keys(data).length === 0) return echec("Rien à modifier : aucun champ fourni.");

      await prisma.article.update({ where: { id: actuel.id }, data });
      return texte(`Brouillon « ${slug} » mis à jour. Toujours non publié.`);
    },
  },

  {
    name: "uploader_image",
    title: "Importer une image",
    scope: "articles:write",
    ecrit: true,
    description:
      "Télécharge une image depuis une adresse publique et la range dans la médiathèque du site. Renvoie l'URL interne, la seule à utiliser dans un article — une image restée chez un tiers disparaît le jour où ce tiers la retire. Formats acceptés : jpg, png, gif, webp ; 8 Mo maximum.",
    inputSchema: {
      type: "object",
      properties: {
        url_source: {
          type: "string",
          description: "Adresse publique de l'image à télécharger (http ou https).",
        },
        nom_fichier: {
          type: "string",
          description: "Nom souhaité, sans extension. Facultatif — un nom est généré sinon.",
        },
        alt: {
          type: "string",
          description:
            "Texte alternatif décrivant l'image, lu par les lecteurs d'écran et affiché si l'image ne charge pas. Vivement recommandé.",
        },
      },
      required: ["url_source"],
      additionalProperties: false,
    },
    async run(args, moi) {
      const source = typeof args.url_source === "string" ? args.url_source.trim() : "";
      if (!source) return echec("Le paramètre url_source est vide.");

      const resultat = await telechargerImage(
        source,
        typeof args.nom_fichier === "string" ? args.nom_fichier : undefined
      );
      if (!resultat.ok) return echec(resultat.erreur);

      const alt = typeof args.alt === "string" ? args.alt.trim() : "";
      const media = await prisma.mediaAsset.create({
        data: {
          type: "image",
          url: resultat.url,
          alt: alt || null,
          sizeBytes: resultat.taille,
          tags: [],
          uploadedById: moi.userId,
        },
        select: { id: true },
      });

      // Réponse dans la forme demandée par le cahier des charges, complétée
      // d'une phrase lisible : un client MCP affiche le texte tel quel.
      const absolue = `${lienStudio("")}${resultat.url}`;
      return texte(
        JSON.stringify(
          {
            url_interne: absolue,
            id_media: media.id,
            statut: "ok",
            taille_octets: resultat.taille,
            format: resultat.mime,
            alt: alt || null,
          },
          null,
          2
        ) +
          `\n\nImage rangée dans la médiathèque${alt ? "" : " — pensez à lui donner un texte alternatif"}.` +
          `\nDans un article, utilisez l'adresse interne ci-dessus.`
      );
    },
  },

  {
    name: "supprimer_articles",
    title: "Supprimer des articles",
    scope: "articles:delete",
    ecrit: true,
    description:
      "Supprime définitivement des articles, par leurs slugs. Irréversible : le Studio n'a pas de corbeille. " +
      "Exige confirmer=true — un appel sans cette confirmation ne supprime rien et se contente de décrire ce qui serait détruit. " +
      "Appelez-le d'abord sans confirmation, montrez le récapitulatif à la personne, et ne confirmez qu'après son accord explicite. " +
      "100 slugs au maximum par appel.",
    inputSchema: {
      type: "object",
      properties: {
        slugs: {
          type: "array",
          items: { type: "string" },
          maxItems: 100,
          description: "Slugs des articles à supprimer.",
        },
        confirmer: {
          type: "boolean",
          description: "false ou absent : simulation. true : suppression réelle et définitive.",
        },
      },
      required: ["slugs"],
      additionalProperties: false,
    },
    async run(args, moi) {
      const slugs = Array.isArray(args.slugs) ? [...new Set(args.slugs.map(String).filter(Boolean))] : [];
      if (slugs.length === 0) return echec("Aucun slug fourni.");
      if (slugs.length > 100) {
        return echec(`${slugs.length} slugs reçus — 100 au maximum par appel. Procédez en plusieurs fois.`);
      }

      const existants = await prisma.article.findMany({
        where: { slug: { in: slugs } },
        select: { slug: true, title: true, status: true },
      });
      const introuvables = slugs.filter((s) => !existants.some((a) => a.slug === s));

      // Sans confirmation, on ne détruit rien : on décrit. C'est le moment où
      // un humain peut encore dire non, et il ne reviendra pas.
      if (args.confirmer !== true) {
        if (existants.length === 0) {
          return echec(`Aucun de ces ${slugs.length} slugs ne correspond à un article.`);
        }
        const { publies, programmes } = await compterSensibles(slugs);
        return texte(
          [
            `SIMULATION — rien n'a été supprimé.`,
            ``,
            `${existants.length} article${existants.length > 1 ? "s" : ""} serai${existants.length > 1 ? "ent" : "t"} supprimé${existants.length > 1 ? "s" : ""} définitivement :`,
            ...existants.slice(0, 20).map((a) => `  • ${a.title} (${a.slug}) — ${a.status}`),
            existants.length > 20 ? `  … et ${existants.length - 20} autre${existants.length - 20 > 1 ? "s" : ""}` : "",
            introuvables.length ? `\n${introuvables.length} slug${introuvables.length > 1 ? "s" : ""} introuvable${introuvables.length > 1 ? "s" : ""} : ${introuvables.slice(0, 10).join(", ")}` : "",
            publies + programmes > 0
              ? `\n⚠ Dont ${publies} publié${publies > 1 ? "s" : ""}${programmes ? ` et ${programmes} programmé${programmes > 1 ? "s" : ""}` : ""}. Les articles publiés sont en ligne : leurs adresses deviendront introuvables pour les lecteurs et les moteurs de recherche.`
              : "",
            `\nPour exécuter, rappelez cet outil avec confirmer=true — après accord explicite de la personne.`,
          ]
            .filter(Boolean)
            .join("\n")
        );
      }

      const r = await supprimerArticles(slugs, { id: moi.userId, nom: moi.name });
      const lignes = [
        `${r.deleted} article${r.deleted > 1 ? "s" : ""} supprimé${r.deleted > 1 ? "s" : ""}.`,
        r.errors.length
          ? `${r.errors.length} erreur${r.errors.length > 1 ? "s" : ""} : ${r.errors.map((e) => `${e.slug} (${e.raison})`).slice(0, 10).join(" · ")}`
          : `Aucune erreur.`,
        `Journal : lot ${r.batchId} — le contenu supprimé y est conservé, une restauration manuelle reste possible.`,
      ];
      return texte(lignes.join("\n"));
    },
  },

  {
    name: "statistiques",
    title: "Consulter les statistiques",
    scope: "stats:read",
    description:
      "Chiffres clés du site : articles publiés, vues cumulées, abonnés A4A+, inscrits à la newsletter, commentaires en attente, et les articles les plus lus.",
    inputSchema: {
      type: "object",
      properties: {
        jours: { type: "integer", minimum: 1, maximum: 365, description: "Fenêtre d'observation en jours (30 par défaut)." },
      },
      additionalProperties: false,
    },
    async run(args) {
      const jours = Math.min(365, Math.max(1, Number(args.jours) || 30));
      const depuis = new Date(Date.now() - jours * 24 * 60 * 60 * 1000);

      const [publies, surPeriode, brouillons, abonnes, newsletter, commentaires, vues, top] = await Promise.all([
        prisma.article.count({ where: { status: "published" } }),
        prisma.article.count({ where: { status: "published", publishedAt: { gte: depuis } } }),
        prisma.article.count({ where: { status: { in: ["draft", "review"] } } }),
        prisma.subscription.count({ where: { status: "active" } }),
        prisma.newsletterSubscription.count(),
        prisma.comment.count({ where: { status: "pending" } }),
        prisma.article.aggregate({ _sum: { views: true }, where: { status: "published" } }),
        prisma.article.findMany({
          where: { status: "published", publishedAt: { gte: depuis } },
          orderBy: { views: "desc" },
          take: 5,
          select: { title: true, slug: true, views: true },
        }),
      ]);

      return texte(
        [
          `Abidjan4All — chiffres sur ${jours} jours`,
          "",
          `Articles publiés au total : ${publies} (dont ${surPeriode} sur la période)`,
          `En cours de rédaction ou de relecture : ${brouillons}`,
          `Vues cumulées : ${vues._sum.views ?? 0}`,
          `Abonnés A4A+ actifs : ${abonnes}`,
          `Inscrits à la newsletter : ${newsletter}`,
          `Commentaires en attente de modération : ${commentaires}`,
          "",
          top.length ? "Les plus lus sur la période :" : "Aucune publication sur la période.",
          ...top.map((a, i) => `${i + 1}. ${a.title} — ${a.views} vues (${a.slug})`),
        ].join("\n")
      );
    },
  },
];

// ---------------------------------------------------------------------------
// Utilitaires de contenu
// ---------------------------------------------------------------------------

interface Bloc {
  type: string;
  text?: string;
  html?: string;
  cite?: string;
}

/**
 * Convertit le texte simple envoyé par le modèle en blocs de l'éditeur.
 * « ## » ouvre un intertitre, « > » une citation, le reste est du paragraphe.
 */
function texteVersBlocs(source: string): Bloc[] {
  return source
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((brut) => brut.trim())
    .filter(Boolean)
    .slice(0, 200)
    .map((morceau) => {
      if (morceau.startsWith("## ")) return { type: "h2", text: morceau.slice(3).trim() };
      if (morceau.startsWith("# ")) return { type: "h2", text: morceau.slice(2).trim() };
      if (morceau.startsWith("> ")) {
        return { type: "quote", text: morceau.replace(/^>\s?/gm, "").trim() };
      }
      // Les paragraphes coupés en plusieurs lignes sont recollés : un retour à
      // la ligne simple, dans un article, n'est pas un changement de paragraphe.
      return { type: "paragraph", text: morceau.replace(/\n+/g, " ") };
    });
}

/** Rend les blocs stockés sous une forme lisible par le modèle. */
function blocsVersTexte(body: unknown): string {
  if (!Array.isArray(body)) return "(corps vide)";
  return (body as Bloc[])
    .map((b) => {
      switch (b.type) {
        case "h2":
          return `## ${b.text ?? ""}`;
        case "quote":
          return `> ${b.text ?? ""}${b.cite ? `\n> — ${b.cite}` : ""}`;
        case "richtext":
          return (b.html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        case "image":
          return `[image] ${b.text ?? ""}`;
        default:
          return b.text ?? "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

/** ~200 mots/minute, minimum une minute — même règle que l'éditeur du Studio. */
function tempsDeLecture(blocks: Bloc[]): number {
  const mots = blocks.map((b) => b.text ?? "").join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(mots / 200));
}

function slugifie(titre: string): string {
  return titre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Ajoute un suffixe numérique tant que le slug est pris. */
async function slugLibre(titre: string): Promise<string> {
  const base = slugifie(titre) || "article";
  for (let i = 0; i < 50; i++) {
    const candidat = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await prisma.article.findUnique({ where: { slug: candidat }, select: { id: true } }))) {
      return candidat;
    }
  }
  return `${base}-${Date.now()}`;
}

function lienStudio(chemin: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://abidjan4all.info";
  return `${base}${chemin}`;
}

// ---------------------------------------------------------------------------
// Points d'entrée HTTP
// ---------------------------------------------------------------------------

function refusAuth(message: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://abidjan4all.info";
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: ERREUR.requeteInvalide, message } }),
    {
      status: 401,
      headers: {
        "content-type": "application/json",
        // `resource_metadata` (RFC 9728) indique au client où trouver le
        // serveur d'autorisation : c'est ce qui déclenche le flux OAuth de
        // l'application Claude au lieu d'un simple message d'échec.
        "www-authenticate": `Bearer realm="abidjan4all", resource_metadata="${base}/.well-known/oauth-protected-resource"`,
        "cache-control": "no-store",
      },
    }
  );
}

export async function POST(request: Request) {
  let corps: JsonRpcRequest | JsonRpcRequest[];
  try {
    corps = await request.json();
  } catch {
    return erreur(null, ERREUR.parse, "Corps JSON illisible.", 400);
  }

  // Les lots JSON-RPC ne sont pas utilisés par les clients MCP courants ;
  // on les refuse explicitement plutôt que de les ignorer en silence.
  if (Array.isArray(corps)) {
    return erreur(null, ERREUR.requeteInvalide, "Les lots de requêtes ne sont pas pris en charge.", 400);
  }

  const { id = null, method, params = {} } = corps ?? ({} as JsonRpcRequest);
  if (typeof method !== "string") {
    return erreur(id, ERREUR.requeteInvalide, "Champ « method » manquant.", 400);
  }

  // Les notifications (sans identifiant) n'attendent aucune réponse.
  const estNotification = corps.id === undefined || corps.id === null;
  if (method.startsWith("notifications/")) {
    return new Response(null, { status: 202 });
  }

  const moi = await verifierJeton(request);
  if (!moi) {
    return refusAuth(
      "Jeton d'accès manquant ou invalide. Créez-en un dans Studio ▸ Accès API, puis envoyez-le en en-tête Authorization: Bearer."
    );
  }

  switch (method) {
    case "initialize": {
      const demandee = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      return resultat(id, {
        protocolVersion: VERSIONS_CONNUES.includes(demandee) ? demandee : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }

    case "ping":
      return resultat(id, {});

    case "tools/list": {
      // Un outil hors des portées du jeton n'est même pas annoncé : le modèle
      // ne propose donc jamais une action qu'il ne pourrait pas exécuter.
      const visibles = OUTILS.filter((o) => autorise(moi, o.scope));
      return resultat(id, {
        tools: visibles.map((o) => ({
          name: o.name,
          title: o.title,
          description: o.description,
          inputSchema: o.inputSchema,
          annotations: {
            title: o.title,
            readOnlyHint: !o.ecrit,
            destructiveHint: false,
            openWorldHint: false,
          },
        })),
      });
    }

    case "tools/call": {
      const nom = typeof params.name === "string" ? params.name : "";
      const outil = OUTILS.find((o) => o.name === nom);
      if (!outil) return erreur(id, ERREUR.parametresInvalides, `Outil inconnu : « ${nom} ».`);
      if (!autorise(moi, outil.scope)) {
        return resultat(
          id,
          echec(
            `Ce jeton n'a pas la portée « ${outil.scope} » (ou le compte porteur n'a pas le rôle requis). ` +
              "Modifiez le jeton dans Studio ▸ Accès API."
          )
        );
      }

      const args = (params.arguments ?? {}) as Record<string, unknown>;
      try {
        return resultat(id, await outil.run(args, moi));
      } catch (e) {
        console.error(`[mcp] ${nom} a échoué`, e);
        return resultat(id, echec("L'opération a échoué côté serveur. Réessayez ou prévenez l'administrateur."));
      }
    }

    default:
      if (estNotification) return new Response(null, { status: 202 });
      return erreur(id, ERREUR.methodeInconnue, `Méthode inconnue : « ${method} ».`);
  }
}

/**
 * Certains clients ouvrent un flux SSE en GET pour recevoir des messages à
 * l'initiative du serveur. Nous n'en émettons pas : 405, comme le prévoit la
 * spécification, plutôt qu'une connexion qui ne dirait jamais rien.
 */
export function GET() {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: ERREUR.requeteInvalide, message: "Ce connecteur ne diffuse pas de flux SSE : utilisez POST." },
    }),
    { status: 405, headers: { "content-type": "application/json", allow: "POST" } }
  );
}
