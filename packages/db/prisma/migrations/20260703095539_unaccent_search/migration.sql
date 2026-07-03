-- Recherche insensible aux accents : configuration french_unaccent
-- (« montreal » doit trouver « Montréal »). La colonne générée est recréée
-- avec la nouvelle configuration.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TEXT SEARCH CONFIGURATION french_unaccent (COPY = french);
ALTER TEXT SEARCH CONFIGURATION french_unaccent
  ALTER MAPPING FOR hword, hword_part, word
  WITH unaccent, french_stem;

DROP INDEX "Article_searchVector_idx";
ALTER TABLE "Article" DROP COLUMN "searchVector";

ALTER TABLE "Article"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french_unaccent', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('french_unaccent', coalesce("kicker", '') || ' ' || coalesce("dek", '')), 'B') ||
    setweight(to_tsvector('french_unaccent', coalesce(jsonb_path_query_array("body", '$[*].text')::text, '')), 'C')
  ) STORED;

CREATE INDEX "Article_searchVector_idx" ON "Article" USING GIN ("searchVector");
