import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";
import { toLiveUpdateDTO } from "@/lib/live";

// GET /api/v1/liveblogs/:id → { liveblog, updates } (API_CONTRACTS.md)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const liveblog = await prisma.liveBlog.findUnique({
    where: { id },
    include: { rubrique: { select: { slug: true, name: true, color: true } } },
  });
  if (!liveblog) return apiError("not_found", "Live-blog introuvable.", 404);

  const updates = await prisma.liveUpdate.findMany({
    where: { liveBlogId: id },
    orderBy: { time: "desc" },
    take: 100,
    include: { mediaAsset: true },
  });

  return Response.json({ liveblog, updates: updates.map(toLiveUpdateDTO) });
}
