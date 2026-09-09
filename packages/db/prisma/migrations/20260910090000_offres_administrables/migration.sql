-- Offres A4A+ administrables.
--
-- La grille tarifaire vivait dans une constante TypeScript et dans l'enum
-- `Plan` : changer un prix ou ouvrir une cinquième offre imposait un
-- déploiement. Cette migration la fait passer en base, sans perdre un seul
-- abonnement : les identifiants d'offre reprennent à l'identique les valeurs
-- de l'enum, si bien que la conversion de la colonne est une simple bascule
-- de type, pas une réécriture de données.

-- 1. Nature de la remise portée par une offre.
CREATE TYPE "DiscountKind" AS ENUM ('none', 'percent', 'amount');

-- 2. Table des offres.
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "features" TEXT[],
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "discountKind" "DiscountKind" NOT NULL DEFAULT 'none',
    "discountValue" INTEGER NOT NULL DEFAULT 0,
    "discountFrom" TIMESTAMP(3),
    "discountTo" TIMESTAMP(3),
    "discountLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- 3. Grille actuelle, reprise telle quelle du code (Business Model 2026-2031).
--    « free » n'est pas une offre commerciale : elle existe pour que la clé
--    étrangère de Subscription tienne pour les comptes non payants. Elle est
--    donc inactive, et n'apparaîtra jamais sur la page publique.
INSERT INTO "Offer" ("id","name","tagline","price","features","highlight","active","ordre","updatedAt") VALUES
  ('free','Gratuit','Lecture limitée, sans abonnement.',0,
   ARRAY[]::TEXT[], false, false, 0, CURRENT_TIMESTAMP),
  ('essentiel','Essentiel','Tout le journal, sans publicité.',2000,
   ARRAY['Articles premium en illimité','Archives complètes','Sans publicité','Newsletter quotidienne La Matinale'],
   false, true, 1, CURRENT_TIMESTAMP),
  ('diaspora','Diaspora','Rester relié au pays, où que vous soyez.',3500,
   ARRAY['Tout Essentiel','Accès prioritaire aux offres d''emploi en Côte d''Ivoire','Webinaire diaspora mensuel','Alertes démarches et actualité consulaire'],
   false, true, 2, CURRENT_TIMESTAMP),
  ('pro','Pro','Pour décider : data et rapports.',4000,
   ARRAY['Tout Essentiel','Intelligence économique cacao & café','Rapports marchés mensuels','Données et indicateurs exportables'],
   true, true, 3, CURRENT_TIMESTAMP),
  ('corporate','Corporate','L''offre des directions et des équipes.',50000,
   ARRAY['Tout Pro','Recherche IA sur l''archive A4A','2 interviews dirigeants par an','Rapports sur mesure et licences multi-comptes'],
   false, true, 4, CURRENT_TIMESTAMP);

-- 4. Subscription.plan : enum -> texte. USING conserve la valeur existante.
ALTER TABLE "Subscription" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "plan" TYPE TEXT USING "plan"::TEXT;
ALTER TABLE "Subscription" ALTER COLUMN "plan" SET DEFAULT 'free';

-- 5. Garde-fou : un abonnement ne peut pointer que vers une offre existante.
ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_plan_fkey"
  FOREIGN KEY ("plan") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Paiement : l'offre est désormais inscrite au checkout, plus déduite du
--    montant — une remise rendait cette déduction impossible.
ALTER TABLE "Payment" ADD COLUMN "offerId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "listAmount" INTEGER;

-- Reprise de l'historique : avant les remises, le montant identifiait l'offre.
UPDATE "Payment" p SET "offerId" = o."id", "listAmount" = o."price"
  FROM "Offer" o WHERE o."price" = p."amount" AND o."id" <> 'free';

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Payment_offerId_idx" ON "Payment"("offerId");

-- 7. L'enum n'a plus d'usage.
DROP TYPE "Plan";
