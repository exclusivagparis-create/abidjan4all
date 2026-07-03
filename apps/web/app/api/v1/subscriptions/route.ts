import { z } from "zod";
import { prisma } from "@a4a/db";
import { apiError } from "@/lib/api";
import { auth } from "@/auth";
import { startCheckout } from "@/lib/billing";

const SubscribeInput = z.object({
  plan: z.enum(["essentiel", "pro"]),
  method: z.enum(["momo", "orange", "card", "paypal"]),
});

// POST /api/v1/subscriptions (auth) { plan, method } → { subscription, checkoutUrl }
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);

  const parsed = SubscribeInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Offre ou moyen de paiement invalide.", 400);

  const { checkoutUrl } = await startCheckout(
    session.user.id,
    session.user.email ?? "",
    parsed.data.plan,
    parsed.data.method
  );
  const subscription = await prisma.subscription.findUnique({ where: { userId: session.user.id } });
  return Response.json({ subscription, checkoutUrl });
}
