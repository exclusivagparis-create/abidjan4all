-- AlterTable : relevé des compteurs cumulés au moment de l'envoi (delta mensuel).
ALTER TABLE "AdReportLog" ADD COLUMN "impressions" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdReportLog" ADD COLUMN "clicks" INTEGER NOT NULL DEFAULT 0;
