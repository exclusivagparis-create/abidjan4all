import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type ListingStatus, type ListingType } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { auth, PUBLISH_ROLES } from "@/auth";
import { deleteListingAction, setListingStatusAction } from "@/lib/actions/listing-actions";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Annonces · Studio" };
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<ListingType, string> = { emploi: "Emploi", immobilier: "Immobilier", service: "Service" };
const STATUS_META: Record<ListingStatus, { label: string; color: string }> = {
  pending: { label: "À valider", color: "var(--orange)" },
  published: { label: "Publiée", color: "var(--green)" },
  expired: { label: "Expirée", color: "var(--ink-3)" },
};

export default async function AdminAnnonces({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const [{ statut }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const filter = ["pending", "published", "expired"].includes(statut ?? "") ? (statut as ListingStatus) : undefined;
  const [listings, counts] = await Promise.all([
    prisma.listing.findMany({
      where: filter ? { status: filter } : {},
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
      include: { author: { select: { name: true, email: true } } },
    }),
    prisma.listing.groupBy({ by: ["status"], _count: true }),
  ]);
  const countOf = (s: ListingStatus) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">Petites annonces</h1>
      <p className="mb-5 text-[12.5px] text-ink-3">
        {countOf("pending")} annonce(s) à valider. Une annonce publiée reste visible 30 jours.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <a href="/admin/annonces" className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold ${!filter ? "bg-navy text-white" : "border border-line bg-surface text-ink-2"}`}>Toutes</a>
        {(["pending", "published", "expired"] as ListingStatus[]).map((s) => (
          <a key={s} href={`/admin/annonces?statut=${s}`} className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold ${filter === s ? "bg-navy text-white" : "border border-line bg-surface text-ink-2"}`}>
            {STATUS_META[s].label} {countOf(s)}
          </a>
        ))}
      </div>

      <div className="grid gap-3">
        {listings.map((l) => {
          const meta = STATUS_META[l.status];
          const contact = (l.attributes as { contact?: string } | null)?.contact;
          const expired = l.expiresAt < new Date();
          return (
            <div key={l.id} className={`rounded-[14px] border bg-surface p-5 shadow-[var(--shadow-sm)] ${l.status === "pending" ? "border-[rgba(232,100,26,0.4)]" : "border-line"}`}>
              <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                <span className="rounded bg-surface-2 px-2 py-0.5 text-[10.5px] font-bold uppercase text-ink-2">{TYPE_LABEL[l.type]}</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: meta.color }}>
                  <span className="h-[7px] w-[7px] rounded-pill" style={{ background: meta.color }} />
                  {meta.label}
                </span>
                <span className="text-[11.5px] text-ink-3">{l.location}</span>
                <span className="ml-auto text-[11.5px] text-ink-3">
                  {formatDate(l.createdAt)} · expire le {formatDate(l.expiresAt)}{expired ? " (dépassée)" : ""}
                </span>
              </div>
              <div className="font-serif text-[18px] font-semibold">{l.title}</div>
              <p className="mt-1 whitespace-pre-wrap font-serif text-[14px] leading-relaxed text-ink-2">{l.description}</p>
              <div className="mt-2 text-[12px] text-ink-3">
                {l.price ? <b className="text-ink-2">{formatXOF(l.price)} · </b> : null}
                Par {l.author.name} ({l.author.email}){contact ? ` · Contact : ${contact}` : ""}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={setListingStatusAction.bind(null, l.id)} className="flex gap-2">
                  {l.status !== "published" ? (
                    <button type="submit" name="status" value="published" className="rounded-pill bg-brand-fill px-3.5 py-1.5 text-[11.5px] font-bold text-brand-on">Publier (30 j)</button>
                  ) : null}
                  {l.status !== "expired" ? (
                    <button type="submit" name="status" value="expired" className="rounded-pill border border-line bg-surface-2 px-3.5 py-1.5 text-[11.5px] font-semibold text-ink-2">Retirer</button>
                  ) : null}
                </form>
                <form action={deleteListingAction.bind(null, l.id)}>
                  <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3.5 py-1.5 text-[11.5px] font-semibold text-red">Supprimer</button>
                </form>
              </div>
            </div>
          );
        })}
        {listings.length === 0 ? <p className="rounded-[14px] border border-line bg-surface px-5 py-8 text-center text-[13px] text-ink-3">Aucune annonce.</p> : null}
      </div>
    </div>
  );
}
