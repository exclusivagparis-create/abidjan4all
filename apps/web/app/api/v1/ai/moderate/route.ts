import { z } from "zod";
import { exigerRole } from "@/lib/garde-role";
import { moderateText } from "@a4a/ai";
import { apiError } from "@/lib/api";
import { auth, STUDIO_ROLES } from "@/auth";

const Input = z.object({ text: z.string().min(1).max(5000) });

// POST /api/v1/ai/moderate { text } → { toxicity, action } (contrat §IA)
export async function POST(request: Request) {
  if (!(await exigerRole(STUDIO_ROLES))) {
    return apiError("forbidden", "Réservé à la rédaction.", 403);
  }

  const parsed = Input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "text requis.", 400);

  return Response.json(await moderateText(parsed.data.text));
}
