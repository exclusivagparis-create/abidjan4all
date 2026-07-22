import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";

// GET /api/v1/ads/campaigns/:id/stats → { impressions, clicks, ctr } (contrat §Régie).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await prisma.adCampaign.findUnique({
    where: { id },
    select: { banners: { select: { impressions: true, clicks: true } } },
  });
  if (!campaign) return apiError("not_found", "Campagne introuvable.", 404);

  // Stats agrégées sur l'ensemble des bannières de la campagne.
  const impressions = campaign.banners.reduce((s, b) => s + b.impressions, 0);
  const clicks = campaign.banners.reduce((s, b) => s + b.clicks, 0);
  const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(4)) : 0;
  return Response.json({ impressions, clicks, ctr });
}
