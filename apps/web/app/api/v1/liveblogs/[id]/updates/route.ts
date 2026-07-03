import { z } from "zod";
import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";
import { auth, PUBLISH_ROLES } from "@/auth";
import { toLiveUpdateDTO } from "@/lib/live";

const UpdateInput = z.object({
  type: z.enum(["text", "quote", "stat", "media"]),
  title: z.string().optional(),
  body: z.string().min(2),
  pinned: z.boolean().optional(),
});

// POST /api/v1/liveblogs/:id/updates (editor+) { type, title?, body, pinned? }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);
  if (!PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    return apiError("forbidden", "Rôle editor ou admin requis.", 403);
  }

  const { id } = await params;
  const blog = await prisma.liveBlog.findUnique({ where: { id } });
  if (!blog) return apiError("not_found", "Live-blog introuvable.", 404);

  const parsed = UpdateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", parsed.error.issues[0]?.message ?? "Corps invalide.", 400);

  const [update] = await prisma.$transaction([
    prisma.liveUpdate.create({
      data: {
        liveBlogId: id,
        type: parsed.data.type,
        title: parsed.data.title ?? null,
        body: parsed.data.body,
        pinned: parsed.data.pinned ?? false,
      },
      include: { mediaAsset: true },
    }),
    prisma.liveBlog.update({ where: { id }, data: { updatesCount: { increment: 1 } } }),
  ]);

  return Response.json(toLiveUpdateDTO(update), { status: 201 });
}
