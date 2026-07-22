import { prisma } from "@a4a/db";
import { sendArticleAlert } from "@/lib/push";
import { sendMonthlyAdReports } from "@/lib/ad-reports";

/**
 * Bascule scheduled→published quand l'heure programmée est atteinte.
 * Les pages publiques (ISR 60 s) reflètent le changement dans la minute.
 */
export async function publishDueArticles(): Promise<number> {
  const due = await prisma.article.findMany({
    where: { status: "scheduled", scheduledAt: { lte: new Date() } },
    select: { id: true, coverAsset: { select: { url: true } } },
  });
  if (due.length === 0) return 0;

  // Image de couverture obligatoire, comme à la publication manuelle : une
  // couverture retirée après la programmation ne doit pas passer en douce.
  // Les articles concernés restent « programmés » (leur heure est dépassée) —
  // ils partiront dès qu'une image sera ajoutée. On les signale sans bloquer.
  const prets = due.filter((a) => a.coverAsset?.url && !a.coverAsset.url.startsWith("placeholder://"));
  const bloques = due.length - prets.length;
  if (bloques > 0) {
    console.warn(`[scheduler] ${bloques} article(s) programmé(s) sans image de couverture — non publiés.`);
  }
  if (prets.length === 0) return 0;

  const ids = prets.map((a) => a.id);
  const { count } = await prisma.article.updateMany({
    where: { id: { in: ids } },
    data: { status: "published", publishedAt: new Date(), scheduledAt: null },
  });
  console.log(`[scheduler] ${count} article(s) programmé(s) publié(s)`);
  for (const id of ids) {
    sendArticleAlert(id).catch((e) => console.error("[push]", e));
  }
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
    envoyerRapportsSiDebutDeMois();
  }, INTERVAL_MS);
  console.log("[scheduler] publication automatique des programmés — toutes les 60 s");
  publishDueArticles().catch((e) => console.error("[scheduler]", e));
  envoyerRapportsSiDebutDeMois();
}

/**
 * Rapports mensuels : tentés dans les premiers jours du mois. `sendMonthly-
 * AdReports` est idempotent (un envoi par annonceur et par période), donc les
 * appels répétés ne créent pas de doublon — inutile de mémoriser la dernière
 * exécution. Silencieux s'il n'y a rien à envoyer.
 */
function envoyerRapportsSiDebutDeMois() {
  if (new Date().getDate() > 3) return;
  sendMonthlyAdReports()
    .then((r) => {
      if (r.envoyes > 0) console.log(`[scheduler] rapports annonceurs : ${r.envoyes} envoyé(s)`);
    })
    .catch((e) => console.error("[scheduler:rapports]", e));
}
