-- Migration ecrite a la main (migrate dev refuse a cause du drift attendu de
-- la colonne generee Article.searchVector - voir la note de la migration
-- push_subscriptions).

-- AlterTable
ALTER TABLE "AdCampaign" ADD COLUMN "headline" TEXT,
                         ADD COLUMN "linkUrl" TEXT;