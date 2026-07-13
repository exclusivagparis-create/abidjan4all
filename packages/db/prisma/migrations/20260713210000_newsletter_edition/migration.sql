CREATE TABLE "NewsletterEdition" (
    "id" TEXT NOT NULL,
    "newsletterId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "introHtml" TEXT NOT NULL DEFAULT '',
    "articleIds" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NewsletterEdition_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "NewsletterEdition" ADD CONSTRAINT "NewsletterEdition_newsletterId_fkey" FOREIGN KEY ("newsletterId") REFERENCES "Newsletter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
