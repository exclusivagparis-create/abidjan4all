CREATE TABLE "PasswordSetToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordSetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordSetToken_token_key" ON "PasswordSetToken"("token");
ALTER TABLE "PasswordSetToken" ADD CONSTRAINT "PasswordSetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;