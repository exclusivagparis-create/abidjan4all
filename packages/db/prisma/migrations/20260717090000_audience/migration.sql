-- AlterTable
-- Destinataires choisis d'une édition. Vide = tous les inscrits confirmés,
-- ce qui préserve le comportement des éditions déjà créées.
ALTER TABLE "NewsletterEdition" ADD COLUMN "recipientEmails" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
-- Audience. Aucune IP stockée : voir le commentaire du modèle PageView.
CREATE TABLE "PageView" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'autre',
    "visitorHash" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "device" TEXT NOT NULL DEFAULT 'desktop',
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageView_createdAt_idx" ON "PageView"("createdAt");
CREATE INDEX "PageView_visitorHash_createdAt_idx" ON "PageView"("visitorHash", "createdAt");
CREATE INDEX "PageView_sessionId_idx" ON "PageView"("sessionId");
CREATE INDEX "PageView_kind_createdAt_idx" ON "PageView"("kind", "createdAt");
