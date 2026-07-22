import { cache } from "react";
import { headers } from "next/headers";
import { pickBanner, type BanniereDiffusee } from "@/lib/ads";
import { placementActif } from "@/lib/ad-placements";
import { ipDeLaRequete, paysDepuisIp, appareilDepuisUa } from "@/lib/audience";

/**
 * Habillage actif du site (format « skin ») pour la requête courante, ou null.
 * Jamais servi dans le Studio (/admin) ni si l'emplacement est désactivé.
 * Toute erreur est absorbée (retourne null) : le habillage ne doit jamais
 * empêcher le rendu d'une page. Mis en cache par requête : le layout et le
 * composant AdSkin partagent le même résultat (une requête, une impression).
 */
export const habillageActif = cache(async (): Promise<BanniereDiffusee | null> => {
  try {
    const h = await headers();
    const path = h.get("x-a4a-path") ?? "";
    if (path.startsWith("/admin")) return null;
    if (!(await placementActif("site_skin"))) return null;

    const country = paysDepuisIp(ipDeLaRequete(h));
    const device = appareilDepuisUa(h.get("user-agent") ?? "");
    return await pickBanner({ format: "skin", country, device });
  } catch {
    return null;
  }
});
