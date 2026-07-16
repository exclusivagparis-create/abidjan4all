-- AlterEnum
-- Wave est proposé aux abonnés (canal vérifié sur le compte PayDunya de
-- l'éditeur). Sans cette valeur, l'enregistrement d'un abonnement réglé par
-- Wave échouerait à l'écriture de Subscription.method.
ALTER TYPE "PaymentMethod" ADD VALUE 'wave';
