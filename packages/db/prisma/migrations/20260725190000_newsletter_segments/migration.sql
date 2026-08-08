-- AlterTable
-- La Matinale segmentée (Business Model 2026-2031, §3 « newsletter quotidienne
-- segmentée ») : 4 audiences — Côte d'Ivoire, diaspora, Afrique, business.
-- Valeurs par défaut vides : les inscrits et éditions existants continuent de
-- fonctionner à l'identique (vide = tout le monde / tous les segments).
ALTER TABLE "NewsletterSubscription" ADD COLUMN "segments" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "NewsletterEdition" ADD COLUMN "segments" JSONB NOT NULL DEFAULT '[]';
