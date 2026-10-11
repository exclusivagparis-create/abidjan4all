import { cache } from "react";
import { prisma } from "@a4a/db";
import { PLACEMENTS, getPlacement } from "@/lib/ad-placements-catalogue";

/**
 * État activé/désactivé des emplacements publicitaires, lu en base.
 *
 * Le catalogue lui-même — la liste des encarts, leurs formats, leurs zones —
 * vit dans `ad-placements-catalogue.ts`, sans Prisma, pour rester éprouvable.
 * Tout y est réexporté ci-dessous : les `import { PLACEMENTS } from
 * "@/lib/ad-placements"` existants continuent de fonctionner.
 */
export {
  PLACEMENTS,
  getPlacement,
  libellePlacement,
  placementsValides,
  type Placement,
} from "@/lib/ad-placements-catalogue";

/**
 * État activé de chaque emplacement (catalogue + surcharges DB). Mis en cache
 * pour la durée d'un rendu : plusieurs AdSlot sur la même page ne déclenchent
 * qu'UNE requête. Un slug sans ligne en base garde son état par défaut.
 */
export const emplacementsActifs = cache(async (): Promise<Map<string, boolean>> => {
  const rows = await prisma.adPlacement.findMany({ select: { slug: true, enabled: true } });
  const override = new Map(rows.map((r) => [r.slug, r.enabled]));
  return new Map(PLACEMENTS.map((p) => [p.slug, override.get(p.slug) ?? p.defaultEnabled]));
});

/** Un emplacement est-il actif ? (défaut catalogue si non renseigné en base) */
export async function placementActif(slug: string): Promise<boolean> {
  const p = getPlacement(slug);
  if (!p) return false;
  return (await emplacementsActifs()).get(slug) ?? p.defaultEnabled;
}
