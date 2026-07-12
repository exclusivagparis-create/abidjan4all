import { z } from "zod";
import { prisma, type AdFormat } from "@a4a/db";
import { apiError } from "@/lib/api";
import { auth } from "@/auth";

const CampaignInput = z.object({
  advertiser: z.string().trim().min(2).max(80),
  format: z.enum(["leaderboard_728x90", "mpu_300x250", "native", "interstitial"]),
  cpm: z.number().int().positive(),
  headline: z.string().trim().max(120).optional(),
  linkUrl: z.string().url().optional(),
  targeting: z
    .object({ rubriques: z.array(z.string()).optional(), geo: z.array(z.string()).optional(), device: z.string().optional() })
    .default({}),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
});

// POST /api/v1/ads/campaigns (partner|admin) → AdCampaign (contrat §Régie).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!me || !["admin", "partner"].includes(me.role)) {
    return apiError("forbidden", "Réservé aux partenaires et à l'administration.", 403);
  }

  const parsed = CampaignInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Campagne invalide.", 400);
  if (parsed.data.endAt <= parsed.data.startAt) return apiError("invalid_input", "Période invalide.", 400);

  const campaign = await prisma.adCampaign.create({
    data: {
      advertiser: parsed.data.advertiser,
      format: parsed.data.format as AdFormat,
      cpm: parsed.data.cpm,
      headline: parsed.data.headline ?? null,
      linkUrl: parsed.data.linkUrl ?? null,
      targeting: parsed.data.targeting,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt,
    },
  });
  return Response.json(campaign, { status: 201 });
}
