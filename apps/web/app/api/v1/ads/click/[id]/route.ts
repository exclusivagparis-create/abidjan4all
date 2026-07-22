import { prisma } from "@a4a/db";

// GET /api/v1/ads/click/:id — compte le clic (sur la bannière) puis redirige.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const banner = await prisma.adBanner.findUnique({ where: { id }, select: { linkUrl: true } });
  if (!banner) return Response.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"), 302);

  await prisma.adBanner.update({ where: { id }, data: { clicks: { increment: 1 } } }).catch(() => {});
  const dest = banner.linkUrl ?? "/";
  return Response.redirect(
    dest.startsWith("http") ? dest : new URL(dest, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").toString(),
    302
  );
}
