import { headers } from "next/headers";
import type { AdFormat } from "@a4a/db";
import { countImpression, pickCampaign } from "@/lib/ads";
import { ipDeLaRequete, paysDepuisIp, appareilDepuisUa } from "@/lib/audience";
import { AdInterstitial } from "@/components/ad-interstitial";

/** Gabarits d'emplacement → format de campagne. */
type Placement = "leaderboard" | "mpu" | "native" | "interstitial";
const PLACEMENT_FORMAT: Record<Placement, AdFormat> = {
  leaderboard: "leaderboard_728x90",
  mpu: "mpu_300x250",
  native: "native",
  interstitial: "interstitial",
};

/** Contexte de diffusion (pays + appareil) déduit de la requête. */
async function contexteDiffusion() {
  const h = await headers();
  const country = paysDepuisIp(ipDeLaRequete(h));
  const device = appareilDepuisUa(h.get("user-agent") ?? "");
  return { country, device };
}

/**
 * Encart publicitaire (régie interne, DF-03). Quatre gabarits réels :
 *  - `leaderboard` : bandeau 728×90 pleine largeur (en-tête de rubrique) ;
 *  - `mpu` : pavé 300×250 (colonne) ;
 *  - `native` : encart natif in-feed ;
 *  - `interstitial` : plein écran mobile (rendu par un composant client).
 * Sans campagne active ciblant l'emplacement (rubrique + pays + appareil),
 * rien n'est rendu — aucun espace réservé vide.
 */
export async function AdSlot({
  rubrique,
  placement = "native",
}: {
  rubrique?: string;
  placement?: Placement;
}) {
  const { country, device } = await contexteDiffusion();

  // L'interstitiel est réservé au mobile et délégué à un composant client
  // (fermeture + plafond de fréquence). On ne le sert pas sur desktop.
  if (placement === "interstitial") {
    if (device !== "mobile") return null;
    const campaign = await pickCampaign({ rubrique, device, country, format: "interstitial" });
    if (!campaign) return null;
    return (
      <AdInterstitial
        id={campaign.id}
        advertiser={campaign.advertiser}
        headline={campaign.headline}
        imageUrl={campaign.imageUrl}
        linkUrl={campaign.linkUrl}
      />
    );
  }

  const campaign = await pickCampaign({
    rubrique,
    device,
    country,
    format: PLACEMENT_FORMAT[placement],
  });
  if (!campaign) return null;

  countImpression(campaign.id);

  const isLeaderboard = placement === "leaderboard";
  const isMpu = placement === "mpu";

  // Cadre dimensionné par gabarit : le bandeau vise 728×90, le pavé 300×250,
  // le natif s'adapte à la largeur du flux.
  const frameClass = isLeaderboard
    ? "mx-auto w-full max-w-[728px]"
    : isMpu
      ? "mx-auto w-full max-w-[300px]"
      : "w-full";
  const mediaClass = isLeaderboard
    ? "block h-[90px] w-full object-cover"
    : isMpu
      ? "block h-[250px] w-full object-cover"
      : "block max-h-[280px] w-full object-cover";

  const inner = campaign.imageUrl ? (
    <div className={`overflow-hidden rounded-[14px] border border-line ${frameClass}`}>
      <div className="bg-surface-2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-ink-3">Publicité</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={campaign.imageUrl} alt={campaign.headline ?? campaign.advertiser} className={mediaClass} />
    </div>
  ) : (
    <div className={`flex items-center justify-between gap-4 rounded-[14px] border border-line bg-surface-2 px-6 py-4 ${frameClass}`}>
      <div className="min-w-0">
        <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-ink-3">Publicité</div>
        <div className="mt-1 truncate font-serif text-[17px] font-semibold text-ink">
          {campaign.headline ?? campaign.advertiser}
        </div>
        <div className="text-[11.5px] text-ink-3">{campaign.advertiser}</div>
      </div>
      {campaign.linkUrl ? (
        <span className="flex-none rounded-pill border border-line bg-surface px-3.5 py-1.5 text-[11.5px] font-semibold text-ink-2">
          Découvrir →
        </span>
      ) : null}
    </div>
  );

  return (
    <div className="my-6">
      {campaign.linkUrl ? (
        <a href={`/api/v1/ads/click/${campaign.id}`} target="_blank" rel="noreferrer sponsored">
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
}
