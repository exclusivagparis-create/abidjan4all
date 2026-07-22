-- CreateEnum
CREATE TYPE "AdPriority" AS ENUM ('basse', 'moyenne', 'haute');

-- AlterTable : la campagne devient un conteneur (ciblage/période/plafonds).
ALTER TABLE "AdCampaign" ADD COLUMN "priority" "AdPriority" NOT NULL DEFAULT 'moyenne';
ALTER TABLE "AdCampaign" ADD COLUMN "permanent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AdCampaign" ADD COLUMN "capImpressions" INTEGER;
ALTER TABLE "AdCampaign" ADD COLUMN "capClicks" INTEGER;
ALTER TABLE "AdCampaign" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable : les créatifs (bannières).
CREATE TABLE "AdBanner" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "format" "AdFormat" NOT NULL,
    "headline" TEXT,
    "linkUrl" TEXT,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdBanner_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdBanner_campaignId_idx" ON "AdBanner"("campaignId");
ALTER TABLE "AdBanner" ADD CONSTRAINT "AdBanner_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise des données : chaque campagne existante devient une campagne à une
-- seule bannière, sans perte de créatif ni de compteurs.
INSERT INTO "AdBanner" ("id", "campaignId", "format", "headline", "linkUrl", "imageUrl", "active", "impressions", "clicks", "createdAt")
SELECT gen_random_uuid()::text, "id", "format", "headline", "linkUrl", "imageUrl", true, "impressions", "clicks", CURRENT_TIMESTAMP
FROM "AdCampaign";

-- Les colonnes créatif quittent la campagne (désormais portées par la bannière).
ALTER TABLE "AdCampaign" DROP COLUMN "format";
ALTER TABLE "AdCampaign" DROP COLUMN "headline";
ALTER TABLE "AdCampaign" DROP COLUMN "linkUrl";
ALTER TABLE "AdCampaign" DROP COLUMN "imageUrl";
ALTER TABLE "AdCampaign" DROP COLUMN "impressions";
ALTER TABLE "AdCampaign" DROP COLUMN "clicks";
