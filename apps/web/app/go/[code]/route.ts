import { redirect } from "next/navigation";
import { prisma } from "@a4a/db";

export const dynamic = "force-dynamic";

/**
 * GET /go/:code — lien d'affiliation traçable (pilier 8 du Business Model).
 *
 * Compte le clic puis redirige vers le partenaire. Le compteur est la base de
 * la facturation des commissions : il ne doit jamais bloquer la redirection,
 * d'où l'écriture en « best effort ».
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const lien = await prisma.affiliateLink.findUnique({ where: { code } });
  // Lien inconnu ou désactivé : on ramène à l'accueil plutôt que d'afficher
  // une erreur — le visiteur n'y peut rien.
  if (!lien || !lien.actif) redirect("/");

  await prisma.affiliateLink
    .update({ where: { id: lien.id }, data: { clicks: { increment: 1 } } })
    .catch(() => {});

  redirect(lien.url);
}
