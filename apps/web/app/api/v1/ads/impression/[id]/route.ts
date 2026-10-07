import { prisma } from "@a4a/db";
import { ipDeLaRequete } from "@/lib/audience";
import { limiter } from "@/lib/limite-debit";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/ads/impression/:id — compte une impression réellement affichée
 * (utilisé par l'interstitiel mobile, dont l'affichage est décidé côté client
 * après plafond de fréquence). Répond 204, sans corps.
 *
 * Ce compteur n'avait aucune limite, alors que celui des vues vidéo en a une —
 * et il pèse plus lourd : les impressions alimentent `capImpressions`, qui
 * ARRÊTE la diffusion quand il est atteint, et le rapport mensuel envoyé à
 * l'annonceur. Un script suffisait donc à éteindre la campagne d'un annonceur
 * payant avant terme, et à fausser le chiffre qu'on lui facture.
 *
 * Dix par heure, par bannière et par adresse : largement au-dessus de ce qu'un
 * lecteur réel déclenche, puisque l'interstitiel a déjà son plafond de
 * fréquence côté navigateur. L'adresse sert à cela et n'est jamais enregistrée.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ip = ipDeLaRequete(request.headers) ?? "inconnue";
  const { autorise } = limiter(`pub-impression:${id}:${ip}`, 10, 3600);
  // Réponse identique qu'on ait compté ou non : rien à apprendre d'ici.
  if (!autorise) return new Response(null, { status: 204 });

  // `updateMany` plutôt qu'`update` : un identifiant inconnu ne doit pas
  // produire d'erreur côté serveur, il ne compte simplement pour rien. Et
  // `active: true`, parce qu'une bannière retirée de la diffusion n'a plus
  // d'impression à recevoir — la sélection ne sert qu'elles.
  await prisma.adBanner.updateMany({ where: { id, active: true }, data: { impressions: { increment: 1 } } });

  return new Response(null, { status: 204 });
}
