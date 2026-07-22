import type { AdFormat } from "@a4a/db";
import { countImpression, pickBanner } from "@/lib/ads";

const FORMATS: AdFormat[] = ["leaderboard_728x90", "mpu_300x250", "native", "interstitial"];

// GET /api/v1/ads/slots?format=&rubrique=&device= → [AdCreative] (contrat §Régie).
// Sert au plus une bannière ciblée pour le format demandé et compte l'impression.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") as AdFormat | null;
  if (!format || !FORMATS.includes(format)) return Response.json([]);

  const banner = await pickBanner({
    rubrique: searchParams.get("rubrique") ?? undefined,
    device: searchParams.get("device") ?? undefined,
    format,
  });
  if (!banner) return Response.json([]);

  countImpression(banner.id);
  return Response.json([
    {
      id: banner.id,
      advertiser: banner.campaign.advertiser,
      format: banner.format,
      headline: banner.headline,
      imageUrl: banner.imageUrl,
      clickUrl: `/api/v1/ads/click/${banner.id}`,
    },
  ]);
}
