import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type AdFormat, type AdStatus } from "@a4a/db";
import { auth } from "@/auth";
import {
  createCampaignAction,
  deleteCampaignAction,
  setCampaignStatusAction,
  setPlacementEnabledAction,
} from "@/lib/actions/ad-actions";
import { CampaignForm } from "@/components/admin/campaign-form";
import { PlaceholderMedia } from "@/components/placeholder-media";
import { PLACEMENTS, emplacementsActifs } from "@/lib/ad-placements";
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

  const [campaigns, rubriques, emplActifs] = await Promise.all([
    prisma.adCampaign.findMany({ orderBy: [{ status: "asc" }, { startAt: "desc" }] }),
    prisma.rubrique.findMany({ orderBy: { order: "asc" }, select: { slug: true, name: true } }),
    emplacementsActifs(),
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

      {/* EMPLACEMENTS — activer/désactiver chaque encart des pages publiques. */}
      <section className="mb-6 rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-1 text-sm font-bold">Emplacements publicitaires</h2>
        <p className="mb-4 text-[12.5px] text-ink-3">
          Où les encarts peuvent apparaître sur le site. Un emplacement désactivé n&apos;affiche jamais de publicité ;
          activé, il diffuse la campagne du bon format qui le cible.
        </p>
        <div className="overflow-x-auto rounded-[10px] border border-line">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">
                <th className="px-4 py-2.5">Page</th>
                <th className="px-3 py-2.5">Emplacement</th>
                <th className="px-3 py-2.5">Format</th>
                <th className="px-3 py-2.5">Zone</th>
                <th className="px-3 py-2.5">État</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {PLACEMENTS.map((p) => {
                const on = emplActifs.get(p.slug) ?? p.defaultEnabled;
                return (
                  <tr key={p.slug} className="border-b border-line-2 last:border-b-0">
                    <td className="px-4 py-2.5 text-ink-3">{p.page}</td>
                    <td className="px-3 py-2.5 font-semibold">{p.label.replace(/^.*— /, "")}</td>
                    <td className="px-3 py-2.5 text-ink-2">{FORMAT_LABEL[p.format]}</td>
                    <td className="px-3 py-2.5 text-[12px] text-ink-3">{p.zone}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-bold"
                        style={{ color: on ? "var(--green)" : "var(--ink-3)" }}
                      >
                        <span className="h-[7px] w-[7px] rounded-pill" style={{ background: on ? "var(--green)" : "var(--ink-3)" }} />
                        {on ? "Activé" : "Désactivé"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <form action={setPlacementEnabledAction.bind(null, p.slug)}>
                        <input type="hidden" name="enabled" value={on ? "0" : "1"} />
                        <button
                          type="submit"
                          className="rounded-pill border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2 hover:bg-surface-3"
                        >
                          {on ? "Désactiver" : "Activer"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {erreur ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
          {erreur === "image"
            ? "Visuel refusé — format image (JPG/PNG/WebP/GIF/SVG) et 8 Mo maximum."
            : "Campagne invalide — vérifiez l'annonceur, le format, le CPM, les dates et l'URL (https)."}
        </p>
      ) : null}

      {/* Création */}
      <section className="mb-6 rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 text-sm font-bold">Nouvelle campagne</h2>
        <CampaignForm action={createCampaignAction} rubriques={rubriques} submitLabel="Créer (brouillon)" />
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
                    <div className="flex items-center gap-2.5">
                      {c.imageUrl ? (
                        <PlaceholderMedia url={c.imageUrl} alt="" className="h-10 w-16 flex-none rounded border border-line" />
                      ) : null}
                      <div>
                        <div className="font-bold">{c.advertiser}</div>
                        {c.headline ? <div className="text-[11.5px] text-ink-3">{c.headline}</div> : null}
                      </div>
                    </div>
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
                    <div className="flex flex-wrap items-center gap-1.5">
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
                      <Link href={`/admin/ads/${c.id}`} className="rounded-pill border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2">
                        Modifier
                      </Link>
                      <form action={deleteCampaignAction.bind(null, c.id)}>
                        <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-2.5 py-1 text-[11px] font-semibold text-red">
                          Suppr.
                        </button>
                      </form>
                    </div>
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
