import { prisma } from "@a4a/db";

/**
 * KPI du Business Model 2026-2031 (§5.3).
 *
 * Certains indicateurs du document ne sont PAS mesurables par la plateforme
 * telle qu'elle existe (taux d'ouverture, NPS, téléchargements d'application).
 * Ils sont listés quand même, marqués « non mesuré », avec ce qu'il faudrait
 * pour les obtenir — mieux vaut un trou assumé qu'un chiffre inventé.
 */

export type Kpi = {
  label: string;
  /** Valeur mesurée, ou null si l'indicateur n'est pas mesurable aujourd'hui. */
  valeur: number | null;
  /** Rendu de la valeur (les pourcentages et montants ne s'affichent pas nus). */
  unite?: "nombre" | "pourcent" | "fcfa";
  cible2027: string;
  cible2028: string;
  cible2030: string;
  /** Pourquoi la valeur manque, et ce qu'il faudrait pour l'avoir. */
  note?: string;
};

const MOIS_MS = 30 * 24 * 3600 * 1000;

export async function kpiBusinessModel(): Promise<Kpi[]> {
  const now = new Date();
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
  const il30j = new Date(now.getTime() - MOIS_MS);
  const il12m = new Date(now.getFullYear() - 1, now.getMonth(), 1);

  const [
    visiteurs,
    inscritsNewsletter,
    abonnesActifs,
    resiliesAn,
    abonnesDebutAn,
    annonceursActifs,
    interviewsMois,
    abonnesB2B,
    paiements12m,
    pagesVues30j,
  ] = await Promise.all([
    // Visiteurs uniques du mois : l'empreinte change chaque nuit (choix de
    // confidentialité), donc c'est un cumul de visiteurs-jours, pas un
    // dédoublonnage sur le mois. Assumé et dit à l'écran.
    prisma.pageView.findMany({
      where: { createdAt: { gte: debutMois } },
      distinct: ["visitorHash"],
      select: { visitorHash: true },
    }),
    prisma.newsletterSubscription.count({ where: { confirmed: true } }),
    prisma.subscription.count({
      where: { plan: { not: "free" }, status: "active" },
    }),
    prisma.subscription.count({
      where: { plan: { not: "free" }, status: "canceled", currentPeriodEnd: { gte: il12m } },
    }),
    prisma.subscription.count({
      where: { plan: { not: "free" }, since: { lt: il12m } },
    }),
    prisma.adCampaign.count({ where: { status: "active" } }),
    // « Interviews A4A Business » : les affaires gagnées du mois sur l'offre.
    prisma.brandLead.count({
      where: {
        status: "gagne",
        updatedAt: { gte: debutMois },
        offer: { slug: "business-interview" },
      },
    }),
    prisma.briefAbonnement.count({ where: { expiresAt: { gt: now } } }),
    prisma.payment.findMany({
      where: { status: "succeeded", createdAt: { gte: il12m } },
      select: { amount: true },
    }),
    prisma.pageView.count({ where: { createdAt: { gte: il30j } } }),
  ]);

  // Churn annuel : résiliations sur 12 mois rapportées au parc de départ.
  const churn = abonnesDebutAn > 0 ? (resiliesAn / abonnesDebutAn) * 100 : null;

  // ARPU : revenu d'abonnement des 12 derniers mois / pages vues sur 30 jours,
  // ramené au mois. Le BP raisonne en « CA par visiteur » — même esprit.
  const ca12m = paiements12m.reduce((s, p) => s + p.amount, 0);
  const arpu = pagesVues30j > 0 ? Math.round((ca12m / 12 / pagesVues30j) * 100) / 100 : null;

  // LTV = prix moyen d'une offre × durée de vie moyenne (1 / taux de churn).
  // Les offres sont lues en base : une liste écrite ici aurait ignoré toute
  // offre ouverte depuis, et faussé la LTV sans que rien ne le signale.
  const offresPayantes = await prisma.offer.findMany({
    where: { id: { not: "free" }, price: { gt: 0 }, active: true },
    select: { price: true },
  });
  const prixMoyen = offresPayantes.length
    ? offresPayantes.reduce((s, o) => s + o.price, 0) / offresPayantes.length
    : 0;
  const ltv = churn && churn > 0 ? Math.round(prixMoyen * 12 * (100 / churn)) : null;

  return [
    {
      label: "Visiteurs uniques (mois en cours)",
      valeur: visiteurs.length,
      unite: "nombre",
      cible2027: "300 000",
      cible2028: "800 000",
      cible2030: "2 500 000",
      note: "Empreinte renouvelée chaque nuit (aucun suivi d'un jour à l'autre) : c'est un cumul de visiteurs quotidiens, il surestime le nombre de personnes distinctes sur le mois.",
    },
    {
      label: "Inscrits newsletter",
      valeur: inscritsNewsletter,
      unite: "nombre",
      cible2027: "30 000",
      cible2028: "80 000",
      cible2030: "200 000",
    },
    {
      label: "Taux d'ouverture newsletter",
      valeur: null,
      unite: "pourcent",
      cible2027: "35 %",
      cible2028: "40 %",
      cible2030: "45 %",
      note: "Non mesuré : il faudrait un pixel de suivi dans chaque envoi, ce qui suppose d'informer les inscrits et de tracer leur lecture.",
    },
    {
      label: "Membres Premium A4A+ actifs",
      valeur: abonnesActifs,
      unite: "nombre",
      cible2027: "400",
      cible2028: "2 000",
      cible2030: "8 000",
    },
    {
      label: "Taux de churn annuel",
      valeur: churn === null ? null : Math.round(churn * 10) / 10,
      unite: "pourcent",
      cible2027: "< 10 %",
      cible2028: "< 8 %",
      cible2030: "< 6 %",
      note: churn === null ? "Aucun abonné de plus de 12 mois : le calcul n'a pas encore de base." : undefined,
    },
    {
      label: "Annonceurs display actifs",
      valeur: annonceursActifs,
      unite: "nombre",
      cible2027: "15",
      cible2028: "35",
      cible2030: "70",
    },
    {
      label: "Interviews A4A Business (mois)",
      valeur: interviewsMois,
      unite: "nombre",
      cible2027: "3",
      cible2028: "6",
      cible2030: "10",
      note: "Compte les demandes Brand Content marquées « gagné » ce mois-ci sur l'offre Business Interview.",
    },
    {
      label: "Abonnés B2B Intelligence Éco",
      valeur: abonnesB2B,
      unite: "nombre",
      cible2027: "50",
      cible2028: "200",
      cible2030: "500",
    },
    {
      label: "Téléchargements application mobile",
      valeur: null,
      unite: "nombre",
      cible2027: "3 000",
      cible2028: "20 000",
      cible2030: "120 000",
      note: "Non mesuré : il n'existe pas d'application mobile à ce jour. Le site est consultable au téléphone, mais ce n'est pas la même chose.",
    },
    {
      label: "NPS abonnés Premium",
      valeur: null,
      cible2027: "> 40",
      cible2028: "> 50",
      cible2030: "> 60",
      note: "Non mesuré : suppose d'envoyer une enquête de satisfaction aux abonnés et d'en collecter les réponses.",
    },
    {
      label: "CA par visiteur (ARPU mensuel)",
      valeur: arpu,
      unite: "fcfa",
      cible2027: "0,13",
      cible2028: "0,12",
      cible2030: "0,12",
      note: "Revenu d'abonnement des 12 derniers mois ramené au mois, divisé par les pages vues sur 30 jours.",
    },
    {
      label: "LTV abonné Premium",
      valeur: ltv,
      unite: "fcfa",
      cible2027: "18 000",
      cible2028: "22 000",
      cible2030: "30 000",
      note:
        ltv === null
          ? "Calculable dès qu'un taux de churn existe (prix moyen × durée de vie estimée)."
          : "Prix moyen des offres × durée de vie déduite du taux de churn.",
    },
  ];
}
