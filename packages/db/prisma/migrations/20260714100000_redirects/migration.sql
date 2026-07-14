CREATE TABLE "Redirect" (
    "id" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Redirect_from_key" ON "Redirect"("from");
