-- Journal des suppressions d'articles. `snapshot` conserve l'article entier :
-- le Studio n'ayant pas de corbeille, c'est la seule voie de retour après une
-- sélection erronée. Aucune clé étrangère vers User : un journal d'audit doit
-- survivre à la suppression du compte qu'il incrimine.

-- CreateTable
CREATE TABLE "ArticleDeletion" (
    "id" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ArticleStatus" NOT NULL,
    "deletedById" TEXT NOT NULL,
    "deletedByName" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleDeletion_batchId_idx" ON "ArticleDeletion"("batchId");

-- CreateIndex
CREATE INDEX "ArticleDeletion_createdAt_idx" ON "ArticleDeletion"("createdAt");

-- CreateIndex
CREATE INDEX "ArticleDeletion_slug_idx" ON "ArticleDeletion"("slug");
