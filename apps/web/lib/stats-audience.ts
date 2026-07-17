import "server-only";
import { prisma, Prisma } from "@a4a/db";

/**
 * Chiffres d'audience d'un mois donné, calculés depuis la table PageView.
 *
 * Vocabulaire (celui de l'éditeur) :
 *  - pages vues : chaque affichage de page ;
 *  - visites    : une venue ; les pages consultées à moins de 30 min d'écart
 *                 comptent pour une seule visite ;
 *  - visiteurs  : personnes distinctes, comptées une fois par JOUR (l'empreinte
 *                 change chaque jour — c'est le prix du respect de la vie
 *                 privée : quelqu'un qui revient trois jours compte trois fois
 *                 sur le mois, mais une seule fois par jour).
 */

export type JourAudience = { jour: string; visites: number; pagesVues: number };

export type AudienceMois = {
  parJour: JourAudience[];
  visiteurs: number;
  visites: number;
  pagesVues: number;
  visitesMobiles: number;
  videosVues: number;
  podcastsVus: number;
  inscritsSite: number;
  inscritsNewsletter: number;
  pays: Array<{ code: string; visites: number }>;
};

/** Bornes UTC du mois `AAAA-MM`. */
export function bornesDuMois(mois: string): { debut: Date; fin: Date } {
  const [a, m] = mois.split("-").map(Number);
  const debut = new Date(Date.UTC(a!, m! - 1, 1));
  const fin = new Date(Date.UTC(a!, m!, 1));
  return { debut, fin };
}

/** Mois proposés dans le menu : du plus récent au premier enregistrement. */
export async function moisDisponibles(): Promise<string[]> {
  const premier = await prisma.pageView.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const debut = premier?.createdAt ?? new Date();
  const liste: string[] = [];
  const curseur = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), 1));
  const maintenant = new Date();
  const dernier = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1));
  while (curseur <= dernier) {
    liste.push(`${curseur.getUTCFullYear()}-${String(curseur.getUTCMonth() + 1).padStart(2, "0")}`);
    curseur.setUTCMonth(curseur.getUTCMonth() + 1);
  }
  return liste.reverse();
}

export async function audienceDuMois(mois: string): Promise<AudienceMois> {
  const { debut, fin } = bornesDuMois(mois);
  const periode = { gte: debut, lt: fin };

  const [parJourBrut, visiteursRow, visitesRow, pagesVues, mobilesRow, videos, podcasts, inscritsSite, inscritsNl, paysBrut] =
    await Promise.all([
      // Par jour : visites (sessions distinctes) et pages vues.
      prisma.$queryRaw<Array<{ jour: Date; visites: bigint; pages: bigint }>>(Prisma.sql`
        SELECT date_trunc('day', "createdAt") AS jour,
               COUNT(DISTINCT "sessionId")::bigint AS visites,
               COUNT(*)::bigint AS pages
        FROM "PageView"
        WHERE "createdAt" >= ${debut} AND "createdAt" < ${fin}
        GROUP BY 1 ORDER BY 1
      `),
      // Visiteurs : empreintes distinctes par jour, sommées sur le mois.
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COALESCE(SUM(n), 0)::bigint AS total FROM (
          SELECT COUNT(DISTINCT "visitorHash") AS n
          FROM "PageView"
          WHERE "createdAt" >= ${debut} AND "createdAt" < ${fin}
          GROUP BY date_trunc('day', "createdAt")
        ) parJour
      `),
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(DISTINCT "sessionId")::bigint AS total FROM "PageView"
        WHERE "createdAt" >= ${debut} AND "createdAt" < ${fin}
      `),
      prisma.pageView.count({ where: { createdAt: periode } }),
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(DISTINCT "sessionId")::bigint AS total FROM "PageView"
        WHERE "createdAt" >= ${debut} AND "createdAt" < ${fin} AND device = 'mobile'
      `),
      prisma.pageView.count({ where: { createdAt: periode, kind: "video" } }),
      prisma.pageView.count({ where: { createdAt: periode, kind: "podcast" } }),
      prisma.user.count({ where: { createdAt: periode } }),
      prisma.newsletterSubscription.count({ where: { createdAt: periode } }),
      prisma.$queryRaw<Array<{ country: string | null; visites: bigint }>>(Prisma.sql`
        SELECT country, COUNT(DISTINCT "sessionId")::bigint AS visites
        FROM "PageView"
        WHERE "createdAt" >= ${debut} AND "createdAt" < ${fin} AND country IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 8
      `),
    ]);

  // Tous les jours du mois, y compris ceux sans trafic (sinon le graphe ment).
  const parJourMap = new Map(
    parJourBrut.map((r) => [r.jour.toISOString().slice(0, 10), { visites: Number(r.visites), pagesVues: Number(r.pages) }])
  );
  const parJour: JourAudience[] = [];
  const curseur = new Date(debut);
  const aujourdHui = new Date();
  while (curseur < fin && curseur <= aujourdHui) {
    const cle = curseur.toISOString().slice(0, 10);
    const v = parJourMap.get(cle);
    parJour.push({ jour: cle, visites: v?.visites ?? 0, pagesVues: v?.pagesVues ?? 0 });
    curseur.setUTCDate(curseur.getUTCDate() + 1);
  }

  return {
    parJour,
    visiteurs: Number(visiteursRow[0]?.total ?? 0),
    visites: Number(visitesRow[0]?.total ?? 0),
    pagesVues,
    visitesMobiles: Number(mobilesRow[0]?.total ?? 0),
    videosVues: videos,
    podcastsVus: podcasts,
    inscritsSite,
    inscritsNewsletter: inscritsNl,
    pays: paysBrut.map((p) => ({ code: p.country ?? "?", visites: Number(p.visites) })),
  };
}
