import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF, planById } from "@a4a/payments";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { cancelSubscriptionAction } from "@/lib/actions/billing-actions";
import { formatDateFull, initials } from "@/lib/format";

export const metadata: Metadata = { title: "Espace membre" };
export const dynamic = "force-dynamic";

const SUB_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: "Actif", color: "var(--green)" },
  past_due: { label: "Paiement en retard", color: "var(--orange)" },
  canceled: { label: "Résilié (accès jusqu'à échéance)", color: "var(--ink-3)" },
};

export default async function EspaceMembrePage({
  searchParams,
}: {
  searchParams: Promise<{ bienvenue?: string }>;
}) {
  const [{ bienvenue }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user) redirect("/login?next=/espace-membre");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      badges: true,
      subscription: {
        include: {
          payments: {
            where: { status: "succeeded" },
            orderBy: { createdAt: "desc" },
            take: 12,
            include: { invoice: true },
          },
        },
      },
    },
  });
  if (!user) redirect("/login");

  const sub = user.subscription;
  const plan = sub ? planById(sub.plan) : undefined;
  const paying = sub && sub.plan !== "free";
  const status = sub ? SUB_STATUS[sub.status] : undefined;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[860px] px-8 pb-20 pt-10">
        {bienvenue ? (
          <p className="mb-6 rounded-md bg-[rgba(14,138,95,0.12)] px-4 py-3 text-[13.5px] font-semibold text-green">
            🎉 Bienvenue dans A4A+ — votre abonnement est actif, les articles premium sont débloqués.
          </p>
        ) : null}

        <div className="mb-8 flex items-center gap-4 border-b-2 border-ink pb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-pill bg-[linear-gradient(135deg,#2E5AAC,#0E8A5F)] text-lg font-bold text-white">
            {initials(user.name)}
          </div>
          <div>
            <h1 className="font-serif text-[32px] font-medium leading-none">{user.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
              {user.email}
              {user.badges.map((b) => (
                <span key={b.id} className="rounded-pill border border-line bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink-3">
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Abonnement */}
        <section className="mb-6 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.06em] text-ink-3">Mon abonnement</h2>
            {paying && status ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: status.color }}>
                <span className="h-[7px] w-[7px] rounded-pill" style={{ background: status.color }} />
                {status.label}
              </span>
            ) : null}
          </div>

          {paying && plan ? (
            <>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-[linear-gradient(135deg,#F5C24B,#E8641A)] px-[13px] py-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#16181D]">
                  ★ A4A+ {plan.name}
                </span>
                {plan.price ? (
                  <span className="text-lg font-extrabold">
                    {formatXOF(plan.price)}
                    <span className="text-xs font-semibold text-ink-3"> / mois</span>
                  </span>
                ) : null}
              </div>
              <div className="mt-3 text-[13px] text-ink-2">
                {sub.methodMask ? <>Moyen de paiement : <b>{sub.methodMask}</b> · </> : null}
                {sub.currentPeriodEnd ? (
                  <>Période en cours jusqu&apos;au <b>{formatDateFull(sub.currentPeriodEnd)}</b> · </>
                ) : null}
                Membre depuis {formatDateFull(sub.since)}
              </div>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {sub.plan === "essentiel" && sub.status === "active" ? (
                  <Link href="/abonnement" className="rounded-pill bg-brand-fill px-4 py-2.5 text-xs font-bold text-brand-on">
                    Passer à Pro
                  </Link>
                ) : null}
                {sub.status === "active" ? (
                  <form action={cancelSubscriptionAction}>
                    <button type="submit" className="rounded-pill border border-line bg-surface-2 px-4 py-2.5 text-xs font-semibold text-ink">
                      Résilier
                    </button>
                  </form>
                ) : (
                  <Link href="/abonnement" className="rounded-pill bg-red px-4 py-2.5 text-xs font-bold text-white">
                    Se réabonner
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-serif text-[15px] text-ink-2">
                Vous n&apos;avez pas encore d&apos;abonnement A4A+ — les enquêtes premium vous attendent.
              </p>
              <Link href="/abonnement" className="rounded-pill bg-red px-5 py-2.5 text-[13px] font-bold text-white">
                Découvrir A4A+
              </Link>
            </div>
          )}
        </section>

        {/* Factures */}
        <section className="rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.06em] text-ink-3">Mes factures</h2>
          {!sub || sub.payments.length === 0 ? (
            <p className="text-[13px] text-ink-3">Aucune facture pour l&apos;instant.</p>
          ) : (
            sub.payments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-line-2 py-3 text-[13px] last:border-b-0">
                <span className="font-mono font-semibold">{p.invoice?.number ?? p.providerRef}</span>
                <span className="text-ink-3">{formatDateFull(p.createdAt)}</span>
                <span className="ml-auto font-bold">{formatXOF(p.amount)}</span>
                <span className="rounded-pill bg-[rgba(14,138,95,0.12)] px-2.5 py-0.5 text-[11px] font-bold text-green">
                  Payée
                </span>
              </div>
            ))
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
