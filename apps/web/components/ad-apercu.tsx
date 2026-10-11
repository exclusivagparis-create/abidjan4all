import { headers } from "next/headers";
import { APERCU_PUB_PARAM } from "@/lib/apercu-publicite";
import { apercuPubEnCours } from "@/lib/apercu-publicite-serveur";
import type { Placement } from "@/lib/ad-placements";
import type { MotifRejet } from "@/lib/ads";
import { motifLisible, resumeRejets } from "@/lib/regie-motifs";

/**
 * Cadre de prévisualisation d'un emplacement publicitaire.
 *
 * Visible uniquement en `?pub=1`, et seulement pour la maison. Il montre ce
 * que le lecteur ne voit jamais : l'emplacement lui-même, à sa taille réelle,
 * qu'il soit vendu, vide ou éteint.
 *
 * Le cadre est volontairement laid — hachures orange, texte en majuscules.
 * Un cadre discret se confondrait avec le site et ferait douter de ce qu'on
 * regarde ; celui-ci ne peut pas être pris pour une vraie annonce, ni être
 * oublié dans une capture d'écran envoyée à un annonceur.
 */

/** Dimensions réelles de chaque format, pour que le cadre vide occupe la place. */
const TAILLES: Record<string, { h: number; max: number | null; libelle: string }> = {
  leaderboard_728x90: { h: 90, max: 728, libelle: "728 × 90" },
  mpu_300x250: { h: 250, max: 300, libelle: "300 × 250" },
  native: { h: 120, max: null, libelle: "natif, largeur fluide" },
  interstitial: { h: 96, max: null, libelle: "plein écran mobile" },
  skin: { h: 96, max: null, libelle: "fond de page" },
  video: { h: 120, max: null, libelle: "encart sponsor vidéo" },
};

export function CadreApercu({
  placement,
  actif,
  rempli,
  annonceur,
  note,
  rejets = [],
  children,
}: {
  placement: Placement;
  /** Emplacement activé au Studio ? */
  actif: boolean;
  /** Une campagne le remplit-elle en ce moment ? */
  rempli: boolean;
  annonceur?: string;
  note?: string;
  /** Pourquoi rien n’est servi ici — vide quand une bannière est affichée. */
  rejets?: MotifRejet[];
  children?: React.ReactNode;
}) {
  const taille = TAILLES[placement.format] ?? { h: 120, max: null, libelle: placement.format };

  const etat = !actif
    ? { texte: "Éteint au Studio", couleur: "#9AA3B2" }
    : rempli
      ? { texte: `Vendu — ${annonceur ?? "annonceur"}`, couleur: "#2E7D32" }
      : { texte: resumeRejets(rejets), couleur: "#E8641A" };

  return (
    <div className="my-6" data-apercu-pub={placement.slug}>
      <div
        className="mx-auto w-full overflow-hidden rounded-[10px]"
        style={{
          maxWidth: taille.max ? `${taille.max}px` : undefined,
          border: "2px dashed rgba(232,100,26,0.55)",
          background:
            "repeating-linear-gradient(45deg, rgba(232,100,26,0.045) 0 10px, transparent 10px 20px)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[rgba(232,100,26,0.35)] bg-[rgba(232,100,26,0.08)] px-2.5 py-1.5">
          <code className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink">
            {placement.slug}
          </code>
          <span className="text-[10px] font-semibold" style={{ color: etat.couleur }}>
            {etat.texte}
          </span>
        </div>

        {children ? (
          <div className="p-2">{children}</div>
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-1 px-3 text-center"
            style={{ minHeight: `${taille.h}px` }}
          >
            <div className="text-[11.5px] font-semibold text-ink-2">{placement.label}</div>
            <div className="text-[10.5px] text-ink-3">{taille.libelle}</div>
          </div>
        )}

        <div className="border-t border-[rgba(232,100,26,0.25)] px-2.5 py-1 text-[10px] leading-snug text-ink-3">
          {placement.zone}
          {note ? <span className="block italic">{note}</span> : null}
        </div>

        {/* Pourquoi rien ne s’affiche ici. Huit conditions peuvent bloquer une
            bannière, et toutes échouent en silence : sans cette liste, il faut
            les essayer une par une. */}
        {rejets.length > 0 ? (
          <ul className="border-t border-[rgba(232,100,26,0.25)] bg-[rgba(232,100,26,0.05)] px-2.5 py-1.5">
            {rejets.map((r, i) => (
              <li key={i} className="py-0.5 text-[10.5px] leading-snug text-ink-2">
                — {motifLisible(r)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Bandeau d'aperçu, fixé en bas de l'écran.
 *
 * Deux raisons d'exister. D'abord dire ce qu'on regarde : les cadres hachurés
 * n'ont de sens que si l'on sait qu'ils sont un aperçu et non une panne
 * d'affichage. Ensuite offrir la sortie — sans lien, il faut retirer le
 * paramètre à la main dans la barre d'adresse, et on oublie qu'on l'a mis.
 */
export async function BandeauApercuPub() {
  if (!(await apercuPubEnCours())) return null;

  const h = await headers();
  const chemin = h.get("x-a4a-path") ?? "/";
  const params = new URLSearchParams((h.get("x-a4a-search") ?? "").replace(/^\?/, ""));
  params.delete(APERCU_PUB_PARAM);
  const sortie = params.toString() ? `${chemin}?${params.toString()}` : chemin;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center"
      style={{ background: "#111826", color: "#fff" }}
    >
      <span className="text-[12px]">
        <strong className="font-bold">Aperçu des emplacements publicitaires.</strong>{" "}
        Les cadres hachurés ne sont pas visibles du lectorat. Aucune impression n&apos;est comptée.
      </span>
      <a
        href={sortie}
        className="rounded-pill bg-white/15 px-3 py-1 text-[11.5px] font-semibold text-white hover:bg-white/25"
      >
        Revenir à la vue du lecteur
      </a>
    </div>
  );
}
