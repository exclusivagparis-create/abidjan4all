-- CreateTable
-- État activé/désactivé des emplacements publicitaires (catalogue en code).
CREATE TABLE "AdPlacement" (
    "slug" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdPlacement_pkey" PRIMARY KEY ("slug")
);
