-- Journal des suppressions de direct, sur le modèle exact de celui des
-- articles : `snapshot` conserve l'objet entier, aucune clé étrangère vers
-- User — un journal d'audit doit survivre à la suppression du compte qu'il
-- incrimine.
--
-- Un seul table pour deux natures d'objet (`kind`) : une mise à jour retirée du
-- fil, ou un direct entier avec toutes ses mises à jour dans l'instantané. Les
-- séparer aurait donné deux tables au schéma identique et deux écrans à lire,
-- pour une distinction que la colonne exprime mieux.

-- CreateEnum
CREATE TYPE "LiveDeletionKind" AS ENUM ('update', 'blog');

-- CreateTable
CREATE TABLE "LiveDeletion" (
    "id" TEXT NOT NULL,
    "kind" "LiveDeletionKind" NOT NULL,
    "snapshot" JSONB NOT NULL,
    -- Recopiés hors du snapshot pour être cherchables sans le déplier.
    "liveBlogId" TEXT NOT NULL,
    "liveBlogTitle" TEXT NOT NULL,
    -- Extrait de la mise à jour retirée ; le titre du direct pour un direct.
    "extrait" TEXT NOT NULL,
    -- Nombre de mises à jour emportées : 1 pour une ligne, le fil entier pour
    -- un direct. Se lit sans ouvrir l'instantané.
    "updatesCount" INTEGER NOT NULL DEFAULT 1,

    "deletedById" TEXT NOT NULL,
    "deletedByName" TEXT NOT NULL,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveDeletion_createdAt_idx" ON "LiveDeletion"("createdAt");

-- CreateIndex
CREATE INDEX "LiveDeletion_liveBlogId_idx" ON "LiveDeletion"("liveBlogId");
