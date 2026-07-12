-- A la Une (positions 1-5) et masquage d'un article publie.
-- Migration ecrite a la main (drift searchVector).
ALTER TABLE "Article" ADD COLUMN "featuredRank" INTEGER,
                      ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;