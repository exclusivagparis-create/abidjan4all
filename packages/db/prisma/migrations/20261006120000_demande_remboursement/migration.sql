-- Demandes de remboursement, traitées à la main.
--
-- Le remboursement lui-même se fait chez le prestataire — PayDunya, Stripe,
-- PayPal. Le site ne déclenche aucun mouvement d'argent : il enregistre la
-- demande, la fait suivre, et garde trace de qui a tranché et quand. Une
-- demande qui n'existe que dans une boîte mail finit toujours par se perdre,
-- et c'est le lecteur qui en paie le prix.
--
-- Rattachée au PAIEMENT et non au seul abonnement : on rembourse une somme
-- précise, et un abonné peut en avoir réglé plusieurs.

CREATE TYPE "RefundStatus" AS ENUM ('en_attente', 'acceptee', 'refusee', 'remboursee');

CREATE TABLE "RefundRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'en_attente',
    "note" TEXT,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

-- Le Studio liste d'abord les demandes en attente, les plus anciennes en tête.
CREATE INDEX "RefundRequest_status_createdAt_idx" ON "RefundRequest"("status", "createdAt");

-- Le compte part avec ses demandes ; le paiement, lui, reste (pièce
-- comptable), et une demande ne doit pas pouvoir le faire disparaître.
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_handledById_fkey"
    FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
