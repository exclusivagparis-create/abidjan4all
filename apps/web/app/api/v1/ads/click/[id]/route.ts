import { prisma } from "@a4a/db";

// GET /api/v1/ads/click/:id — compte le clic puis redirige vers l'annonceur.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await prisma.adCampaign.findUnique({ where: { id }, select: { linkUrl: true } });
  if (!campaign) return Response.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"), 302);

  await prisma.adCampaign.update({ where: { id }, data: { clicks: { increment: 1 } } }).catch(() => {});
  const dest = campaign.linkUrl ?? "/";
  return Response.redirect(
    dest.startsWith("http") ? dest : new URL(dest, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").toString(),
    302
  );
}
