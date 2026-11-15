-- Journal des annonces de publication.
--
-- Un article mis en ligne doit partir sur les réseaux. Le site ne parle à
-- aucun d'eux directement : il émet un appel signé vers l'automate
-- (Activepieces), qui détient les autorisations de chaque plateforme. Cette
-- table garde la trace de chaque envoi.
--
-- Elle existe pour la rédaction, non pour la machine : sans elle, un envoi
-- raté serait invisible — l'article paraîtrait sur le site et nulle part
-- ailleurs, sans que personne ne s'en aperçoive avant de regarder la page.
--
-- `ON DELETE CASCADE` : un article supprimé emporte ses annonces, qui ne
-- veulent plus rien dire sans lui.

CREATE TABLE "DiffusionArticle" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "codeHttp" INTEGER,
    "erreur" TEXT,
    "essais" INTEGER NOT NULL DEFAULT 0,
    "envoyeeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiffusionArticle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiffusionArticle_articleId_idx" ON "DiffusionArticle"("articleId");

-- Sert l'écran de suivi du Studio : les échecs récents, les plus frais d'abord.
CREATE INDEX "DiffusionArticle_statut_createdAt_idx" ON "DiffusionArticle"("statut", "createdAt");

ALTER TABLE "DiffusionArticle" ADD CONSTRAINT "DiffusionArticle_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
