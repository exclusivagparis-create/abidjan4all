-- Trace de la relance avant échéance.
--
-- Le planificateur passe toutes les 60 secondes : sans mémoriser l'échéance
-- déjà relancée, l'abonné recevrait le même courriel en boucle. Stocker
-- l'échéance concernée — et non la date d'envoi — rend la relance idempotente
-- par période et la réarme d'elle-même à la période suivante.
ALTER TABLE "Subscription" ADD COLUMN "relancePourEcheance" TIMESTAMP(3);
