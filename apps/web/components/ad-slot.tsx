import { countImpression, pickCampaign } from "@/lib/ads";

/**
 * Encart publicitaire (régie interne, DF-03). Sans campagne active ciblant
 * l'emplacement, il ne rend rien — aucun espace réservé vide.
 */
export async function AdSlot({ rubrique }: { rubrique?: string }) {
  const campaign = await pickCampaign({ rubrique });
  if (!campaign) return null;

  countImpression(campaign.id);
  // Visuel fourni : on l'affiche pleine largeur (bandeau/pavé/natif). Sinon,
  // l'encart texte de repli (accroche + annonceur).
  const inner = campaign.imageUrl ? (
    <div className="overflow-hidden rounded-[14px] border border-line">
      <div className="bg-surface-2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-ink-3">Publicité</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={campaign.imageUrl} alt={campaign.headline ?? campaign.advertiser} className="block max-h-[280px] w-full object-cover" />
    </div>
  ) : (
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
