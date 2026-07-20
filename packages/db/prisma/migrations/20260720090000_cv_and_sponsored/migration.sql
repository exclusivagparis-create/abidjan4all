-- AlterTable
-- Native advertising : article sponsorisé « Communiqué partenaire ».
ALTER TABLE "Article" ADD COLUMN "sponsored" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Article" ADD COLUMN "sponsorName" TEXT;

-- CreateTable
-- CV en ligne d'un membre (bourse d'emploi, gratuit). Un par compte.
CREATE TABLE "CvProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT,
    "phone" TEXT,
    "contactEmail" TEXT,
    "location" TEXT,
    "skills" TEXT[],
    "experiences" JSONB NOT NULL DEFAULT '[]',
    "education" JSONB NOT NULL DEFAULT '[]',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CvProfile_userId_key" ON "CvProfile"("userId");

-- AddForeignKey
ALTER TABLE "CvProfile" ADD CONSTRAINT "CvProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
