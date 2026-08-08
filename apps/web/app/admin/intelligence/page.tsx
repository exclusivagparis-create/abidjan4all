import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type BriefKind } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { createSerieAction, setSerieActiveAction } from "@/lib/actions/intelligence-actions";
import { KIND_LABEL } from "@/lib/intelligence";
import { formatFCFA } from "@/lib/tarifs";

export const metadata: Metadata = { title: "A4A Intelligence · Studio" };
export const dynamic = "force-dynamic";

const field = "w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-ink-3";
const lbl = "grid gap-1 text-[11px] font-semibold text-ink-3";

export default async function AdminIntelligence({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  if (!PUBLISH_ROLES.includes(session?.user?.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const series = await prisma.briefSerie.findMany({
    orderBy: [{ ordre: "asc" }, { title: "asc" }],
    include: {
      _count: { select: { editions: true, abonnements: true } },
    },
  });

  const abonnesActifs = await prisma.briefAbonnement.count({ where: { expiresAt: { gt: new Date() } } });
  const caAnnuel = series.reduce((s, x) => s + x.prixAnnuel * x._count.abonnements, 0);

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">A4A Intelligence</h1>
      <p className="mb-6 max-w-[72ch] text-[12.5px] text-ink-3">
        Les publications économiques B2B vendues par abonnement (pilier 4 du business model). Chaque
        <b> publication</b> se décline en <b>éditions</b> : le résumé d&apos;une édition est public, son contenu et son
        PDF sont réservés aux abonnés à jour.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(
          [
            [String(series.filter((s) => s.actif).length), "Publications en vente"],
            [String(abonnesActifs), "Abonnements actifs"],
            [String(series.reduce((s, x) => s + x._count.editions, 0)), "Éditions"],
            [formatFCFA(caAnnuel), "CA abonnements cumulé"],
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
          Publication invalide — vérifiez le titre, l&apos;accroche, le prix et la durée.
        </p>
      ) : null}

      <div className="mb-6 grid gap-3">
        {series.map((s) => (
          <div key={s.id} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-[3px] bg-[#0E5A8A] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                {KIND_LABEL[s.kind]}
              </span>
              <Link href={`/admin/intelligence/${s.id}`} className="font-serif text-[16px] font-bold hover:underline">
                {s.title}
              </Link>
              <span className="text-[12px] text-ink-3">
                {formatFCFA(s.prixAnnuel)} / {s.dureeMois} mois · {s.rythme}
              </span>
              <span className="text-[12px] text-ink-3">
                {s._count.editions} édition{s._count.editions > 1 ? "s" : ""} · {s._count.abonnements} abonné
                {s._count.abonnements > 1 ? "s" : ""}
              </span>
              <span
                className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold"
                style={{ color: s.actif ? "var(--green)" : "var(--ink-3)" }}
              >
                <span className="h-[7px] w-[7px] rounded-pill" style={{ background: s.actif ? "var(--green)" : "var(--ink-3)" }} />
                {s.actif ? "En vente" : "Retirée"}
              </span>
              <form action={setSerieActiveAction.bind(null, s.id)}>
                <input type="hidden" name="actif" value={s.actif ? "0" : "1"} />
                <button type="submit" className="rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-[11.5px] font-semibold text-ink-2 hover:text-ink">
                  {s.actif ? "Retirer de la vente" : "Remettre en vente"}
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-1 text-sm font-bold">Nouvelle publication</h2>
        <p className="mb-4 text-[12.5px] text-ink-3">
          Créez le produit (titre, prix, périodicité), puis ajoutez-y ses éditions au fil des parutions.
        </p>
        <form action={createSerieAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <label className={`${lbl} lg:col-span-4`}>
            Titre
            <input name="title" required maxLength={140} placeholder="Rapport mensuel Cacao & Café" className={field} />
          </label>
          <label className={`${lbl} lg:col-span-3`}>
            Nature
            <select name="kind" className={field}>
              {(Object.keys(KIND_LABEL) as BriefKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={`${lbl} lg:col-span-2`}>
            Rythme
            <input name="rythme" placeholder="mensuel" maxLength={40} className={field} />
          </label>
          <label className={`${lbl} lg:col-span-2`}>
            Prix (FCFA)
            <input name="prixAnnuel" type="number" min={1} step={1} required className={field} />
          </label>
          <label className={`${lbl} lg:col-span-1`}>
            Mois
            <input name="dureeMois" type="number" min={1} step={1} defaultValue={12} required className={field} />
          </label>
          <label className={`${lbl} sm:col-span-2 lg:col-span-6`}>
            Accroche (vitrine)
            <input name="pitch" required maxLength={300} className={field} />
          </label>
          <label className={`${lbl} sm:col-span-2 lg:col-span-5`}>
            Destinataires
            <input name="cible" maxLength={160} placeholder="Traders, courtiers, exportateurs" className={field} />
          </label>
          <label className={`${lbl} lg:col-span-1`}>
            Ordre
            <input name="ordre" type="number" step={1} defaultValue={0} className={field} />
          </label>
          <label className={`${lbl} sm:col-span-2 lg:col-span-12`}>
            Description complète
            <textarea name="description" rows={3} maxLength={2000} className={field} />
          </label>
          <div className="sm:col-span-2 lg:col-span-12">
            <button type="submit" className="rounded-pill bg-red px-5 py-2.5 text-[13px] font-bold text-white">
              Créer la publication
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
