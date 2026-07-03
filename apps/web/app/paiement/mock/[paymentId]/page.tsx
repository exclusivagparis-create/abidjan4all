import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { METHODS, formatXOF } from "@a4a/payments";
import { settleMockPayment } from "@/lib/actions/billing-actions";

export const metadata: Metadata = { title: "Paiement (sandbox)" };
export const dynamic = "force-dynamic";

/** Page « prestataire » simulée — en production : redirection PayDunya/Stripe. */
export default async function MockCheckoutPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { subscription: { include: { user: { select: { email: true } } } } },
  });
  if (!payment) notFound();

  const methodLabel =
    METHODS.find((m) => m.id === payment.subscription.method)?.label ?? "Paiement";
  const pay = settleMockPayment.bind(null, payment.id, "paid" as const);
  const fail = settleMockPayment.bind(null, payment.id, "failed" as const);
  const done = payment.status !== "pending";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#111826] px-6 font-sans">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-8 text-[#16181D] shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <span className="rounded-md bg-[#111826] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#F5C24B]">
            PSP Sandbox
          </span>
          <span className="text-[11px] font-semibold text-[#727A88]">{payment.providerRef}</span>
        </div>

        <div className="mb-1 text-[13px] text-[#727A88]">Abidjan4All · A4A+</div>
        <div className="mb-1 text-[34px] font-extrabold tracking-tight">{formatXOF(payment.amount)}</div>
        <div className="mb-6 text-[13px] text-[#727A88]">
          {methodLabel} · {payment.subscription.user.email}
        </div>

        {done ? (
          <p className="rounded-lg bg-[#F4F2EC] px-4 py-3 text-center text-[13px] font-semibold">
            Ce paiement est déjà {payment.status === "succeeded" ? "confirmé" : "clos"}.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            <form action={pay}>
              <button
                type="submit"
                className="w-full rounded-full bg-[#0E8A5F] py-3.5 text-sm font-bold text-white"
              >
                Payer {formatXOF(payment.amount)}
              </button>
            </form>
            <form action={fail}>
              <button
                type="submit"
                className="w-full rounded-full border border-[#E3DFD4] bg-white py-3 text-[13px] font-semibold text-[#464C58]"
              >
                Simuler un échec / annuler
              </button>
            </form>
          </div>
        )}

        <p className="mt-6 text-center text-[10.5px] leading-relaxed text-[#727A88]">
          Environnement de développement : aucun argent réel ne circule. En production, cette
          étape est servie par PayDunya (MoMo/Orange/carte) ou Stripe.
        </p>
      </div>
    </div>
  );
}
