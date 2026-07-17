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

// ---------------------------------------------------------------------------
// Vue historique : par année et par mois (audience + revenus)
// ---------------------------------------------------------------------------

export type MoisHistorique = { mois: number; visites: number; pagesVues: number; revenus: number };

export type AnneeHistorique = {
  annee: number;
  mois: MoisHistorique[]; // toujours 12 entrées (jan → déc), même vides
  totalVisites: number;
  totalPagesVues: number;
  totalRevenus: number;
};

export type SyntheseAnnee = { annee: number; visites: number; pagesVues: number; revenus: number };

/** Années couvertes par les données (audience OU revenus), de la plus récente. */
export async function anneesDisponibles(): Promise<number[]> {
  const [premierePv, premierPay] = await Promise.all([
    prisma.pageView.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.payment.findFirst({
      where: { status: "succeeded" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);
  const dates = [premierePv?.createdAt, premierPay?.createdAt].filter(Boolean) as Date[];
  const debut = dates.length ? Math.min(...dates.map((d) => d.getUTCFullYear())) : new Date().getUTCFullYear();
  const fin = new Date().getUTCFullYear();
  const annees: number[] = [];
  for (let a = fin; a >= debut; a--) annees.push(a);
  return annees;
}

/** Total audience + revenus par année (le tableau « historique annuel »). */
export async function syntheseAnnuelle(): Promise<SyntheseAnnee[]> {
  const [pv, rev] = await Promise.all([
    prisma.$queryRaw<Array<{ annee: number; visites: bigint; pages: bigint }>>(Prisma.sql`
      SELECT EXTRACT(YEAR FROM "createdAt")::int AS annee,
             COUNT(DISTINCT "sessionId")::bigint AS visites,
             COUNT(*)::bigint AS pages
      FROM "PageView" GROUP BY 1
    `),
    prisma.$queryRaw<Array<{ annee: number; total: bigint }>>(Prisma.sql`
      SELECT EXTRACT(YEAR FROM "createdAt")::int AS annee, SUM(amount)::bigint AS total
      FROM "Payment" WHERE status = 'succeeded' GROUP BY 1
    `),
  ]);
  const map = new Map<number, SyntheseAnnee>();
  const get = (a: number) => {
    if (!map.has(a)) map.set(a, { annee: a, visites: 0, pagesVues: 0, revenus: 0 });
    return map.get(a)!;
  };
  for (const r of pv) {
    const e = get(r.annee);
    e.visites = Number(r.visites);
    e.pagesVues = Number(r.pages);
  }
  for (const r of rev) get(r.annee).revenus = Number(r.total);
  return [...map.values()].sort((a, b) => b.annee - a.annee);
}

/** Détail mois par mois d'une année : visites, pages vues, revenus encaissés. */
export async function historiqueAnnee(annee: number): Promise<AnneeHistorique> {
  const debut = new Date(Date.UTC(annee, 0, 1));
  const fin = new Date(Date.UTC(annee + 1, 0, 1));

  const [audience, revenus] = await Promise.all([
    prisma.$queryRaw<Array<{ mois: number; visites: bigint; pages: bigint }>>(Prisma.sql`
      SELECT EXTRACT(MONTH FROM "createdAt")::int AS mois,
             COUNT(DISTINCT "sessionId")::bigint AS visites,
             COUNT(*)::bigint AS pages
      FROM "PageView"
      WHERE "createdAt" >= ${debut} AND "createdAt" < ${fin}
      GROUP BY 1
    `),
    prisma.$queryRaw<Array<{ mois: number; total: bigint }>>(Prisma.sql`
      SELECT EXTRACT(MONTH FROM "createdAt")::int AS mois, SUM(amount)::bigint AS total
      FROM "Payment"
      WHERE status = 'succeeded' AND "createdAt" >= ${debut} AND "createdAt" < ${fin}
      GROUP BY 1
    `),
  ]);

  const parMois = new Map(audience.map((r) => [r.mois, { visites: Number(r.visites), pages: Number(r.pages) }]));
  const parMoisRev = new Map(revenus.map((r) => [r.mois, Number(r.total)]));

  const mois: MoisHistorique[] = [];
  for (let m = 1; m <= 12; m++) {
    mois.push({
      mois: m,
      visites: parMois.get(m)?.visites ?? 0,
      pagesVues: parMois.get(m)?.pages ?? 0,
      revenus: parMoisRev.get(m) ?? 0,
    });
  }

  return {
    annee,
    mois,
    totalVisites: mois.reduce((s, m) => s + m.visites, 0),
    totalPagesVues: mois.reduce((s, m) => s + m.pagesVues, 0),
    totalRevenus: mois.reduce((s, m) => s + m.revenus, 0),
  };
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
