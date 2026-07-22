import { headers } from "next/headers";
import { countImpression, pickBanner } from "@/lib/ads";
import { ipDeLaRequete, paysDepuisIp, appareilDepuisUa } from "@/lib/audience";
import { getPlacement, placementActif } from "@/lib/ad-placements";
import { AdInterstitial } from "@/components/ad-interstitial";

/** Contexte de diffusion (pays + appareil) déduit de la requête. */
async function contexteDiffusion() {
  const h = await headers();
  const country = paysDepuisIp(ipDeLaRequete(h));
  const device = appareilDepuisUa(h.get("user-agent") ?? "");
  return { country, device };
}

/**
 * Encart publicitaire (régie interne, DF-03). Chaque encart est rattaché à un
 * EMPLACEMENT du catalogue (lib/ad-placements) qui porte son format et son
 * état activé/désactivé (piloté au Studio). Un emplacement désactivé — ou sans
 * campagne active le ciblant (rubrique + pays + appareil) — ne rend rien :
 * aucun espace réservé vide.
 */
export async function AdSlot({
  placementId,
  rubrique,
  contentTags,
}: {
  placementId: string;
  rubrique?: string;
  contentTags?: string[];
}) {
  const placement = getPlacement(placementId);
  if (!placement) return null;
  if (!(await placementActif(placementId))) return null; // désactivé au Studio

  const { country, device } = await contexteDiffusion();
  const format = placement.format;

  // L'interstitiel est réservé au mobile et délégué à un composant client
  // (fermeture + plafond de fréquence). On ne le sert pas sur desktop.
  if (format === "interstitial") {
    if (device !== "mobile") return null;
    const banner = await pickBanner({ rubrique, device, country, format: "interstitial", contentTags });
    if (!banner) return null;
    return (
      <AdInterstitial
        id={banner.id}
        advertiser={banner.campaign.advertiser}
        headline={banner.headline}
        imageUrl={banner.imageUrl}
        linkUrl={banner.linkUrl}
      />
    );
  }

  const banner = await pickBanner({ rubrique, device, country, format, contentTags });
  if (!banner) return null;
  const campaign = { advertiser: banner.campaign.advertiser, headline: banner.headline, imageUrl: banner.imageUrl, linkUrl: banner.linkUrl, id: banner.id };

  countImpression(banner.id);

  const isLeaderboard = format === "leaderboard_728x90";
  const isMpu = format === "mpu_300x250";

  // Cadre dimensionné par format : bandeau 728×90, pavé 300×250, natif fluide.
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
