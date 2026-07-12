import { countImpression, pickCampaign } from "@/lib/ads";

/**
 * Encart publicitaire (régie interne, DF-03). Sans campagne active ciblant
 * l'emplacement, il ne rend rien — aucun espace réservé vide.
 */
export async function AdSlot({ rubrique }: { rubrique?: string }) {
  const campaign = await pickCampaign({ rubrique });
  if (!campaign) return null;

  countImpression(campaign.id);
  const inner = (
    <div className="flex items-center justify-between gap-4 rounded-[14px] border border-line bg-surface-2 px-6 py-4">
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
