import { prisma } from "@a4a/db";

/**
 * Bascule scheduled→published quand l'heure programmée est atteinte.
 * Les pages publiques (ISR 60 s) reflètent le changement dans la minute.
 */
export async function publishDueArticles(): Promise<number> {
  const { count } = await prisma.article.updateMany({
    where: { status: "scheduled", scheduledAt: { lte: new Date() } },
    data: { status: "published", publishedAt: new Date(), scheduledAt: null },
  });
  if (count > 0) console.log(`[scheduler] ${count} article(s) programmé(s) publié(s)`);
  return count;
}

const INTERVAL_MS = 60_000;

// évite un double démarrage (HMR en dev, imports multiples)
const g = globalThis as unknown as { a4aScheduler?: NodeJS.Timeout };

/**
 * Démarré par instrumentation.ts au boot du serveur Node.
 * En production multi-instances, remplacer par un vrai cron (worker/queue).
 */
export function startScheduler() {
  if (g.a4aScheduler) return;
  g.a4aScheduler = setInterval(() => {
    publishDueArticles().catch((e) => console.error("[scheduler]", e));
  }, INTERVAL_MS);
  console.log("[scheduler] publication automatique des programmés — toutes les 60 s");
  publishDueArticles().catch((e) => console.error("[scheduler]", e));
}
