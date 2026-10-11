import { headers } from "next/headers";
import { countImpression, pickBanner, selectionnerBanniere } from "@/lib/ads";
import { ipDeLaRequete, paysDepuisIp, appareilDepuisUa } from "@/lib/audience";
import { getPlacement, placementActif } from "@/lib/ad-placements";
import { AdInterstitial } from "@/components/ad-interstitial";
import { apercuPubEnCours } from "@/lib/apercu-publicite-serveur";
import { CadreApercu } from "@/components/ad-apercu";

/** Contexte de diffusion (pays + appareil) déduit de la requête. */
async function contexteDiffusion() {
  const h = await headers();
  const country = paysDepuisIp(ipDeLaRequete(h));
  const device = appareilDepuisUa(h.get("user-agent") ?? "");
  return { country, device };
}


/**
 * Encart publicitaire (régie interne, DF-03). Chaque encart est rattaché à un
 * EMPLACEMENT du catalogue (lib/ad-placements) qui porte son format et son
 * état activé/désactivé (piloté au Studio). Un emplacement désactivé — ou sans
 * campagne active le ciblant (rubrique + pays + appareil) — ne rend rien :
 * aucun espace réservé vide.
 */
export async function AdSlot({
  placementId,
  rubrique,
  contentTags,
}: {
  placementId: string;
  rubrique?: string;
  contentTags?: string[];
}) {
  const placement = getPlacement(placementId);
  if (!placement) return null;

  const apercu = await apercuPubEnCours();
  const actif = await placementActif(placementId);
  // Hors aperçu, un emplacement désactivé au Studio ne rend rien : pas de
  // cadre vide pour le lecteur. En aperçu, au contraire, il faut le voir —
  // savoir qu'un encart existe ici mais dort est précisément l'information
  // qu'on vient chercher.
  if (!actif && !apercu) return null;

  const { country, device } = await contexteDiffusion();
  const format = placement.format;

  // L'interstitiel est réservé au mobile et délégué à un composant client
  // (fermeture + plafond de fréquence). On ne le sert pas sur desktop.
  if (format === "interstitial") {
    /**
     * En aperçu, l'interstitiel ne prend PAS l'écran.
     *
     * Il est plein écran par nature, et le montrer tel quel masquerait tous
     * les autres encarts de la page — c'est-à-dire l'essentiel de ce qu'on
     * est venu vérifier. Un cadre en ligne dit ce qu'il est et où il se
     * déclenche ; pour le voir en vrai, il reste la navigation ordinaire sur
     * un téléphone, avec une campagne active.
     */
    if (apercu) {
      return (
        <CadreApercu placement={placement} actif={actif} rempli={false} note="Plein écran sur mobile, une fois par session. Non déployé ici pour ne pas masquer les autres encarts." />
      );
    }
    if (device !== "mobile") return null;
    const banner = await pickBanner({ rubrique, device, country, format: "interstitial", contentTags });
    if (!banner) return null;
    return (
      <AdInterstitial
        id={banner.id}
        advertiser={banner.campaign.advertiser}
        headline={banner.headline}
        imageUrl={banner.imageUrl}
        linkUrl={banner.linkUrl}
      />
    );
  }

  /**
   * En aperçu, on passe par la sélection instrumentée : elle rend la même
   * bannière, et en plus les motifs de rejet campagne par campagne. Hors
   * aperçu, `pickBanner` reste le chemin du lecteur, requête identique.
   */
  const selection = apercu
    ? await selectionnerBanniere({ rubrique, device, country, format, contentTags, diagnostic: true })
    : null;
  const banner = selection ? selection.banniere : actif ? await pickBanner({ rubrique, device, country, format, contentTags }) : null;
  if (!banner) {
    // Aucune campagne ne remplit cet encart. Pour le lecteur : rien. Pour la
    // maison en aperçu : le cadre, à sa taille réelle, pour juger de la place
    // qu'il prendra une fois vendu.
    return apercu ? <CadreApercu placement={placement} actif={actif} rempli={false} rejets={selection?.rejets ?? []} /> : null;
  }
  const campaign = { advertiser: banner.campaign.advertiser, headline: banner.headline, imageUrl: banner.imageUrl, linkUrl: banner.linkUrl, id: banner.id };

  // Une impression comptée en aperçu serait facturée à l'annonceur, et
  // rapprocherait sa campagne de son plafond de diffusion. Regarder sa propre
  // mise en page ne doit rien lui coûter.
  if (!apercu) countImpression(banner.id);

  const isLeaderboard = format === "leaderboard_728x90";
  const isMpu = format === "mpu_300x250";

  // Cadre dimensionné par format : bandeau 728×90, pavé 300×250, natif fluide.
  const frameClass = isLeaderboard
    ? "mx-auto w-full max-w-[728px]"
    : isMpu
      ? "mx-auto w-full max-w-[300px]"
      : "w-full";
  const mediaClass = isLeaderboard
    ? "block h-[90px] w-full object-cover"
    : isMpu
      ? "block h-[250px] w-full object-cover"
      : "block max-h-[280px] w-full object-cover";

  const inner = campaign.imageUrl ? (
    <div className={`overflow-hidden rounded-[14px] border border-line ${frameClass}`}>
      <div className="bg-surface-2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-ink-3">Publicité</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={campaign.imageUrl} alt={campaign.headline ?? campaign.advertiser} className={mediaClass} />
    </div>
  ) : (
    <div className={`flex items-center justify-between gap-4 rounded-[14px] border border-line bg-surface-2 px-6 py-4 ${frameClass}`}>
      <div className="min-w-0">
        <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-ink-3">Publicité</div>
        <div className="mt-1 truncate font-serif text-[17px] font-semibold text-ink">
          {campaign.headline ?? campaign.advertiser}
        </div>
        <div className="text-[11.5px] text-ink-3">{campaign.advertiser}</div>
      </div>
      {campaign.linkUrl ? (
        <span className="flex-none rounded-pill border border-line bg-surface px-3.5 py-1.5 text-[11.5px] font-semibold text-ink-2">
          Découvrir →
        </span>
      ) : null}
    </div>
  );

  // En aperçu, la bannière réelle s'affiche DANS le cadre annoté, et le lien
  // de clic est retiré : un clic de la maison fausserait le taux de l'annonceur.
  if (apercu) {
    return (
      <CadreApercu placement={placement} actif={actif} rempli annonceur={campaign.advertiser}>
        {inner}
      </CadreApercu>
    );
  }

  return (
    <div className="my-6">
      {campaign.linkUrl ? (
        <a href={`/api/v1/ads/click/${campaign.id}`} target="_blank" rel="noreferrer sponsored">
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
}
