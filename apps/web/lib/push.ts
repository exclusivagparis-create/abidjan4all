import webpush from "web-push";
import { prisma } from "@a4a/db";
import { SITE_URL } from "@/lib/seo";

/**
 * Envoi Web Push (VAPID) — DF-04 « breaking news, alertes rubrique ».
 * Sans clés VAPID dans l'environnement, tout est neutralisé (comme la
 * couche IA sans AI_API_KEY) : le site fonctionne, aucun envoi.
 */
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

export const pushConfigured = Boolean(PUBLIC_KEY && PRIVATE_KEY);

if (pushConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:contact@abidjan4all.info",
    PUBLIC_KEY!,
    PRIVATE_KEY!
  );
}

type PushPayload = { title: string; body: string; url: string };

/** Envoie à une liste d'abonnements ; purge ceux expirés (404/410). */
async function sendToSubscriptions(
  subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload
): Promise<number> {
  const json = JSON.stringify(payload);
  let sent = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
          { TTL: 3600 }
        );
        sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
        else console.error(`[push] échec envoi (${status ?? "?"}) ${s.endpoint.slice(0, 60)}…`);
      }
    })
  );

  if (dead.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } });
    console.log(`[push] ${dead.length} abonnement(s) expiré(s) purgé(s)`);
  }
  return sent;
}

/**
 * Alerte « breaking news » manuelle : notification envoyée à TOUS les
 * abonnés push (le Studio compose titre, message et destination). Renvoie le
 * nombre de notifications réellement envoyées.
 */
export async function sendBroadcast(payload: { title: string; body: string; url: string }): Promise<number> {
  if (!pushConfigured) return 0;
  const subs = await prisma.pushSubscription.findMany({
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return 0;
  const sent = await sendToSubscriptions(subs, payload);
  console.log(`[push] alerte « ${payload.title} » : ${sent}/${subs.length} notification(s) envoyée(s)`);
  return sent;
}

/**
 * Alerte de publication d'un article : abonnés anonymes et comptes sans
 * intérêts reçoivent tout ; les comptes avec intérêts ne reçoivent que
 * leurs rubriques suivies.
 */
export async function sendArticleAlert(articleId: string): Promise<void> {
  if (!pushConfigured) return;

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { title: true, slug: true, status: true, rubrique: { select: { id: true, name: true, slug: true } } },
  });
  if (!article || article.status !== "published") return;

  const subs = await prisma.pushSubscription.findMany({
    where: {
      OR: [
        { userId: null },
        { user: { interests: { isEmpty: true } } },
        { user: { interests: { has: article.rubrique.id } } },
      ],
    },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return;

  const sent = await sendToSubscriptions(subs, {
    title: `${article.rubrique.name} — Abidjan4All`,
    body: article.title,
    url: `${SITE_URL}/${article.rubrique.slug}/${article.slug}`,
  });
  console.log(`[push] « ${article.title} » : ${sent}/${subs.length} notification(s) envoyée(s)`);
}
