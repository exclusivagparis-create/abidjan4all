import { connexionSociale } from "@/lib/actions/auth-actions";
import { fournisseursActifs } from "@/lib/social-login";

/** Motifs de refus renvoyés par le callback signIn, expliqués au lecteur. */
export const RAISONS_SOCIALES: Record<string, string> = {
  email_absent:
    "Ce compte n’a pas transmis d’adresse e-mail. Autorisez le partage de votre adresse, ou créez un compte avec un mot de passe.",
  verif_impossible:
    "Un compte Abidjan4All existe déjà avec cette adresse, et ce fournisseur ne confirme pas qu’elle vous appartient. Connectez-vous avec votre mot de passe.",
  compte_redaction:
    "Cette adresse est celle d’un compte de la rédaction. Ces comptes se connectent avec leur mot de passe — c’est volontaire.",
};

/** Logos officiels, en SVG inline : aucun appel réseau, net sur tout écran. */
function Logo({ id }: { id: string }) {
  if (id === "google") {
    return (
      <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden>
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
        <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
      </svg>
    );
  }
  if (id === "facebook") {
    return (
      <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden>
        <path fill="#1877F2" d="M18 9a9 9 0 1 0-10.4 8.9v-6.3H5.3V9h2.3V7c0-2.3 1.4-3.6 3.5-3.6 1 0 2 .18 2 .18v2.2h-1.1c-1.1 0-1.5.7-1.5 1.4V9h2.5l-.4 2.6h-2.1v6.3A9 9 0 0 0 18 9Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px] fill-ink" aria-hidden>
      <path d="M12.9 9.55c-.02-1.9 1.55-2.82 1.62-2.86-.88-1.29-2.26-1.47-2.75-1.49-1.17-.12-2.28.69-2.87.69-.59 0-1.5-.67-2.47-.65-1.27.02-2.44.74-3.1 1.87-1.32 2.3-.34 5.7.95 7.56.63.91 1.38 1.93 2.36 1.9.95-.04 1.31-.61 2.45-.61 1.15 0 1.47.61 2.47.59 1.02-.02 1.67-.93 2.29-1.84.72-1.05 1.02-2.07 1.04-2.13-.02-.01-2-.77-2.02-3.03ZM11.1 3.5c.52-.64.87-1.51.77-2.39-.75.03-1.66.5-2.2 1.13-.48.56-.9 1.46-.79 2.32.84.06 1.7-.42 2.22-1.06Z" />
    </svg>
  );
}

/**
 * Boutons de connexion sociale. N'affiche que les fournisseurs réellement
 * configurés — un bouton sans identifiants ne mènerait qu'à une erreur.
 */
export function BoutonsSociaux({ next, action }: { next?: string; action: "connexion" | "inscription" }) {
  const actifs = fournisseursActifs();
  if (actifs.length === 0) return null;

  const verbe = action === "connexion" ? "Se connecter avec" : "S’inscrire avec";

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        {actifs.map((f) => (
          <form key={f.id} action={connexionSociale}>
            <input type="hidden" name="provider" value={f.id} />
            <input type="hidden" name="next" value={next ?? ""} />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2.5 rounded-pill border border-line bg-surface py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-surface-2"
            >
              <Logo id={f.id} />
              {verbe} {f.label}
            </button>
          </form>
        ))}
      </div>

      <div className="flex items-center gap-3 text-[11.5px] uppercase tracking-[0.08em] text-ink-3">
        <span className="h-px flex-1 bg-line" />
        ou
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
