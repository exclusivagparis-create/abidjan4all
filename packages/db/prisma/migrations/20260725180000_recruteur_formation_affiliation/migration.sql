-- AlterEnum
-- Pilier 5 : abonnement recruteur (accès CVthèque).
-- Pilier 6 : inscription payante à un cours A4A Academy.
ALTER TYPE "OrderKind" ADD VALUE 'recruteur';
ALTER TYPE "OrderKind" ADD VALUE 'course_enrollment';

-- CreateTable
CREATE TABLE "RecruiterAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruiterAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "partner" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "commission" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterAccess_userId_key" ON "RecruiterAccess"("userId");
CREATE UNIQUE INDEX "AffiliateLink_code_key" ON "AffiliateLink"("code");
CREATE INDEX "AffiliateLink_actif_idx" ON "AffiliateLink"("actif");

-- AddForeignKey
ALTER TABLE "RecruiterAccess" ADD CONSTRAINT "RecruiterAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
