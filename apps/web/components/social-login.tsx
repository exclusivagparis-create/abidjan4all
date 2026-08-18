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
  return null;
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
