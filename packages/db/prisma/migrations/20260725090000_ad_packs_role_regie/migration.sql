-- AlterEnum
-- Gestionnaire Régie : rôle Studio limité à la régie publicitaire.
ALTER TYPE "Role" ADD VALUE 'ad_manager';

-- AlterEnum
-- Validation avant diffusion : une réservation self-service payée attend
-- désormais l'approbation de la rédaction avant de passer en diffusion.
ALTER TYPE "AdStatus" ADD VALUE 'pending_review';

-- CreateTable
-- Grille des prix des packs self-service, éditable au Studio (/admin/ads/tarifs).
CREATE TABLE "AdPack" (
    "id" TEXT NOT NULL,
    "format" "AdFormat" NOT NULL,
    "label" TEXT NOT NULL,
    "jours" INTEGER NOT NULL,
    "prix" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdPack_pkey" PRIMARY KEY ("id")
);

-- Seed : reprise à l'identique de la grille jusque-là codée en dur
-- (lib/tarifs.ts, PACKS_PUB) pour que la vente continue sans interruption.
INSERT INTO "AdPack" ("id", "format", "label", "jours", "prix", "description", "ordre", "updatedAt") VALUES
  ('bandeau-7',  'leaderboard_728x90', 'Bandeau 728×90 — 7 jours',   7, 40000,  'Bandeau en tête de page, 7 jours.',                 10, NOW()),
  ('bandeau-15', 'leaderboard_728x90', 'Bandeau 728×90 — 15 jours', 15, 75000,  'Bandeau en tête de page, 15 jours.',                11, NOW()),
  ('bandeau-30', 'leaderboard_728x90', 'Bandeau 728×90 — 30 jours', 30, 130000, 'Bandeau en tête de page, 30 jours.',                12, NOW()),
  ('pave-7',     'mpu_300x250',        'Pavé 300×250 — 7 jours',     7, 30000,  'Pavé en colonne / dans le contenu, 7 jours.',       20, NOW()),
  ('pave-15',    'mpu_300x250',        'Pavé 300×250 — 15 jours',   15, 55000,  'Pavé en colonne / dans le contenu, 15 jours.',      21, NOW()),
  ('pave-30',    'mpu_300x250',        'Pavé 300×250 — 30 jours',   30, 95000,  'Pavé en colonne / dans le contenu, 30 jours.',      22, NOW()),
  ('natif-7',    'native',             'Natif in-feed — 7 jours',    7, 50000,  'Encart natif au fil des articles, 7 jours.',        30, NOW()),
  ('natif-15',   'native',             'Natif in-feed — 15 jours',  15, 90000,  'Encart natif au fil des articles, 15 jours.',       31, NOW()),
  ('natif-30',   'native',             'Natif in-feed — 30 jours',  30, 160000, 'Encart natif au fil des articles, 30 jours.',       32, NOW()),
  ('video-7',    'video',              'Encart vidéo — 7 jours',     7, 45000,  'Encart sponsor sur la page Vidéos, 7 jours.',       40, NOW()),
  ('video-15',   'video',              'Encart vidéo — 15 jours',   15, 80000,  'Encart sponsor sur la page Vidéos, 15 jours.',      41, NOW()),
  ('video-30',   'video',              'Encart vidéo — 30 jours',   30, 140000, 'Encart sponsor sur la page Vidéos, 30 jours.',      42, NOW());
