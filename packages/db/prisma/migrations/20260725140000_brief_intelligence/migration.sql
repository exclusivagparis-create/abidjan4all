-- AlterEnum
-- Abonnement A4A Intelligence : nouvelle nature de commande one-off.
ALTER TYPE "OrderKind" ADD VALUE 'brief_abonnement';

-- CreateEnum
CREATE TYPE "BriefKind" AS ENUM ('rapport', 'revue', 'classement', 'etude', 'revue_presse');

-- CreateTable
CREATE TABLE "BriefSerie" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "BriefKind" NOT NULL,
    "title" TEXT NOT NULL,
    "pitch" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cible" TEXT NOT NULL,
    "prixAnnuel" INTEGER NOT NULL,
    "dureeMois" INTEGER NOT NULL DEFAULT 12,
    "rythme" TEXT NOT NULL,
    "coverUrl" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefSerie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefEdition" (
    "id" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "resume" TEXT NOT NULL,
    "body" JSONB,
    "fileUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefEdition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefAbonnement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BriefAbonnement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BriefSerie_slug_key" ON "BriefSerie"("slug");
CREATE INDEX "BriefSerie_actif_ordre_idx" ON "BriefSerie"("actif", "ordre");
CREATE UNIQUE INDEX "BriefEdition_serieId_numero_key" ON "BriefEdition"("serieId", "numero");
CREATE INDEX "BriefEdition_serieId_publishedAt_idx" ON "BriefEdition"("serieId", "publishedAt");
CREATE UNIQUE INDEX "BriefAbonnement_userId_serieId_key" ON "BriefAbonnement"("userId", "serieId");
CREATE INDEX "BriefAbonnement_serieId_idx" ON "BriefAbonnement"("serieId");

-- AddForeignKey
ALTER TABLE "BriefEdition" ADD CONSTRAINT "BriefEdition_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "BriefSerie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BriefAbonnement" ADD CONSTRAINT "BriefAbonnement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BriefAbonnement" ADD CONSTRAINT "BriefAbonnement_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "BriefSerie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed : les 5 produits d'intelligence économique du Business Model 2026-2031
-- (§4.1 pilier 4). Prix et cibles repris du document ; ajustables au Studio.
INSERT INTO "BriefSerie" ("id", "slug", "kind", "title", "pitch", "description", "cible", "prixAnnuel", "dureeMois", "rythme", "ordre", "updatedAt") VALUES
  ('briefcacao000000000000001', 'cacao-cafe', 'rapport',
   'Rapport mensuel Cacao & Café Côte d''Ivoire',
   'Le point de référence mensuel sur les deux premières filières agricoles ivoiriennes.',
   'Chaque mois : évolution des cours, volumes de campagne, décisions du Conseil du Café-Cacao, météo des zones de production, positions des exportateurs et lecture des marchés internationaux. Un document de travail directement exploitable en salle de marché.',
   'Traders, courtiers, exportateurs, coopératives', 150000, 12, 'mensuel', 10, NOW()),
  ('briefinvest00000000000002', 'investissements-afrique-ouest', 'revue',
   'Revue trimestrielle Investissements Afrique de l''Ouest',
   'Les mouvements de capitaux, levées et opérations de la zone UEMOA, tous les trimestres.',
   'Panorama trimestriel des investissements en Afrique de l''Ouest : levées de fonds, fusions-acquisitions, entrées de fonds souverains, projets d''infrastructure, évolutions réglementaires et fiscales. Avec les tableaux de deals et les fiches des opérations marquantes.',
   'Fonds d''investissement, banques, directions générales', 300000, 12, 'trimestriel', 20, NOW()),
  ('briefclassement000000003', 'top-100-entreprises-ci', 'classement',
   'Classement annuel Top 100 Entreprises de Côte d''Ivoire',
   'Le palmarès annuel des cent premières entreprises ivoiriennes, par chiffre d''affaires et par secteur.',
   'Classement annuel construit sur les publications officielles et les données collectées par la rédaction : chiffre d''affaires, effectifs, croissance, secteur, actionnariat. Accompagné des analyses sectorielles et du portrait des entreprises en plus forte progression.',
   'Entreprises, institutionnels, cabinets de conseil', 200000, 12, 'annuel', 30, NOW()),
  ('briefetude0000000000004', 'etudes-sectorielles', 'etude',
   'Études sectorielles sur mesure',
   'Une étude conçue pour votre question précise, livrée sous 4 à 6 semaines.',
   'La rédaction et son réseau d''experts produisent une étude dédiée : cadrage du marché, acteurs en présence, chiffres clés, environnement réglementaire, recommandations. Périmètre et livrable définis avec vous au lancement.',
   'Ambassades, cabinets, ONG, directions stratégie', 500000, 12, 'à la demande', 40, NOW()),
  ('briefpresse000000000005', 'revue-presse-corporate', 'revue_presse',
   'Revue de presse personnalisée Corporate',
   'Votre veille quotidienne sur votre marque, vos concurrents et votre secteur.',
   'Chaque matin, la sélection de ce qui a été publié sur votre entreprise, vos concurrents et votre secteur dans la presse ivoirienne et panafricaine, avec mise en perspective par la rédaction. Périmètre de veille défini avec vous et ajustable à tout moment.',
   'Grandes entreprises, directions communication', 2400000, 12, 'quotidien', 50, NOW());
