-- Rattachement délibéré d'un compte tiers depuis les paramètres : intention à
-- usage unique, créée par un utilisateur authentifié avant le départ vers le
-- fournisseur, consommée au retour. Sert à distinguer un rattachement voulu
-- d'une connexion sociale ordinaire, sans se fier à un cookie falsifiable.

-- CreateTable
CREATE TABLE "AccountLinkIntent" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountLinkIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountLinkIntent_tokenHash_key" ON "AccountLinkIntent"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountLinkIntent_userId_idx" ON "AccountLinkIntent"("userId");

-- AddForeignKey
ALTER TABLE "AccountLinkIntent" ADD CONSTRAINT "AccountLinkIntent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
