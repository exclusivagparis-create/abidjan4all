import { prisma } from "@a4a/db";
import { toLiveUpdateDTO } from "@/lib/live";

export const dynamic = "force-dynamic";

const POLL_MS = 3_000;

/**
 * GET /api/v1/liveblogs/:id/stream — SSE (API_CONTRACTS.md §Live-blog).
 * Événements : `update` (LiveUpdate JSON), `ended` (clôture), `: ping` (heartbeat).
 * MVP : poll base toutes les 3 s ; à l'échelle, brancher Redis pub/sub.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let lastTime = since ? new Date(since) : new Date();
      if (isNaN(lastTime.getTime())) lastTime = new Date();
      let closed = false;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const send = (event: string, data: unknown) =>
        write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* déjà fermé */
        }
      };

      const tick = async () => {
        try {
          const [updates, blog] = await Promise.all([
            prisma.liveUpdate.findMany({
              where: { liveBlogId: id, time: { gt: lastTime } },
              orderBy: { time: "asc" },
              include: { mediaAsset: true },
            }),
            prisma.liveBlog.findUnique({ where: { id }, select: { status: true } }),
          ]);
          if (!blog) return close();
          if (updates.length > 0) {
            lastTime = updates[updates.length - 1]!.time;
            for (const u of updates) send("update", toLiveUpdateDTO(u));
          } else {
            write(`: ping\n\n`);
          }
          if (blog.status === "ended") {
            send("ended", { at: new Date().toISOString() });
            close();
          }
        } catch {
          /* base indisponible : on retentera au tick suivant */
        }
      };

      const interval = setInterval(tick, POLL_MS);
      write(`retry: 5000\n\n`);
      void tick();

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
