import { headers } from "next/headers";
import { after } from "next/server";
import { enregistrerPageVue, ipDeLaRequete } from "@/lib/audience";

/**
 * Compteur d'audience, posé dans l'en-tête du site (donc sur toutes les pages
 * publiques, et sur aucune page du Studio).
 *
 * `after()` diffère l'écriture APRÈS l'envoi de la page au lecteur : la mesure
 * ne coûte rien au temps d'affichage. N'affiche rien.
 */
export async function AudienceTracker() {
  const h = await headers();
  const path = h.get("x-a4a-path") ?? "";
  if (!path) return null; // en-tête posé par le middleware ; absent = on ne compte pas

  const userAgent = h.get("user-agent") ?? "";
  const ip = ipDeLaRequete(h);

  after(async () => {
    await enregistrerPageVue({ path, userAgent, ip });
  });

  return null;
}
