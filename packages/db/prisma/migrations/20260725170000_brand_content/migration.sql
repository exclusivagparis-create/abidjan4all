-- CreateEnum
CREATE TYPE "BrandLeadStatus" AS ENUM ('nouveau', 'en_cours', 'gagne', 'perdu');

-- AlterTable
-- Sponsor exclusif d'un envoi de newsletter (600 000 FCFA l'envoi au BP).
ALTER TABLE "NewsletterEdition"
  ADD COLUMN "sponsorName" TEXT,
  ADD COLUMN "sponsorBaseline" TEXT,
  ADD COLUMN "sponsorLogoUrl" TEXT,
  ADD COLUMN "sponsorLinkUrl" TEXT;

-- CreateTable
CREATE TABLE "BrandOffer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pitch" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prix" INTEGER NOT NULL,
    "unite" TEXT NOT NULL,
    "livrables" JSONB NOT NULL DEFAULT '[]',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandLead" (
    "id" TEXT NOT NULL,
    "offerId" TEXT,
    "societe" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tel" TEXT,
    "message" TEXT NOT NULL,
    "status" "BrandLeadStatus" NOT NULL DEFAULT 'nouveau',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandOffer_slug_key" ON "BrandOffer"("slug");
CREATE INDEX "BrandOffer_actif_ordre_idx" ON "BrandOffer"("actif", "ordre");
CREATE INDEX "BrandLead_status_createdAt_idx" ON "BrandLead"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "BrandLead" ADD CONSTRAINT "BrandLead_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "BrandOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed : catalogue brand content du Business Model 2026-2031 (§4.1 pilier 2).
-- Prix repris du document, ajustables au Studio.
INSERT INTO "BrandOffer" ("id", "slug", "title", "pitch", "description", "prix", "unite", "livrables", "ordre", "updatedAt") VALUES
  ('brandinterview000000001', 'business-interview',
   'A4A Business Interview',
   'L''interview de référence de votre dirigeant, filmée et publiée par la rédaction.',
   'Un entretien de 30 à 60 minutes avec votre dirigeant, mené par un journaliste d''Abidjan4All : parcours, stratégie, vision du marché africain. Tournage soigné, montage professionnel, publication sur le site, la chaîne vidéo et LinkedIn, relais newsletter et réseaux sociaux.',
   2000000, 'l''interview',
   '["Entretien filmé de 30 à 60 minutes","Montage professionnel et habillage A4A","Article long format sur abidjan4all.info","Diffusion vidéo + LinkedIn","Relais newsletter et réseaux sociaux","Fichiers sources livrés pour vos propres usages"]',
   10, NOW()),
  ('brandinside00000000002', 'a4a-inside',
   'A4A Inside',
   'Un reportage de 8 minutes tourné à l''intérieur de votre entreprise.',
   'Nos équipes viennent filmer votre outil de production, vos métiers et vos équipes. Le format institutionnel premium pour montrer ce que vous faites vraiment, avec le regard et la narration d''une rédaction.',
   800000, 'le reportage',
   '["Repérage et écriture du fil narratif","Tournage sur site (1 journée)","Reportage monté de 8 minutes","Publication site + vidéo","Version courte pour vos réseaux"]',
   20, NOW()),
  ('brandnative000000000003', 'communique-sponsorise',
   'Communiqué sponsorisé',
   'Votre message publié comme un article, signalé « communiqué partenaire ».',
   'Un article natif rédigé avec vous et publié dans le fil éditorial, clairement identifié comme contenu de partenaire — conformément à nos règles déontologiques. Référencé par Google, relayé dans la newsletter.',
   200000, 'l''article',
   '["Rédaction accompagnée par la rédaction","Publication dans le fil éditorial","Mention « Communiqué partenaire »","Référencement Google","Relais newsletter"]',
   30, NOW()),
  ('brandnews0000000000004', 'sponsor-newsletter',
   'Sponsor de La Matinale',
   'Sponsor exclusif d''un envoi de notre newsletter quotidienne.',
   'Votre marque est le sponsor unique d''un envoi : logo, accroche et lien en tête du message, devant toute notre base d''inscrits. Un seul annonceur par envoi, aucune concurrence dans le message.',
   600000, 'l''envoi',
   '["Sponsor exclusif de l''envoi","Logo, accroche et lien en tête","Aucun autre annonceur dans le message","Rapport d''ouverture après l''envoi"]',
   40, NOW()),
  ('brandshort000000000005', 'formats-courts',
   'Formats courts sponsorisés',
   'Reels, Shorts et TikTok produits par nos équipes, à vos couleurs.',
   'Des formats verticaux de 60 à 90 secondes conçus pour les réseaux sociaux : décryptage, coulisses, annonce produit. Produits par la rédaction, diffusés sur nos comptes et livrés pour les vôtres.',
   150000, 'le format',
   '["Écriture et tournage","Montage vertical sous-titré","Diffusion sur les comptes A4A","Fichier livré pour vos réseaux"]',
   50, NOW());
