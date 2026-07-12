import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";

// GET /api/v1/ads/campaigns/:id/stats → { impressions, clicks, ctr } (contrat §Régie).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await prisma.adCampaign.findUnique({
    where: { id },
    select: { impressions: true, clicks: true },
  });
  if (!campaign) return apiError("not_found", "Campagne introuvable.", 404);

  const ctr = campaign.impressions > 0 ? Number(((campaign.clicks / campaign.impressions) * 100).toFixed(4)) : 0;
  return Response.json({ impressions: campaign.impressions, clicks: campaign.clicks, ctr });
}
