import { prisma } from "@a4a/db";
import { limiter } from "@/lib/limite-debit";
import { ipDeLaRequete } from "@/lib/audience";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/videos/:id/vue — enregistre une lecture lancée depuis le site.
 *
 * Appelée au clic sur une vignette ou à la première interaction avec le
 * lecteur intégré. Le compteur mesure donc des intentions de regarder depuis
 * Abidjan4All, pas les lectures faites sur YouTube ou Facebook, que nous ne
 * voyons pas : le chiffre affiché est un plancher, jamais un total.
 *
 * Deux garde-fous contre le gonflage. Côté navigateur, une vidéo déjà comptée
 * ne l'est plus de la session. Côté serveur, cette limite : une même adresse
 * ne peut compter la même vidéo qu'une fois par heure. L'adresse sert à cela
 * et n'est jamais enregistrée — même règle que la mesure d'audience.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ip = ipDeLaRequete(request.headers) ?? "inconnue";
  const { autorise } = limiter(`vue-video:${id}:${ip}`, 1, 3600);
  // Réponse identique qu'on ait compté ou non : rien à apprendre d'ici.
  if (!autorise) return new Response(null, { status: 204 });

  // `updateMany` plutôt qu'`update` : un identifiant inconnu ne doit pas
  // produire d'erreur côté serveur, il ne compte simplement pour rien.
  await prisma.video.updateMany({
    where: { id, published: true },
    data: { views: { increment: 1 } },
  });

  return new Response(null, { status: 204 });
}
