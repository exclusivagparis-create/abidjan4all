import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type AdFormat } from "@a4a/db";
import { auth } from "@/auth";
import {
  updateCampaignAction,
  createBannerAction,
  updateBannerAction,
  deleteBannerAction,
  setBannerActiveAction,
} from "@/lib/actions/ad-actions";
import { CampaignForm, type CampaignInitial } from "@/components/admin/campaign-form";
import { BannerForm } from "@/components/admin/banner-form";
import { PlaceholderMedia } from "@/components/placeholder-media";

export const metadata: Metadata = { title: "Campagne · Studio" };
export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("fr-FR");
const ymd = (d: Date) => new Date(d).toISOString().slice(0, 10);
const FORMAT_LABEL: Record<AdFormat, string> = {
  leaderboard_728x90: "Bandeau 728×90",
  mpu_300x250: "Pavé 300×250",
  native: "Natif",
  interstitial: "Interstitiel",
};

export default async function EditCampaign({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  const [{ id }, { erreur }, session] = await Promise.all([params, searchParams, auth()]);
  if (session?.user?.role !== "admin") redirect("/admin");

  const [campaign, rubriques, partners] = await Promise.all([
    prisma.adCampaign.findUnique({ where: { id }, include: { banners: { orderBy: { createdAt: "asc" } } } }),
    prisma.rubrique.findMany({ orderBy: { order: "asc" }, select: { slug: true, name: true } }),
    prisma.user.findMany({ where: { role: "partner" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!campaign) notFound();

  const initial: CampaignInitial = {
    advertiser: campaign.advertiser,
    cpm: campaign.cpm,
    priority: campaign.priority,
    permanent: campaign.permanent,
    capImpressions: campaign.capImpressions,
    capClicks: campaign.capClicks,
    targeting: (campaign.targeting ?? {}) as { rubriques?: string[]; geo?: string[]; tags?: string[] },
    advertiserUserId: campaign.advertiserUserId,
    startAt: ymd(campaign.startAt),
    endAt: ymd(campaign.endAt),
  };

  const totalImp = campaign.banners.reduce((s, b) => s + b.impressions, 0);
  const totalClk = campaign.banners.reduce((s, b) => s + b.clicks, 0);
  const revenu = Math.round((totalImp / 1000) * campaign.cpm);

  return (
    <div>
      <Link href="/admin/ads" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-ink-3 hover:text-ink">
        ‹ Retour à la régie
      </Link>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">{campaign.advertiser}</h1>
        <a
          href={`/admin/ads/${id}/export`}
          className="rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-[11.5px] font-semibold text-ink-2 hover:text-ink"
        >
          ⭳ Export CSV
        </a>
      </div>
      <p className="mb-5 text-[12.5px] text-ink-3">
        Revenu estimé : <b className="text-ink">{nf.format(revenu)} F</b> ({nf.format(totalImp)} impressions ·
        {" "}{nf.format(totalClk)} clics · CTR {totalImp > 0 ? ((totalClk / totalImp) * 100).toFixed(2) : "0.00"} %).
      </p>

      {campaign.status === "ended" ? (
        <p className="mb-4 rounded-md bg-[rgba(232,100,26,0.1)] px-4 py-2.5 text-[13px] font-semibold text-orange">
          Campagne terminée — enregistrez avec une <b>date de fin future</b> (ou en diffusion permanente) pour la reconduire :
          elle repassera en brouillon.
        </p>
      ) : null}
      {erreur ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
          {erreur === "image"
            ? "Visuel refusé — format image (JPG/PNG/WebP/GIF/SVG) et 8 Mo maximum."
            : erreur === "banniere"
              ? "Bannière invalide — vérifiez le format et l'URL (https)."
              : "Campagne invalide — vérifiez les champs et les dates."}
        </p>
      ) : null}

      {/* Réglages de la campagne */}
      <section className="mb-6 rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 text-sm font-bold">Réglages de la campagne</h2>
        <CampaignForm action={updateCampaignAction.bind(null, id)} rubriques={rubriques} partners={partners} initial={initial} submitLabel="Enregistrer" />
      </section>

      {/* Bannières */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-bold">
          Bannières <span className="font-normal text-ink-3">({campaign.banners.length})</span>
        </h2>

        {campaign.banners.length === 0 ? (
          <p className="mb-4 rounded-md bg-surface-2 px-4 py-3 text-[13px] text-ink-3">
            Aucune bannière — ajoutez-en une ci-dessous pour que la campagne puisse s&apos;afficher.
          </p>
        ) : (
          <div className="mb-4 flex flex-col gap-3">
            {campaign.banners.map((b) => {
              const ctr = b.impressions > 0 ? ((b.clicks / b.impressions) * 100).toFixed(2) : "—";
              return (
                <div key={b.id} className="rounded-[12px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
                  <div className="flex flex-wrap items-center gap-4">
                    {b.imageUrl ? (
                      <PlaceholderMedia url={b.imageUrl} alt="" className="h-14 w-24 flex-none rounded border border-line" />
                    ) : (
                      <span className="flex h-14 w-24 flex-none items-center justify-center rounded border border-line bg-surface-2 text-[11px] text-ink-3">
                        Texte
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold">{FORMAT_LABEL[b.format]}</div>
                      <div className="truncate text-[12px] text-ink-3">{b.headline || b.linkUrl || "—"}</div>
                    </div>
                    <div className="text-[12px] text-ink-2">
                      {nf.format(b.impressions)} impr. · {nf.format(b.clicks)} clics · CTR {ctr}
                      {ctr !== "—" ? " %" : ""}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold"
                        style={{ color: b.active ? "var(--green)" : "var(--ink-3)" }}
                      >
                        <span className="h-[7px] w-[7px] rounded-pill" style={{ background: b.active ? "var(--green)" : "var(--ink-3)" }} />
                        {b.active ? "Active" : "Inactive"}
                      </span>
                      <form action={setBannerActiveAction.bind(null, b.id)}>
                        <input type="hidden" name="active" value={b.active ? "0" : "1"} />
                        <button type="submit" className="rounded-pill border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2 hover:bg-surface-3">
                          {b.active ? "Désactiver" : "Activer"}
                        </button>
                      </form>
                      <form action={deleteBannerAction.bind(null, b.id)}>
                        <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-2.5 py-1 text-[11px] font-semibold text-red">
                          Suppr.
                        </button>
                      </form>
                    </div>
                  </div>
                  <details className="mt-3 border-t border-line-2 pt-3">
                    <summary className="cursor-pointer text-[12px] font-semibold text-ink-3 hover:text-ink">✎ Modifier cette bannière</summary>
                    <div className="mt-3">
                      <BannerForm
                        action={updateBannerAction.bind(null, b.id)}
                        initial={{ format: b.format, headline: b.headline, linkUrl: b.linkUrl, imageUrl: b.imageUrl }}
                        submitLabel="Enregistrer la bannière"
                        compact
                      />
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-[12px] border border-dashed border-line bg-surface-2 px-5 py-4">
          <h3 className="mb-3 text-[13px] font-bold">Ajouter une bannière</h3>
          <BannerForm action={createBannerAction.bind(null, id)} submitLabel="Ajouter la bannière" compact />
        </div>
      </section>
    </div>
  );
}
