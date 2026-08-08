import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type BrandLeadStatus } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import {
  createOfferAction,
  updateOfferAction,
  setOfferActiveAction,
  deleteOfferAction,
  setLeadStatusAction,
  setLeadNoteAction,
  deleteLeadAction,
} from "@/lib/actions/brand-actions";
import { formatFCFA } from "@/lib/tarifs";
import { formatDateFull } from "@/lib/format";

export const metadata: Metadata = { title: "Brand Content · Studio" };
export const dynamic = "force-dynamic";

const field = "w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-ink-3";
const lbl = "grid gap-1 text-[11px] font-semibold text-ink-3";
const btn = "rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-[11.5px] font-semibold text-ink-2 hover:text-ink";

const LEAD_META: Record<BrandLeadStatus, { label: string; color: string }> = {
  nouveau: { label: "Nouveau", color: "var(--orange)" },
  en_cours: { label: "En cours", color: "var(--blue)" },
  gagne: { label: "Gagné", color: "var(--green)" },
  perdu: { label: "Perdu", color: "var(--ink-3)" },
};

export default async function AdminBrandContent({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  const autorises = [...PUBLISH_ROLES, "ad_manager"] as string[];
  if (!autorises.includes(session?.user?.role ?? "")) redirect("/admin");

  const [offres, leads] = await Promise.all([
    prisma.brandOffer.findMany({ orderBy: [{ ordre: "asc" }, { title: "asc" }], include: { _count: { select: { leads: true } } } }),
    prisma.brandLead.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { offer: { select: { title: true } } } }),
  ]);

  const nouveaux = leads.filter((l) => l.status === "nouveau").length;
  const gagnes = leads.filter((l) => l.status === "gagne");
  // Valeur des affaires gagnées, au prix catalogue de l'offre concernée.
  const offreParId = new Map(offres.map((o) => [o.id, o]));
  const ca = gagnes.reduce((s, l) => s + (l.offerId ? offreParId.get(l.offerId)?.prix ?? 0 : 0), 0);

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">Brand Content</h1>
      <p className="mb-6 max-w-[72ch] text-[12.5px] text-ink-3">
        Le catalogue des contenus de marque (pilier 2 du business model) et les demandes reçues via la page publique
        <b> Publicité › Brand Content</b>.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(
          [
            [String(offres.filter((o) => o.actif).length), "Offres au catalogue"],
            [String(nouveaux), "Demandes à traiter"],
            [String(gagnes.length), "Affaires gagnées"],
            [formatFCFA(ca), "CA gagné (prix catalogue)"],
          ] as const
        ).map(([value, label]) => (
          <div key={label} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
            <div className="font-serif text-[24px] font-medium">{value}</div>
            <div className="mt-0.5 text-[12px] text-ink-3">{label}</div>
          </div>
        ))}
      </div>

      {erreur ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
          Offre invalide — vérifiez le titre, l&apos;accroche et le prix (0 = sur devis).
        </p>
      ) : null}

      {/* Demandes reçues */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold">Demandes reçues</h2>
        <div className="grid gap-3">
          {leads.map((l) => {
            const meta = LEAD_META[l.status];
            return (
              <div key={l.id} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <span className="font-serif text-[16px] font-bold">{l.societe}</span>
                  <span className="text-[12.5px] text-ink-2">
                    {l.contact} ·{" "}
                    <a href={`mailto:${l.email}`} className="font-semibold hover:underline">
                      {l.email}
                    </a>
                    {l.tel ? ` · ${l.tel}` : ""}
                  </span>
                  <span className="text-[12px] text-ink-3">{l.offer?.title ?? "offre non précisée"}</span>
                  <span className="text-[11.5px] text-ink-3">{formatDateFull(l.createdAt)}</span>
                  <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: meta.color }}>
                    <span className="h-[7px] w-[7px] rounded-pill" style={{ background: meta.color }} />
                    {meta.label}
                  </span>
                </div>
                <p className="mb-3 whitespace-pre-line rounded-[8px] bg-surface-2 px-4 py-2.5 text-[13px] leading-[1.55] text-ink-2">
                  {l.message}
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <form action={setLeadStatusAction.bind(null, l.id)} className="flex flex-wrap gap-1.5">
                    {(Object.keys(LEAD_META) as BrandLeadStatus[])
                      .filter((s) => s !== l.status)
                      .map((s) => (
                        <button key={s} type="submit" name="status" value={s} className={btn}>
                          {LEAD_META[s].label}
                        </button>
                      ))}
                  </form>
                  <form action={setLeadNoteAction.bind(null, l.id)} className="flex flex-1 items-end gap-2">
                    <label className={`${lbl} flex-1`}>
                      Note interne
                      <input name="note" defaultValue={l.note ?? ""} maxLength={1000} className={field} />
                    </label>
                    <button type="submit" className="rounded-pill bg-ink px-4 py-2 text-[11.5px] font-bold text-bg">
                      Noter
                    </button>
                  </form>
                  <form action={deleteLeadAction.bind(null, l.id)}>
                    <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3 py-2 text-[11.5px] font-semibold text-red">
                      Supprimer
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
          {leads.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-line bg-surface-2 px-5 py-8 text-center text-[13px] text-ink-3">
              Aucune demande pour l&apos;instant.
            </p>
          ) : null}
        </div>
      </section>

      {/* Catalogue */}
      <h2 className="mb-3 text-sm font-bold">Catalogue des offres</h2>
      <div className="mb-6 grid gap-3">
        {offres.map((o) => {
          const livrables = Array.isArray(o.livrables) ? (o.livrables as string[]) : [];
          return (
            <div key={o.id} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="font-serif text-[16px] font-bold">{o.title}</span>
                <span className="text-[12.5px] text-ink-3">
                  {o.prix > 0 ? `${formatFCFA(o.prix)} ${o.unite}` : "sur devis"} · {o._count.leads} demande(s)
                </span>
                <span
                  className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold"
                  style={{ color: o.actif ? "var(--green)" : "var(--ink-3)" }}
                >
                  <span className="h-[7px] w-[7px] rounded-pill" style={{ background: o.actif ? "var(--green)" : "var(--ink-3)" }} />
                  {o.actif ? "Au catalogue" : "Retirée"}
                </span>
              </div>
              <form action={updateOfferAction.bind(null, o.id)} className="grid gap-2.5 sm:grid-cols-12">
                <label className={`${lbl} sm:col-span-4`}>
                  Titre
                  <input name="title" defaultValue={o.title} required maxLength={140} className={field} />
                </label>
                <label className={`${lbl} sm:col-span-2`}>
                  Prix (0 = devis)
                  <input name="prix" type="number" min={0} step={1} defaultValue={o.prix} required className={field} />
                </label>
                <label className={`${lbl} sm:col-span-3`}>
                  Unité facturée
                  <input name="unite" defaultValue={o.unite} maxLength={60} className={field} />
                </label>
                <label className={`${lbl} sm:col-span-1`}>
                  Ordre
                  <input name="ordre" type="number" step={1} defaultValue={o.ordre} className={field} />
                </label>
                <label className={`${lbl} sm:col-span-12`}>
                  Accroche
                  <input name="pitch" defaultValue={o.pitch} required maxLength={300} className={field} />
                </label>
                <label className={`${lbl} sm:col-span-7`}>
                  Description
                  <textarea name="description" defaultValue={o.description} rows={3} maxLength={2000} className={field} />
                </label>
                <label className={`${lbl} sm:col-span-5`}>
                  Livrables (une ligne par élément)
                  <textarea name="livrables" defaultValue={livrables.join("\n")} rows={3} className={field} />
                </label>
                <div className="sm:col-span-12">
                  <button type="submit" className="rounded-pill bg-ink px-4 py-1.5 text-[11.5px] font-bold text-bg">
                    Enregistrer
                  </button>
                </div>
              </form>
              <div className="mt-2 flex flex-wrap gap-2 border-t border-line-2 pt-2.5">
                <form action={setOfferActiveAction.bind(null, o.id)}>
                  <input type="hidden" name="actif" value={o.actif ? "0" : "1"} />
                  <button type="submit" className={btn}>
                    {o.actif ? "Retirer du catalogue" : "Remettre au catalogue"}
                  </button>
                </form>
                <form action={deleteOfferAction.bind(null, o.id)}>
                  <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-red">
                    Supprimer
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 text-sm font-bold">Nouvelle offre</h2>
        <form action={createOfferAction} className="grid gap-2.5 sm:grid-cols-12">
          <label className={`${lbl} sm:col-span-4`}>
            Titre
            <input name="title" required maxLength={140} className={field} />
          </label>
          <label className={`${lbl} sm:col-span-2`}>
            Prix (0 = devis)
            <input name="prix" type="number" min={0} step={1} required defaultValue={0} className={field} />
          </label>
          <label className={`${lbl} sm:col-span-3`}>
            Unité facturée
            <input name="unite" maxLength={60} placeholder="la prestation" className={field} />
          </label>
          <label className={`${lbl} sm:col-span-1`}>
            Ordre
            <input name="ordre" type="number" step={1} defaultValue={0} className={field} />
          </label>
          <label className={`${lbl} sm:col-span-12`}>
            Accroche
            <input name="pitch" required maxLength={300} className={field} />
          </label>
          <label className={`${lbl} sm:col-span-7`}>
            Description
            <textarea name="description" rows={3} maxLength={2000} className={field} />
          </label>
          <label className={`${lbl} sm:col-span-5`}>
            Livrables (une ligne par élément)
            <textarea name="livrables" rows={3} className={field} />
          </label>
          <div className="sm:col-span-12">
            <button type="submit" className="rounded-pill bg-red px-5 py-2.5 text-[13px] font-bold text-white">
              Ajouter l&apos;offre
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
