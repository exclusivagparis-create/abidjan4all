import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import {
  createLinkAction,
  updateLinkAction,
  setLinkActifAction,
  deleteLinkAction,
} from "@/lib/actions/affiliate-actions";

export const metadata: Metadata = { title: "Affiliation · Studio" };
export const dynamic = "force-dynamic";

const field = "w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-ink-3";
const lbl = "grid gap-1 text-[11px] font-semibold text-ink-3";
const btn = "rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-[11.5px] font-semibold text-ink-2 hover:text-ink";

export default async function AdminAffiliation({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  const autorises = [...PUBLISH_ROLES, "ad_manager"] as string[];
  if (!autorises.includes(session?.user?.role ?? "")) redirect("/admin");

  const liens = await prisma.affiliateLink.findMany({ orderBy: [{ actif: "desc" }, { clicks: "desc" }] });
  const totalClics = liens.reduce((s, l) => s + l.clicks, 0);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://abidjan4all.info";

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">Affiliation</h1>
      <p className="mb-6 max-w-[72ch] text-[12.5px] text-ink-3">
        Les liens partenaires rémunérés à la commission (pilier 8 du business model) : transferts d&apos;argent,
        assurances, services. Chaque lien a une <b>adresse courte</b> à placer dans vos articles ; les clics sont
        comptés, ils servent à vérifier les commissions annoncées par le partenaire.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {(
          [
            [String(liens.filter((l) => l.actif).length), "Liens actifs"],
            [String(totalClics), "Clics cumulés"],
            [String(new Set(liens.map((l) => l.partner)).size), "Partenaires"],
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
          Lien invalide — partenaire, libellé et adresse en http(s) obligatoires.
        </p>
      ) : null}

      <div className="mb-6 grid gap-3">
        {liens.map((l) => (
          <div key={l.id} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="font-serif text-[16px] font-bold">{l.partner}</span>
              <span className="text-[13px] text-ink-2">{l.label}</span>
              <code className="rounded-[4px] border border-line bg-surface-2 px-2 py-0.5 text-[11.5px]">
                {base}/go/{l.code}
              </code>
              <span className="text-[12px] font-semibold text-ink-2">{l.clicks} clic(s)</span>
              {l.commission ? <span className="text-[12px] text-ink-3">{l.commission}</span> : null}
              <span
                className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold"
                style={{ color: l.actif ? "var(--green)" : "var(--ink-3)" }}
              >
                <span className="h-[7px] w-[7px] rounded-pill" style={{ background: l.actif ? "var(--green)" : "var(--ink-3)" }} />
                {l.actif ? "Actif" : "Désactivé"}
              </span>
            </div>
            <form action={updateLinkAction.bind(null, l.id)} className="grid gap-2.5 sm:grid-cols-12">
              <label className={`${lbl} sm:col-span-2`}>
                Partenaire
                <input name="partner" defaultValue={l.partner} required maxLength={80} className={field} />
              </label>
              <label className={`${lbl} sm:col-span-3`}>
                Libellé
                <input name="label" defaultValue={l.label} required maxLength={120} className={field} />
              </label>
              <label className={`${lbl} sm:col-span-5`}>
                Adresse de destination
                <input name="url" type="url" defaultValue={l.url} required className={field} />
              </label>
              <label className={`${lbl} sm:col-span-2`}>
                Commission
                <input name="commission" defaultValue={l.commission ?? ""} maxLength={60} placeholder="0,8 %" className={field} />
              </label>
              <div className="sm:col-span-12">
                <button type="submit" className="rounded-pill bg-ink px-4 py-1.5 text-[11.5px] font-bold text-bg">
                  Enregistrer
                </button>
              </div>
            </form>
            <div className="mt-2 flex flex-wrap gap-2 border-t border-line-2 pt-2.5">
              <form action={setLinkActifAction.bind(null, l.id)}>
                <input type="hidden" name="actif" value={l.actif ? "0" : "1"} />
                <button type="submit" className={btn}>
                  {l.actif ? "Désactiver" : "Réactiver"}
                </button>
              </form>
              <form action={deleteLinkAction.bind(null, l.id)}>
                <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-red">
                  Supprimer
                </button>
              </form>
            </div>
          </div>
        ))}
        {liens.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-line bg-surface-2 px-5 py-8 text-center text-[13px] text-ink-3">
            Aucun lien d&apos;affiliation — créez le premier ci-dessous.
          </p>
        ) : null}
      </div>

      <section className="rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-1 text-sm font-bold">Nouveau lien</h2>
        <p className="mb-4 text-[12.5px] text-ink-3">
          L&apos;adresse courte est générée automatiquement et ne change plus — vous pouvez la coller dans vos articles
          sans crainte de la casser plus tard.
        </p>
        <form action={createLinkAction} className="grid gap-2.5 sm:grid-cols-12">
          <label className={`${lbl} sm:col-span-2`}>
            Partenaire
            <input name="partner" required maxLength={80} placeholder="Wave" className={field} />
          </label>
          <label className={`${lbl} sm:col-span-3`}>
            Libellé
            <input name="label" required maxLength={120} placeholder="Transfert diaspora" className={field} />
          </label>
          <label className={`${lbl} sm:col-span-5`}>
            Adresse de destination
            <input name="url" type="url" required placeholder="https://…" className={field} />
          </label>
          <label className={`${lbl} sm:col-span-2`}>
            Commission
            <input name="commission" maxLength={60} placeholder="0,8 %" className={field} />
          </label>
          <div className="sm:col-span-12">
            <button type="submit" className="rounded-pill bg-red px-5 py-2.5 text-[13px] font-bold text-white">
              Créer le lien
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
