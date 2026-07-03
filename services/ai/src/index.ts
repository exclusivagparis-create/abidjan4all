/**
 * @a4a/ai — couche IA du cahier des charges (résumé, modération, recherche
 * générative). Utilise l'API Claude (SDK officiel) quand AI_API_KEY est
 * renseignée ; sinon, replis heuristiques déterministes pour le développement.
 *
 * Variables : AI_API_KEY (clé API Anthropic), AI_MODEL (défaut claude-opus-4-8).
 */
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-opus-4-8";

function getClient(): Anthropic | null {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

const model = () => process.env.AI_MODEL ?? DEFAULT_MODEL;

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
    max_tokens: 2048,
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
    max_tokens: 256,
    system:
      "Tu modères les commentaires d'un média ivoirien. Évalue la toxicité (insultes, haine, menaces, spam) en tenant compte du français ivoirien et du nouchi.",
    messages: [{ role: "user", content: `Commentaire à évaluer :\n"""${text.slice(0, 4000)}"""` }],
    output_config: {
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
    max_tokens: 1024,
    thinking: { type: "adaptive" },
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
