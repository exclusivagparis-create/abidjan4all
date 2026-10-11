-- Retirer un article de l'index des moteurs, sans le retirer du site.
--
-- Origine : l'avertissement AdSense du 11 octobre 2026, « Contenu à faible
-- valeur informative ». La mesure du corpus a montré 2 147 articles d'une
-- minute de lecture ou moins (46,5 % des 4 620 publiés) et 1 395 de deux
-- minutes (30,2 %) — plus des trois quarts du site sous les 500 mots. Ces
-- pages diluent la substance moyenne vue par Google et ne rapportent presque
-- rien : 3,4 vues par article sur 87 jours de comptage.
--
-- Ce drapeau est DISTINCT de `hidden`. `hidden` masque du public ; ici
-- l'article reste en ligne, dans ses rubriques, dans la recherche interne et
-- au bout de ses liens. Seule la balise `robots` change, en « noindex,
-- follow » : le maillage interne et les 3 384 redirections de l'ancien
-- domaine continuent de porter leur autorité vers les pages indexées.
--
-- Valeur par défaut `false` : aucun article n'est retiré par cette migration.
-- Le choix se fait au Studio, écran « Qualité éditoriale », où le seuil est
-- réglable et l'opération réversible — une désindexation massive est un geste
-- éditorial, pas un effet de bord de déploiement.
ALTER TABLE "Article" ADD COLUMN "noindex" BOOLEAN NOT NULL DEFAULT false;

-- Le sitemap et les listes du Studio filtrent sur ce drapeau conjointement au
-- statut : un index partiel sert les deux.
CREATE INDEX "Article_status_noindex_idx" ON "Article" ("status", "noindex");
