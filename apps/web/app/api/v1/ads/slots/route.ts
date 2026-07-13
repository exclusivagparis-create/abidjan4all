import { countImpression, pickCampaign } from "@/lib/ads";

// GET /api/v1/ads/slots?rubrique=&device= → [AdCreative] (contrat §Régie).
// Sert au plus une campagne ciblée et compte l'impression.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campaign = await pickCampaign({
    rubrique: searchParams.get("rubrique") ?? undefined,
    device: searchParams.get("device") ?? undefined,
  });
  if (!campaign) return Response.json([]);

  countImpression(campaign.id);
  return Response.json([
    {
      id: campaign.id,
      advertiser: campaign.advertiser,
      format: campaign.format,
      headline: campaign.headline,
      imageUrl: campaign.imageUrl,
      clickUrl: `/api/v1/ads/click/${campaign.id}`,
    },
  ]);
}
