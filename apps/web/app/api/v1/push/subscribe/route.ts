import { z } from "zod";
import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";
import { auth } from "@/auth";

const SubscribeInput = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

// POST /api/v1/push/subscribe { endpoint, keys } → abonnement Web Push (DF-04).
// Anonyme autorisé ; rattaché au compte si session (filtrage par intérêts).
export async function POST(request: Request) {
  const parsed = SubscribeInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "endpoint et keys.p256dh/auth requis.", 400);

  const session = await auth();
  const userId = session?.user
    ? (await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } }))?.id ?? null
    : null;

  const { endpoint, keys } = parsed.data;
  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId },
  });
  return Response.json({ id: sub.id, endpoint: sub.endpoint }, { status: 201 });
}

const UnsubscribeInput = z.object({ endpoint: z.string().url() });

// DELETE /api/v1/push/subscribe { endpoint } → désabonnement.
export async function DELETE(request: Request) {
  const parsed = UnsubscribeInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "endpoint requis.", 400);

  await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint } });
  return new Response(null, { status: 204 });
}
