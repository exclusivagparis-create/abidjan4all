import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type RefundStatus } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { auth, PUBLISH_ROLES } from "@/auth";
import { exigerRole } from "@/lib/garde-role";
import { traiterRemboursementAction } from "@/lib/actions/remboursement-actions";
import { ETATS, ETATS_IDS } from "@/lib/remboursement";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Remboursements · Studio" };
export const dynamic = "force-dynamic";

export default async function AdminRemboursements({
  searchParams,
}: {
  searchParams: Promise<{ etat?: string; ok?: string }>;
}) {
  const [{ etat, ok }, session] = await Promise.all([searchParams, auth()]);
  if (!(await exigerRole(PUBLISH_ROLES))) redirect("/admin");

  const filtre = ETATS_IDS.includes(etat as RefundStatus) ? (etat as RefundStatus) : undefined;

  const [demandes, parEtat] = await Promise.all([
    prisma.refundRequest.findMany({
      where: filtre ? { status: filtre } : undefined,
      // Les plus anciennes en attente d'abord : une demande d'argent qui
      // dort est celle qui finit en litige.
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: 200,
      include: {
        user: { select: { id: true, name: true, email: true } },
        handledBy: { select: { name: true } },
        payment: {
          select: { amount: true, provider: true, providerRef: true, createdAt: true, offerId: true },
        },
      },
    }),
    prisma.refundRequest.groupBy({ by: ["status"], _count: true }),
  ]);

  const compte = new Map(parEtat.map((g) => [g.status, g._count]));
  const inp = "rounded-[8px] border border-line bg-bg px-3 py-2 text-[13px]";

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">Demandes de remboursement</h1>
      <p className="mb-6 max-w-[80ch] text-[12.5px] text-ink-3">
        Le site n&apos;effectue aucun remboursement : il enregistre la demande et votre décision. Le virement se fait
        chez le prestataire d&apos;origine — PayDunya, Stripe ou PayPal — avec la référence de paiement indiquée
        ci-dessous. Marquez « Remboursée » seulement une fois le virement passé : c&apos;est ce qui est annoncé au
        demandeur.
      </p>

      {ok ? (
        <p className="mb-4 rounded-md bg-[rgba(14,138,95,0.1)] px-4 py-2.5 text-[13px] font-semibold text-green">
          Décision enregistrée, le demandeur en est informé par e-mail.
        </p>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2">
        <a
          href="/admin/remboursements"
          className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold ${!filtre ? "bg-navy text-white" : "border border-line bg-surface text-ink-2"}`}
        >
          Toutes
        </a>
        {ETATS_IDS.map((id) => (
          <a
            key={id}
            href={`/admin/remboursements?etat=${id}`}
            className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold ${filtre === id ? "text-white" : "border border-line bg-surface text-ink-2"}`}
            style={filtre === id ? { background: ETATS[id].couleur } : undefined}
          >
            {ETATS[id].label} ({compte.get(id) ?? 0})
          </a>
        ))}
      </div>

      <div className="grid gap-3">
        {demandes.map((d) => (
          <article key={d.id} className="rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <span
                className="rounded-pill px-2.5 py-0.5 text-[10.5px] font-bold uppercase text-white"
                style={{ background: ETATS[d.status].couleur }}
              >
                {ETATS[d.status].label}
              </span>
              <span className="font-serif text-[18px] font-bold">{formatXOF(d.payment.amount)}</span>
              <span className="text-[12.5px] text-ink-2">
                <a href={`/admin/users/${d.user.id}`} className="font-semibold hover:underline">{d.user.name}</a> · {d.user.email}
              </span>
              <span className="ml-auto text-[12px] text-ink-3">Demandé le {formatDate(d.createdAt)}</span>
            </div>

            <div className="mb-3 text-[12px] text-ink-3">
              Paiement du {formatDate(d.payment.createdAt)} · {d.payment.provider}
              {d.payment.providerRef ? ` · réf. ${d.payment.providerRef}` : ""}
              {d.payment.offerId ? ` · offre ${d.payment.offerId}` : ""}
            </div>

            <p className="mb-3 whitespace-pre-wrap rounded-[10px] bg-surface-2 px-4 py-3 font-serif text-[14.5px] leading-relaxed text-ink-2">
              {d.reason}
            </p>

            {d.handledAt ? (
              <p className="mb-3 text-[12px] text-ink-3">
                Traitée le {formatDate(d.handledAt)}{d.handledBy ? ` par ${d.handledBy.name}` : ""}
                {d.note ? ` — ${d.note}` : ""}
              </p>
            ) : null}

            <form action={traiterRemboursementAction.bind(null, d.id)} className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
                Décision
                <select name="statut" defaultValue={d.status} className={inp}>
                  {ETATS_IDS.map((id) => <option key={id} value={id}>{ETATS[id].label}</option>)}
                </select>
              </label>
              <label className="grid min-w-[260px] flex-1 gap-1.5 text-xs font-semibold text-ink-2">
                Note (transmise au demandeur si renseignée)
                <input name="note" defaultValue={d.note ?? ""} maxLength={1000} className={inp} />
              </label>
              <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">
                Enregistrer
              </button>
            </form>
          </article>
        ))}

        {demandes.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-line bg-surface-2 px-5 py-12 text-center text-[13px] text-ink-3">
            Aucune demande {filtre ? ETATS[filtre].label.toLowerCase() : ""} pour l&apos;instant.
          </p>
        ) : null}
      </div>
    </div>
  );
}
