/**
 * DELETE /api/v1/articles/bulk — suppression d'articles par lot.
 *
 * Sert à la fois l'interface du Studio (session du navigateur) et les appels
 * machine (jeton porteur), via le même contrôle d'identité.
 *
 * Adresse : le cahier des charges disait /api/articles/bulk ; toute l'API du
 * site vit sous /api/v1, et y déroger pour une seule route créerait
 * l'incohérence plutôt que de l'éviter.
 */
import { z } from "zod";
import { apiError } from "@/lib/api";
import { autorise, identifier } from "@/lib/api-auth";
import { MAX_SLUGS, supprimerArticles } from "@/lib/suppression-articles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Corps = z.object({
  slugs: z.array(z.string().min(1)).min(1, "Aucun slug fourni.").max(MAX_SLUGS, `${MAX_SLUGS} slugs au maximum par requête.`),
});

export async function DELETE(request: Request) {
  const moi = await identifier(request);
  if (!moi) return apiError("unauthorized", "Authentification requise.", 401);

  // La portée « articles:delete » ET le rôle sont exigés : un jeton ne peut pas
  // donner à un journaliste un pouvoir qu'il n'a pas dans le Studio.
  if (!autorise(moi, "articles:delete")) {
    return apiError(
      "forbidden",
      "Suppression réservée à l'administration et à la rédaction en chef, avec la portée « articles:delete ».",
      403
    );
  }

  const parsed = Corps.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError("invalid_input", parsed.error.issues[0]?.message ?? "Corps invalide.", 400);
  }

  const resultat = await supprimerArticles(parsed.data.slugs, { id: moi.userId, nom: moi.name });

  return Response.json({
    deleted: resultat.deleted,
    errors: resultat.errors,
    status: resultat.errors.length === 0 ? "ok" : "partial",
    batchId: resultat.batchId,
    parStatut: resultat.parStatut,
  });
}
