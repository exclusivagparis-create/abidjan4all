import { countImpression } from "@/lib/ads";
import { habillageActif } from "@/lib/ad-skin";

/**
 * Habillage du site (format « skin ») : fond de page cliquable, fixe, rendu
 * DERRIÈRE le contenu. Visible dans les marges latérales sur grand écran (le
 * contenu est ramené dans un cadre centré par le layout). Ne rend rien s'il
 * n'y a pas de campagne « habillage » active ou si l'emplacement est désactivé.
 */
export async function AdSkin() {
  const skin = await habillageActif();
  if (!skin || !skin.imageUrl) return null;

  countImpression(skin.id);

  const bg = (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        backgroundImage: `url(${skin.imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    />
  );

  // Un lien couvrant le fond : seuls les bords (hors du cadre de contenu, qui
  // passe au-dessus) restent cliquables.
  return skin.linkUrl ? (
    <a
      href={`/api/v1/ads/click/${skin.id}`}
      target="_blank"
      rel="noreferrer sponsored"
      aria-label={`Publicité — ${skin.campaign.advertiser}`}
      style={{ position: "fixed", inset: 0, zIndex: 0 }}
    >
      {bg}
    </a>
  ) : (
    bg
  );
}

/** L'habillage est-il actif pour cette requête ? (décide du cadrage du layout) */
export async function habillagePresent(): Promise<boolean> {
  return (await habillageActif()) !== null;
}
