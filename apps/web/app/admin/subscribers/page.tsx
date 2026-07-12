import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type SubscriptionStatus } from "@a4a/db";
import { formatXOF, planById } from "@a4a/payments";
import { auth } from "@/auth";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Abonnés A4A+ · Studio" };
export const dynamic = "force-dynamic";

const STATUS_META: Record<SubscriptionStatus, { label: string; color: string }> = {
  active: { label: "Actif", color: "var(--green)" },
  past_due: { label: "Impayé", color: "var(--orange)" },
  canceled: { label: "Résilié", color: "var(--ink-3)" },
};

export default async function AdminSubscribers({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const [{ statut }, session] = await Promise.all([searchParams, auth()]);
  // Données de facturation : réservées à l'administration.
  if (session?.user?.role !== "admin") redirect("/admin");

  const where = { plan: { not: "free" as const } };
  const subs = await prisma.subscription.findMany({
    where:
      statut && ["active", "past_due", "canceled"].includes(statut)
        ? { ...where, status: statut as SubscriptionStatus }
        : where,
    orderBy: { since: "desc" },
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1, include: { invoice: true } },
    },
  });

  const now = new Date();
  const all = await prisma.subscription.findMany({
    where,
    select: { plan: true, status: true, currentPeriodEnd: true },
  });
  const actifs = all.filter((s) => s.status === "active");
  const mrr = actifs.reduce((sum, s) => sum + (planById(s.plan)?.price ?? 0), 0);
  const impayes = all.filter((s) => s.status === "past_due").length;
  const resiliesEnPeriode = all.filter(
    (s) => s.status === "canceled" && s.currentPeriodEnd && s.currentPeriodEnd > now
  ).length;

  const kpis: Array<[string, string, string?]> = [
    [String(actifs.length), "Abonnés payants actifs"],
    [formatXOF(mrr), "Revenu mensuel récurrent", "var(--green)"],
    [String(impayes), "Paiements en retard", impayes > 0 ? "var(--orange)" : undefined],
    [String(resiliesEnPeriode), "Résiliés (accès en cours)"],
  ];

  const filtres: Array<[string, string | undefined]> = [
    ["Tous", undefined],
    ["Actifs", "active"],
    ["Impayés", "past_due"],
    ["Résiliés", "canceled"],
  ];

  return (
    <div>
      <h1 className="mb-6 text-lg font-bold">Abonnés A4A+</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(([value, label, color]) => (
          <div key={label} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
            <div className="font-serif text-[28px] font-medium" style={color ? { color } : undefined}>
              {value}
            </div>
            <div className="mt-0.5 text-[12px] text-ink-3">{label}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        {filtres.map(([label, value]) => (
          <a
            key={label}
            href={value ? `/admin/subscribers?statut=${value}` : "/admin/subscribers"}
            className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold ${
              statut === value || (!statut && !value)
                ? "bg-navy text-white"
                : "border border-line bg-surface text-ink-2"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">
              <th className="px-5 py-3">Membre</th>
              <th className="px-3 py-3">Offre</th>
              <th className="px-3 py-3">Statut</th>
              <th className="px-3 py-3">Paiement</th>
              <th className="px-3 py-3">Depuis</th>
              <th className="px-3 py-3">Échéance</th>
              <th className="px-3 py-3">Dernier règlement</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => {
              const meta = STATUS_META[s.status];
              const plan = planById(s.plan);
              const last = s.payments[0];
              return (
                <tr key={s.id} className="border-b border-line-2 last:border-b-0">
                  <td className="px-5 py-3">
                    <div className="font-bold">{s.user.name}</div>
                    <div className="text-[11.5px] text-ink-3">{s.user.email}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-pill bg-[linear-gradient(135deg,#F5C24B,#E8641A)] px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[#16181D]">
                      {plan?.name ?? s.plan}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: meta.color }}>
                      <span className="h-[7px] w-[7px] rounded-pill" style={{ background: meta.color }} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-ink-2">
                    {s.method ?? "—"}
                    {s.methodMask ? <div className="text-[11px] text-ink-3">{s.methodMask}</div> : null}
                  </td>
                  <td className="px-3 py-3 text-ink-2">{formatDate(s.since)}</td>
                  <td className="px-3 py-3 text-ink-2">
                    {s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    {last ? (
                      <>
                        <span className="font-bold">{formatXOF(last.amount)}</span>{" "}
                        <span className="text-[11px] text-ink-3">
                          ({last.status === "succeeded" ? "réglé" : last.status}, {formatDate(last.createdAt)})
                        </span>
                        {last.invoice ? (
                          <a href={last.invoice.url} target="_blank" rel="noreferrer" className="ml-1.5 text-[11px] font-semibold text-blue underline">
                            {last.invoice.number}
                          </a>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
            {subs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-[13px] text-ink-3">
                  Aucun abonnement dans ce filtre.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
