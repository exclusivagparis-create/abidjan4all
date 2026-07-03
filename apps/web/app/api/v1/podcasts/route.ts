import { prisma } from "@a4a/db";

// GET /api/v1/podcasts → [Podcast] (contrat §Podcasts)
export async function GET() {
  const podcasts = await prisma.podcast.findMany({
    orderBy: { title: "asc" },
    include: { _count: { select: { episodes: true } } },
  });
  return Response.json(podcasts.map(({ _count, ...p }) => ({ ...p, episodesCount: _count.episodes })));
}
