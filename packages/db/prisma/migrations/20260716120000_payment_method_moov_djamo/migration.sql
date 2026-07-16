-- AlterEnum
-- Moov Money et Djamo : canaux également proposés par le compte PayDunya de
-- l'éditeur côté Côte d'Ivoire (vérifié sur la page de paiement).
-- Sans ces valeurs, l'enregistrement de Subscription.method échouerait.
ALTER TYPE "PaymentMethod" ADD VALUE 'moov';
ALTER TYPE "PaymentMethod" ADD VALUE 'djamo';
