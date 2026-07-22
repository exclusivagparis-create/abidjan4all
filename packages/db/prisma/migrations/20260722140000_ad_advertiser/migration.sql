-- AlterTable : compte annonceur autorisé à consulter la campagne.
ALTER TABLE "AdCampaign" ADD COLUMN "advertiserUserId" TEXT;
CREATE INDEX "AdCampaign_advertiserUserId_idx" ON "AdCampaign"("advertiserUserId");
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_advertiserUserId_fkey" FOREIGN KEY ("advertiserUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable : dédoublonnage des rapports mensuels.
CREATE TABLE "AdReportLog" (
    "id" TEXT NOT NULL,
    "advertiserUserId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdReportLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdReportLog_advertiserUserId_period_key" ON "AdReportLog"("advertiserUserId", "period");
