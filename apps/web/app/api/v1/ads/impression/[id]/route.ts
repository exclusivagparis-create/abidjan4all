import { prisma } from "@a4a/db";

// POST /api/v1/ads/impression/:id — compte une impression réellement affichée
// (utilisé par l'interstitiel mobile, dont l'affichage est décidé côté client
// après plafond de fréquence). Répond 204, sans corps.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.adCampaign.update({ where: { id }, data: { impressions: { increment: 1 } } }).catch(() => {});
  return new Response(null, { status: 204 });
}
