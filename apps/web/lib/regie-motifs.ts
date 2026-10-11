/**
 * Les motifs de rejet d'une bannière, dits en français.
 *
 * Séparé de `lib/ads.ts`, qui touche la base et n'est donc pas éprouvable par
 * un contrôle unitaire. Ici, du texte et rien d'autre : c'est la partie qu'il
 * faut tenir, parce qu'un message faux envoie la régie chercher au mauvais
 * endroit — plus coûteux que pas de message du tout.
 *
 * Chaque motif se termine par ce qu'il faut FAIRE. Un diagnostic qui se
 * contente de constater laisse son lecteur aussi démuni qu'avant.
 */
import type { MotifRejet } from "@/lib/ads";

const FORMATS: Record<string, string> = {
  leaderboard_728x90: "bandeau 728 × 90",
  mpu_300x250: "pavé 300 × 250",
  native: "natif",
  interstitial: "interstitiel",
  skin: "habillage",
  video: "encart vidéo",
};

/** Nom lisible d'un format, ou le code brut si le catalogue l'ignore. */
export function nomFormat(format: string): string {
  return FORMATS[format] ?? format;
}

const STATUTS: Record<string, string> = {
  draft: "brouillon",
  pending_review: "en attente de validation",
  paused: "en pause",
  ended: "terminée",
  active: "active",
};

function date(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

function liste(xs: string[]): string {
  if (xs.length === 0) return "aucune";
  if (xs.length === 1) return xs[0]!;
  return `${xs.slice(0, -1).join(", ")} et ${xs[xs.length - 1]}`;
}

/**
 * Une phrase par motif : ce qui bloque, puis le geste qui débloque.
 */
export function motifLisible(r: MotifRejet): string {
  switch (r.type) {
    case "aucune_campagne":
      return "Aucune campagne n’existe dans la régie. Créez-en une, puis une bannière au format de cet emplacement.";

    case "statut":
      return `« ${r.campagne} » est ${STATUTS[r.statut] ?? r.statut}, et seule une campagne active est diffusée. Passez-la en actif dans la régie.`;

    case "pas_commencee":
      return `« ${r.campagne} » ne commence que le ${date(r.debut)}. Avancez sa date de début pour la voir aujourd’hui.`;

    case "terminee":
      return `« ${r.campagne} » s’est terminée le ${date(r.fin)}. Repoussez sa date de fin, ou cochez « diffusion permanente ».`;

    case "aucune_banniere_active":
      return `« ${r.campagne} » n’a aucune bannière active. Ajoutez un visuel, ou réactivez celui qui existe.`;

    case "plafond_impressions":
      return `« ${r.campagne} » a atteint son plafond d’affichages (${r.atteint} sur ${r.plafond}). Relevez le plafond ou retirez-le.`;

    case "plafond_clics":
      return `« ${r.campagne} » a atteint son plafond de clics (${r.atteint} sur ${r.plafond}). Relevez le plafond ou retirez-le.`;

    case "ciblage_rubrique":
      // Le piège le plus discret : une campagne ciblée par rubrique ne sort
      // JAMAIS sur l'accueil ni sur la page Vidéos, qui n'ont pas de rubrique.
      return r.page === null
        ? `« ${r.campagne} » est ciblée sur ${liste(r.visees)}, et cette page n’appartient à aucune rubrique — l’accueil et la page Vidéos sont dans ce cas. Retirez le ciblage par rubrique pour y apparaître.`
        : `« ${r.campagne} » est ciblée sur ${liste(r.visees)}, or cette page est dans « ${r.page} ». Ajoutez « ${r.page} » au ciblage.`;

    case "ciblage_appareil":
      return `« ${r.campagne} » ne vise que le ${r.vise}, et vous consultez depuis un ${r.actuel ?? "appareil inconnu"}. Retirez le ciblage par appareil, ou regardez depuis un ${r.vise}.`;

    case "ciblage_geo":
      // Celui-ci se retourne contre la maison : la rédaction à Paris ne verra
      // jamais une campagne ciblée Côte d'Ivoire, et en conclura une panne.
      return `« ${r.campagne} » ne vise que ${liste(r.visees)}, et vous consultez depuis ${r.actuel ?? "un pays que nous n’avons pas pu déterminer"}. La campagne s’affiche bien, mais pas pour vous : c’est le cas si vous testez depuis l’Europe une campagne ciblée Côte d’Ivoire.`;

    case "ciblage_tags":
      return r.page.length === 0
        ? `« ${r.campagne} » ne vise que les contenus portant ${liste(r.visees)}, et cette page n’a pas de mots-clés — seuls les articles en ont. Retirez le ciblage par mots-clés pour apparaître ailleurs.`
        : `« ${r.campagne} » ne vise que les contenus portant ${liste(r.visees)}, or cet article porte ${liste(r.page)}.`;

    case "format_absent":
      return `« ${r.campagne} » n’a aucune bannière en ${nomFormat(r.attendu)}, qui est le format de cet emplacement. Elle en a ${liste(r.disponibles.map(nomFormat))}. Ajoutez-lui un visuel au bon format.`;
  }
}

/**
 * Résumé en une ligne, pour la tête du cadre.
 *
 * Quand plusieurs campagnes échouent pour la même raison, le détail devient
 * illisible : on compte. Quand il n'y en a qu'une, on la nomme.
 */
export function resumeRejets(rejets: MotifRejet[]): string {
  if (rejets.length === 0) return "Aucune campagne éligible";
  if (rejets.length === 1 && rejets[0]!.type === "aucune_campagne") return "Régie vide";
  const n = rejets.length;
  return `${n} campagne${n > 1 ? "s" : ""} écartée${n > 1 ? "s" : ""}`;
}
