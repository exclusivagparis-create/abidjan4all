/**
 * @a4a/ai — couche IA du cahier des charges (résumé, modération, recherche
 * générative). Utilise l'API Claude (SDK officiel) quand AI_API_KEY est
 * renseignée ; sinon, replis heuristiques déterministes pour le développement.
 *
 * Variables : AI_API_KEY (clé API Anthropic), AI_MODEL (défaut claude-opus-5).
 */
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-opus-5";

function getClient(): Anthropic | null {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

const model = () => process.env.AI_MODEL ?? DEFAULT_MODEL;

/**
 * Sur les modèles actuels, la réflexion est active par défaut et `max_tokens`
 * plafonne réflexion + réponse : une enveloppe trop juste tronque la sortie au
 * milieu. Chaque appel ci-dessous réserve donc de la marge et choisit son
 * niveau d'effort — « low » pour la modération et le dialogue (volume, latence),
 * « medium » pour le résumé et la traduction (fidélité au texte source).
 */

function firstText(content: Anthropic.ContentBlock[]): string {
  for (const block of content) {
    if (block.type === "text") return block.text;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Résumé d'article — GET /ai/summary/:articleId
// ---------------------------------------------------------------------------

export interface ArticleSummary {
  keyPoints: string[];
  long: string;
  /** "claude" ou "heuristique" — tracé dans Article.aiSummary */
  engine: string;
}

export async function summarizeArticle(title: string, text: string): Promise<ArticleSummary> {
  const client = getClient();
  if (!client) return heuristicSummary(title, text);

  const response = await client.messages.create({
    model: model(),
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    system:
      "Tu es secrétaire de rédaction pour Abidjan4All, média ivoirien. Tu résumes fidèlement, en français, sans rien inventer.",
    messages: [
      {
        role: "user",
        content: `Résume cet article.\n\nTitre : ${title}\n\n${text.slice(0, 24000)}`,
      },
    ],
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            keyPoints: {
              type: "array",
              items: { type: "string" },
              description: "3 à 5 points clés, une phrase chacun",
            },
            long: { type: "string", description: "Résumé de 3 à 4 phrases" },
          },
          required: ["keyPoints", "long"],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = JSON.parse(firstText(response.content)) as { keyPoints: string[]; long: string };
  return { ...parsed, engine: "claude" };
}

/** Repli sans clé : premières phrases + intertitres. */
function heuristicSummary(title: string, text: string): ArticleSummary {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 40);
  return {
    keyPoints: sentences.slice(0, 3).map((s) => s.trim()),
    long: sentences.slice(0, 4).join(" "),
    engine: "heuristique",
  };
}

// ---------------------------------------------------------------------------
// Modération de commentaire — POST /ai/moderate
// ---------------------------------------------------------------------------

export interface ModerationResult {
  /** 0 (sain) → 1 (toxique) */
  toxicity: number;
  action: "allow" | "review" | "block";
  engine: string;
}

const BLOCKLIST = [
  "idiot", "imbécile", "crétin", "abruti", "connard", "salope",
  "va mourir", "je vais te tuer", "sale race", "dégage du pays",
];

export async function moderateText(text: string): Promise<ModerationResult> {
  const client = getClient();
  if (!client) return heuristicModeration(text);

  const response = await client.messages.create({
    model: model(),
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system:
      "Tu modères les commentaires d'un média ivoirien. Évalue la toxicité (insultes, haine, menaces, spam) en tenant compte du français ivoirien et du nouchi.",
    messages: [{ role: "user", content: `Commentaire à évaluer :\n"""${text.slice(0, 4000)}"""` }],
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            toxicity: { type: "number", description: "0 = sain, 1 = très toxique" },
            action: { type: "string", enum: ["allow", "review", "block"] },
          },
          required: ["toxicity", "action"],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = JSON.parse(firstText(response.content)) as { toxicity: number; action: ModerationResult["action"] };
  return { ...parsed, engine: "claude" };
}

/** Repli sans clé : liste de mots + heuristiques simples (majuscules, liens). */
function heuristicModeration(text: string): ModerationResult {
  const lower = text.toLowerCase();
  const hits = BLOCKLIST.filter((w) => lower.includes(w)).length;
  const shouting = text.length > 20 && text === text.toUpperCase() ? 0.2 : 0;
  const links = (text.match(/https?:\/\//g)?.length ?? 0) > 2 ? 0.3 : 0;
  const toxicity = Math.min(1, hits * 0.4 + shouting + links);
  return {
    toxicity,
    action: toxicity >= 0.7 ? "block" : toxicity >= 0.3 ? "review" : "allow",
    engine: "heuristique",
  };
}

// ---------------------------------------------------------------------------
// Traduction d'article — POST /ai/translate
// ---------------------------------------------------------------------------

export interface ArticleTranslation {
  title: string;
  body: string;
  engine: string;
}

/** Traduit un article (fr→en pour « Africa in English », ou l'inverse). */
export async function translateArticle(
  title: string,
  text: string,
  target: "en" | "fr"
): Promise<ArticleTranslation> {
  const client = getClient();
  if (!client) return heuristicTranslation(title, text, target);

  const langue = target === "en" ? "anglais" : "français";
  const response = await client.messages.create({
    model: model(),
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system:
      `Tu es traducteur de presse pour Abidjan4All, média ivoirien. Tu traduis fidèlement vers le ${langue}, ` +
      "registre journalistique, sans rien ajouter ni omettre. Les noms propres, sigles (BRVM, CAN…) et montants restent tels quels.",
    messages: [
      { role: "user", content: `Traduis cet article.\n\nTitre : ${title}\n\n${text.slice(0, 24000)}` },
    ],
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Titre traduit" },
            body: { type: "string", description: "Corps traduit, paragraphes séparés par des sauts de ligne" },
          },
          required: ["title", "body"],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = JSON.parse(firstText(response.content)) as { title: string; body: string };
  return { ...parsed, engine: "claude" };
}

/** Repli sans clé : contenu inchangé, balisé comme non traduit. */
function heuristicTranslation(title: string, text: string, target: "en" | "fr"): ArticleTranslation {
  const notice =
    target === "en"
      ? "[Automatic translation unavailable — original French text follows.]"
      : "[Traduction automatique indisponible — texte original ci-dessous.]";
  return { title, body: `${notice}\n\n${text}`, engine: "heuristique" };
}

// ---------------------------------------------------------------------------
// Assistant éditorial — POST /ai/chat
// ---------------------------------------------------------------------------

export interface ChatReply {
  reply: string;
  sources: SearchSource[];
  engine: string;
}

/**
 * Répond au lecteur à partir des extraits fournis (article courant et/ou
 * résultats de recherche) — mêmes règles d'ancrage que la recherche.
 */
export async function chatReply(message: string, sources: SearchSource[]): Promise<ChatReply> {
  const client = getClient();
  if (!client) return heuristicChat(message, sources);

  const corpus =
    sources.length > 0
      ? sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}`).join("\n\n")
      : "(aucun extrait fourni)";

  const response = await client.messages.create({
    model: model(),
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system:
      "Tu es l'assistant éditorial d'Abidjan4All, média ivoirien. Tu réponds en français, brièvement et cordialement, " +
      "en t'appuyant d'abord sur les extraits fournis (cite-les par leur numéro [n]). Hors de leur périmètre, reste général " +
      "et renvoie vers la rédaction ; jamais de conseil médical, juridique ou financier personnalisé.",
    messages: [{ role: "user", content: `Message du lecteur : ${message}\n\nExtraits :\n${corpus}` }],
  });

  return { reply: firstText(response.content), sources, engine: "claude" };
}

/** Repli sans clé : renvoie les extraits pertinents, sans génération. */
function heuristicChat(message: string, sources: SearchSource[]): ChatReply {
  if (sources.length === 0) {
    return {
      reply:
        "Je n'ai pas trouvé d'article correspondant à votre question. Reformulez, ou parcourez les rubriques — la rédaction publie tous les jours.",
      sources: [],
      engine: "heuristique",
    };
  }
  const top = sources.slice(0, 3);
  return {
    reply:
      "Voici ce que la rédaction a publié à ce sujet : " +
      top.map((s, i) => `${s.title} [${i + 1}]`).join(" · "),
    sources: top,
    engine: "heuristique",
  };
}

// ---------------------------------------------------------------------------
// Réponse générative de recherche — GET /ai/search
// ---------------------------------------------------------------------------

export interface SearchSource {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchAnswer {
  answer: string;
  sources: SearchSource[];
  engine: string;
}

export async function answerFromSources(query: string, sources: SearchSource[]): Promise<SearchAnswer> {
  if (sources.length === 0) {
    return { answer: "", sources: [], engine: "aucune-source" };
  }

  const client = getClient();
  if (!client) return heuristicAnswer(query, sources);

  const corpus = sources
    .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: model(),
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system:
      "Tu es l'assistant de recherche d'Abidjan4All. Tu réponds en français, uniquement à partir des extraits d'articles fournis, en citant les sources par leur numéro [n]. Si les extraits ne suffisent pas, dis-le.",
    messages: [
      { role: "user", content: `Question : ${query}\n\nExtraits d'articles :\n${corpus}` },
    ],
  });

  return { answer: firstText(response.content), sources, engine: "claude" };
}

/** Repli sans clé : synthèse extractive des meilleurs extraits. */
function heuristicAnswer(query: string, sources: SearchSource[]): SearchAnswer {
  const top = sources.slice(0, 3);
  const answer =
    `D'après nos articles, voici ce que la rédaction a publié sur « ${query} » : ` +
    top.map((s, i) => `${s.snippet.replace(/<\/?mark>/g, "")} [${i + 1}]`).join(" ");
  return { answer, sources: top, engine: "heuristique" };
}
