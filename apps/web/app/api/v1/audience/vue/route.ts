import { z } from "zod";
import { enregistrerPageVue, estUnRobot, ipDeLaRequete } from "@/lib/audience";
import { adresseAppelant, limiter } from "@/lib/limite-debit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/audience/vue — une page réellement ouverte dans un navigateur.
 *
 * La mesure se faisait au rendu de la page, côté serveur. Deux conséquences,
 * toutes deux fausses, relevées le 19 octobre 2026 :
 *
 * — Tout programme qui récupérait le HTML était compté comme un lecteur. Les
 *   statistiques donnaient 50 % de visites américaines et 2 % ivoiriennes pour
 *   un média d'Abidjan, avec des pays entiers à 1,00 page par visite — la
 *   signature d'une machine qui prend une page et ne revient jamais.
 * — À l'inverse, les navigations INTERNES n'étaient jamais comptées : le
 *   compteur vit dans l'en-tête, que Next ne réaffiche pas quand on passe d'un
 *   article à l'autre. Les lecteurs n'étaient mesurés qu'à leur première page.
 *
 * Les robots étaient donc comptés en entier et les gens au tiers.
 *
 * Depuis le navigateur, un programme qui n'exécute pas de script ne se voit
 * plus, quel que soit le nom qu'il se donne, et chaque page lue compte.
 *
 * Le chemin vient du client : on le valide, et la déduplication par visiteur
 * et par page sur la fenêtre de session fait le reste. Une plafond de débit
 * empêche un script de marteler l'adresse.
 */
const Corps = z.object({
  /** Chemin de la page, sans domaine ni chaîne de requête. */
  path: z
    .string()
    .min(1)
    .max(300)
    .refine((p) => p.startsWith("/") && !p.includes("://") && !p.includes("?") && !p.includes("#"), {
      message: "chemin interne attendu",
    }),
});

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  // Première ligne de défense, pour les robots qui s'annoncent et pour les
  // appels directs à cette adresse.
  if (estUnRobot(userAgent)) return new Response(null, { status: 204 });

  // Soixante pages par heure et par adresse : très au-dessus d'une lecture
  // normale, bien en dessous de ce qu'un script produirait.
  const { autorise } = limiter(`audience:${adresseAppelant(request)}`, 60, 3600);
  if (!autorise) return new Response(null, { status: 204 });

  const parsed = Corps.safeParse(await request.json().catch(() => null));
  // Réponse identique dans tous les cas : cette adresse n'a rien à apprendre
  // à qui la sonde.
  if (!parsed.success) return new Response(null, { status: 204 });

  await enregistrerPageVue({
    path: parsed.data.path,
    userAgent,
    ip: ipDeLaRequete(request.headers),
  });

  return new Response(null, { status: 204 });
}
