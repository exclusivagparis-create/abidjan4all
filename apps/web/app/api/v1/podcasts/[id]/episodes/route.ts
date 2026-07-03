import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";

// GET /api/v1/podcasts/:id/episodes → [Episode] (contrat §Podcasts)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const podcast = await prisma.podcast.findFirst({ where: { OR: [{ id }, { slug: id }] } });
  if (!podcast) return apiError("not_found", "Podcast introuvable.", 404);

  const episodes = await prisma.episode.findMany({
    where: { podcastId: podcast.id },
    orderBy: { number: "desc" },
  });
  return Response.json(episodes);
}
