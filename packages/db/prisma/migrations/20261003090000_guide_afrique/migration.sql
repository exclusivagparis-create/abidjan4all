-- Guide de l'Afrique : fiches de fond.
--
-- Une fiche ne se range pas dans Article : elle n'a pas de date de péremption,
-- ne vit pas dans un fil chronologique, et suit une structure fixe — encadré
-- d'identité puis sections identiques d'une fiche à l'autre. La mêler aux
-- articles aurait obligé à distinguer les deux partout : fil d'accueil, flux
-- RSS, sitemap d'actualités, compteurs de rubrique.
--
-- Les champs d'identité sont du TEXTE et non des nombres : une population
-- s'écrit « 31,9 millions (2024) », une superficie « 322 462 km² ». Les
-- contraindre en nombres ferait disparaître l'année de référence.

CREATE TYPE "GuideKind" AS ENUM ('pays', 'theme');

CREATE TABLE "GuideFiche" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "GuideKind" NOT NULL DEFAULT 'pays',
    "region" TEXT,
    "summary" TEXT NOT NULL,
    "capitale" TEXT,
    "population" TEXT,
    "superficie" TEXT,
    "langues" TEXT,
    "monnaie" TEXT,
    "independance" TEXT,
    "histoire" TEXT,
    "culture" TEXT,
    "societe" TEXT,
    "economie" TEXT,
    "aSavoir" TEXT,
    "coverUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideFiche_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuideFiche_slug_key" ON "GuideFiche"("slug");

-- Le sommaire interroge toujours les fiches publiées, groupées par région.
CREATE INDEX "GuideFiche_published_region_idx" ON "GuideFiche"("published", "region");
