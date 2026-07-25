import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type AdFormat, type AdPriority, type AdStatus } from "@a4a/db";
import { auth } from "@/auth";
import {
  approveReservationAction,
  createCampaignAction,
  deleteCampaignAction,
  setCampaignStatusAction,
  setPlacementEnabledAction,
  sendMonthlyReportsAction,
} from "@/lib/actions/ad-actions";
import { CampaignForm } from "@/components/admin/campaign-form";
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
  skin: "Habillage",
  video: "Vidéo",
};
const FORMAT_COURT: Record<AdFormat, string> = {
  leaderboard_728x90: "Bandeau",
  mpu_300x250: "Pavé",
  native: "Natif",
  interstitial: "Interstitiel",
  skin: "Habillage",
  video: "Vidéo",
};
const PRIORITE_LABEL: Record<AdPriority, string> = { basse: "Basse", moyenne: "Moyenne", haute: "Haute" };
const STATUS_META: Record<AdStatus, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "var(--ink-3)" },
  pending_review: { label: "À valider", color: "var(--orange)" },
  active: { label: "Active", color: "var(--green)" },
  paused: { label: "En pause", color: "var(--orange)" },
  ended: { label: "Terminée", color: "var(--ink-3)" },
};
const NEXT_STATUS: Record<AdStatus, Array<{ to: AdStatus; label: string }>> = {
  draft: [{ to: "active", label: "Activer" }],
  // L'approbation d'une réservation passe par son bouton dédié (dates recalées).
  pending_review: [{ to: "ended", label: "Refuser" }],
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

export default async function AdminAds({ searchParams }: { searchParams: Promise<{ erreur?: string; rapports?: string }> }) {
  const [{ erreur, rapports }, session] = await Promise.all([searchParams, auth()]);
  if (!["admin", "ad_manager"].includes(session?.user?.role ?? "")) redirect("/admin");

  const [campaigns, rubriques, partners, emplActifs] = await Promise.all([
    prisma.adCampaign.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: { banners: true } }),
    prisma.rubrique.findMany({ orderBy: { order: "asc" }, select: { slug: true, name: true } }),
    prisma.user.findMany({ where: { role: "partner" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    emplacementsActifs(),
  ]);

  const agg = (c: (typeof campaigns)[number]) => ({
    imp: c.banners.reduce((s, b) => s + b.impressions, 0),
    clk: c.banners.reduce((s, b) => s + b.clicks, 0),
  });

  const actives = campaigns.filter((c) => c.status === "active");
  const impressions = campaigns.reduce((s, c) => s + agg(c).imp, 0);
  const clicks = campaigns.reduce((s, c) => s + agg(c).clk, 0);
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";

  const partnersCount = partners.length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Régie publicitaire</h1>
        <Link
          href="/admin/ads/tarifs"
          className="rounded-pill border border-line bg-surface-2 px-4 py-2 text-[12px] font-semibold text-ink-2 hover:text-ink"
        >
          ⛁ Grille des prix des packs
        </Link>
        {partnersCount > 0 ? (
          <form action={sendMonthlyReportsAction}>
            <button type="submit" className="rounded-pill border border-line bg-surface-2 px-4 py-2 text-[12px] font-semibold text-ink-2 hover:text-ink">
              ✉ Envoyer les rapports mensuels ({partnersCount} annonceur{partnersCount > 1 ? "s" : ""})
            </button>
          </form>
        ) : null}
      </div>

      {campaigns.some((c) => c.status === "pending_review") ? (
        <p className="mb-4 rounded-md bg-[rgba(232,100,26,0.12)] px-4 py-2.5 text-[13px] font-semibold text-orange">
          {campaigns.filter((c) => c.status === "pending_review").length} réservation(s) payée(s) en attente de
          validation — approuvez la diffusion ou refusez-la dans le tableau ci-dessous.
        </p>
      ) : null}

      {rapports ? (
        <p className="mb-4 rounded-md bg-[rgba(26,107,60,0.1)] px-4 py-2.5 text-[13px] font-semibold text-[#1A6B3C]">
          Rapports mensuels : {rapports.split("-")[0]} envoyé(s), {rapports.split("-")[1]} déjà traité(s) ce mois-ci.
        </p>
      ) : null}

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
          activé, il diffuse la bannière du bon format qui le cible.
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
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: on ? "var(--green)" : "var(--ink-3)" }}>
                        <span className="h-[7px] w-[7px] rounded-pill" style={{ background: on ? "var(--green)" : "var(--ink-3)" }} />
                        {on ? "Activé" : "Désactivé"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <form action={setPlacementEnabledAction.bind(null, p.slug)}>
                        <input type="hidden" name="enabled" value={on ? "0" : "1"} />
                        <button type="submit" className="rounded-pill border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2 hover:bg-surface-3">
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
          Campagne invalide — vérifiez l&apos;annonceur, le CPM et les dates.
        </p>
      ) : null}

      {/* Création d'une campagne (conteneur) → on ajoute les bannières ensuite. */}
      <section className="mb-6 rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-1 text-sm font-bold">Nouvelle campagne</h2>
        <p className="mb-4 text-[12.5px] text-ink-3">
          Créez le conteneur (annonceur, ciblage, période, plafonds), puis ajoutez-y une ou plusieurs bannières.
        </p>
        <CampaignForm action={createCampaignAction} rubriques={rubriques} partners={partners} submitLabel="Créer et ajouter des bannières" />
      </section>

      {/* Campagnes */}
      <div className="overflow-x-auto rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        <table className="w-full min-w-[960px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">
              <th className="px-5 py-3">Annonceur</th>
              <th className="px-3 py-3">Bannières</th>
              <th className="px-3 py-3">Période</th>
              <th className="px-3 py-3">Ciblage</th>
              <th className="px-3 py-3">Plafonds</th>
              <th className="px-3 py-3">Impr. / Clics / CTR</th>
              <th className="px-3 py-3">Statut</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const meta = STATUS_META[c.status];
              const t = (c.targeting ?? {}) as { rubriques?: string[]; geo?: string[] };
              const { imp, clk } = agg(c);
              const campaignCtr = imp > 0 ? ((clk / imp) * 100).toFixed(2) : "—";
              const formats = [...new Set(c.banners.map((b) => FORMAT_COURT[b.format]))];
              return (
                <tr key={c.id} className="border-b border-line-2 last:border-b-0">
                  <td className="px-5 py-3">
                    <div className="font-bold">{c.advertiser}</div>
                    <div className="text-[11px] text-ink-3">
                      Priorité {PRIORITE_LABEL[c.priority].toLowerCase()} · CPM {nf.format(c.cpm)} F
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-ink-2">
                    {c.banners.length === 0 ? (
                      <span className="text-orange">Aucune — à ajouter</span>
                    ) : (
                      <>
                        <span className="font-semibold">{c.banners.length}</span> · {formats.join(", ")}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-ink-2">
                    {c.permanent ? "Permanente" : `${formatDate(c.startAt)} → ${formatDate(c.endAt)}`}
                  </td>
                  <td className="px-3 py-3 text-[11.5px] text-ink-3">
                    {(t.rubriques?.length ? t.rubriques.join(", ") : "toutes rubriques") + " · " + (t.geo?.length ? t.geo.join(", ") : "monde")}
                  </td>
                  <td className="px-3 py-3 text-[11.5px] text-ink-3">
                    {c.capImpressions || c.capClicks
                      ? [c.capImpressions ? `${nf.format(c.capImpressions)} aff.` : null, c.capClicks ? `${nf.format(c.capClicks)} clics` : null]
                          .filter(Boolean)
                          .join(" · ")
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-ink-2">
                    {nf.format(imp)} / {nf.format(clk)} / {campaignCtr}
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
                      {c.status === "pending_review" ? (
                        <form action={approveReservationAction.bind(null, c.id)}>
                          <button type="submit" className="rounded-pill bg-[#1A6B3C] px-2.5 py-1 text-[11px] font-bold text-white">
                            Approuver la diffusion
                          </button>
                        </form>
                      ) : null}
                      <form action={setCampaignStatusAction.bind(null, c.id)} className="flex gap-1.5">
                        {NEXT_STATUS[c.status].map((n) => (
                          <button key={n.to} type="submit" name="status" value={n.to} className="rounded-pill border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2 hover:bg-surface-3">
                            {n.label}
                          </button>
                        ))}
                      </form>
                      <Link href={`/admin/ads/${c.id}`} className="rounded-pill border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2">
                        Bannières &amp; réglages
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
