import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type AdFormat, type AdStatus } from "@a4a/db";
import { auth } from "@/auth";
import { createCampaignAction, setCampaignStatusAction } from "@/lib/actions/ad-actions";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Régie publicitaire · Studio" };
export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("fr-FR");

const FORMAT_LABEL: Record<AdFormat, string> = {
  leaderboard_728x90: "Bandeau 728×90",
  mpu_300x250: "Pavé 300×250",
  native: "Natif",
  interstitial: "Interstitiel",
};
const STATUS_META: Record<AdStatus, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "var(--ink-3)" },
  active: { label: "Active", color: "var(--green)" },
  paused: { label: "En pause", color: "var(--orange)" },
  ended: { label: "Terminée", color: "var(--ink-3)" },
};
const NEXT_STATUS: Record<AdStatus, Array<{ to: AdStatus; label: string }>> = {
  draft: [{ to: "active", label: "Activer" }],
  active: [
    { to: "paused", label: "Mettre en pause" },
    { to: "ended", label: "Terminer" },
  ],
  paused: [
    { to: "active", label: "Reprendre" },
    { to: "ended", label: "Terminer" },
  ],
  ended: [],
};

export default async function AdminAds({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  if (session?.user?.role !== "admin") redirect("/admin");

  const [campaigns, rubriques] = await Promise.all([
    prisma.adCampaign.findMany({ orderBy: [{ status: "asc" }, { startAt: "desc" }] }),
    prisma.rubrique.findMany({ orderBy: { order: "asc" }, select: { slug: true, name: true } }),
  ]);

  const actives = campaigns.filter((c) => c.status === "active");
  const impressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const clicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";

  return (
    <div>
      <h1 className="mb-6 text-lg font-bold">Régie publicitaire</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(
          [
            [String(actives.length), "Campagnes actives"],
            [nf.format(impressions), "Impressions"],
            [nf.format(clicks), "Clics"],
            [`${ctr} %`, "CTR global"],
          ] as const
        ).map(([value, label]) => (
          <div key={label} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
            <div className="font-serif text-[28px] font-medium">{value}</div>
            <div className="mt-0.5 text-[12px] text-ink-3">{label}</div>
          </div>
        ))}
      </div>

      {erreur ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
          Campagne invalide — vérifiez l&apos;annonceur, le format, le CPM, les dates et l&apos;URL (https).
        </p>
      ) : null}

      {/* Création */}
      <section className="mb-6 rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 text-sm font-bold">Nouvelle campagne</h2>
        <form action={createCampaignAction} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2">
            Annonceur
            <input name="advertiser" required maxLength={80} placeholder="Air Côte d'Ivoire" className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]" />
          </label>
          <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2">
            Format
            <select name="format" className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]">
              {(Object.keys(FORMAT_LABEL) as AdFormat[]).map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABEL[f]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2">
            CPM (XOF)
            <input name="cpm" type="number" min={1} required defaultValue={1500} className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]" />
          </label>
          <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2 sm:col-span-2">
            Accroche (affichée dans l&apos;encart)
            <input name="headline" maxLength={120} placeholder="Abidjan–Paris dès 450 000 FCFA" className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]" />
          </label>
          <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2">
            URL de destination
            <input name="linkUrl" type="url" placeholder="https://…" className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]" />
          </label>
          <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2">
            Début
            <input name="startAt" type="date" required className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]" />
          </label>
          <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2">
            Fin
            <input name="endAt" type="date" required className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]" />
          </label>
          <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2">
            Rubriques ciblées (slugs, vide = toutes)
            <input name="rubriques" placeholder="cacao-marches, economie" list="rubrique-slugs" className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]" />
            <datalist id="rubrique-slugs">
              {rubriques.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </datalist>
          </label>
          <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2">
            Zones (codes, vide = monde)
            <input name="geo" placeholder="CI, FR, CEDEAO" className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]" />
          </label>
          <div className="flex items-end">
            <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">
              Créer (brouillon)
            </button>
          </div>
        </form>
      </section>

      {/* Campagnes */}
      <div className="overflow-x-auto rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">
              <th className="px-5 py-3">Annonceur</th>
              <th className="px-3 py-3">Format</th>
              <th className="px-3 py-3">Période</th>
              <th className="px-3 py-3">Ciblage</th>
              <th className="px-3 py-3">CPM</th>
              <th className="px-3 py-3">Impr. / Clics / CTR</th>
              <th className="px-3 py-3">Statut</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const meta = STATUS_META[c.status];
              const t = (c.targeting ?? {}) as { rubriques?: string[]; geo?: string[] };
              const campaignCtr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : "—";
              return (
                <tr key={c.id} className="border-b border-line-2 last:border-b-0">
                  <td className="px-5 py-3">
                    <div className="font-bold">{c.advertiser}</div>
                    {c.headline ? <div className="text-[11.5px] text-ink-3">{c.headline}</div> : null}
                  </td>
                  <td className="px-3 py-3 text-ink-2">{FORMAT_LABEL[c.format]}</td>
                  <td className="px-3 py-3 text-[12px] text-ink-2">
                    {formatDate(c.startAt)} → {formatDate(c.endAt)}
                  </td>
                  <td className="px-3 py-3 text-[11.5px] text-ink-3">
                    {(t.rubriques?.length ? t.rubriques.join(", ") : "toutes rubriques") +
                      " · " +
                      (t.geo?.length ? t.geo.join(", ") : "monde")}
                  </td>
                  <td className="px-3 py-3 text-ink-2">{nf.format(c.cpm)} F</td>
                  <td className="px-3 py-3 text-ink-2">
                    {nf.format(c.impressions)} / {nf.format(c.clicks)} / {campaignCtr}
                    {campaignCtr !== "—" ? " %" : ""}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: meta.color }}>
                      <span className="h-[7px] w-[7px] rounded-pill" style={{ background: meta.color }} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <form action={setCampaignStatusAction.bind(null, c.id)} className="flex gap-1.5">
                      {NEXT_STATUS[c.status].map((n) => (
                        <button
                          key={n.to}
                          type="submit"
                          name="status"
                          value={n.to}
                          className="rounded-pill border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2 hover:bg-surface-3"
                        >
                          {n.label}
                        </button>
                      ))}
                    </form>
                  </td>
                </tr>
              );
            })}
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-[13px] text-ink-3">
                  Aucune campagne — créez la première ci-dessus.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
