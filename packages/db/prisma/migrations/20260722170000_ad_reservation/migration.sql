-- Nouveau type de commande : réservation d'emplacement publicitaire.
ALTER TYPE "OrderKind" ADD VALUE IF NOT EXISTS 'ad_reservation';

-- Lien commande → campagne à activer une fois payée.
ALTER TABLE "Order" ADD COLUMN "campaignId" TEXT;
CREATE INDEX "Order_campaignId_idx" ON "Order"("campaignId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
