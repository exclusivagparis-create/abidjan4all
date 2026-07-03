-- Recherche full-text (DATA_MODEL.md §Index & performance)
-- Colonne générée : titre (poids A), surtitre+chapeau (B), corps des blocs (C).
-- jsonb_path_query_array extrait les champs "text" des blocs WYSIWYG.
ALTER TABLE "Article"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('french', coalesce("kicker", '') || ' ' || coalesce("dek", '')), 'B') ||
    setweight(to_tsvector('french', coalesce(jsonb_path_query_array("body", '$[*].text')::text, '')), 'C')
  ) STORED;

CREATE INDEX "Article_searchVector_idx" ON "Article" USING GIN ("searchVector");
