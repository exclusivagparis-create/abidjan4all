import { detacherCompteAction, rattacherCompteAction } from "@/lib/actions/auth-actions";
import { fournisseursActifs } from "@/lib/social-login";
import { formatDateFull } from "@/lib/format";

/** Messages affichés au retour du rattachement, réussi ou non. */
export const MESSAGES_LIEN: Record<string, { ton: "ok" | "erreur"; texte: string }> = {
  ok: { ton: "ok", texte: "Compte rattaché. Vous pouvez désormais vous connecter d’un clic." },
  detache: { ton: "ok", texte: "Compte détaché. Il ne permet plus de se connecter." },
  deja_lie: {
    ton: "erreur",
    texte: "Ce compte Google est déjà rattaché à un autre membre d’Abidjan4All. Détachez-le d’abord de l’autre compte.",
  },
  lien_autre_compte: {
    ton: "erreur",
    texte:
      "L’adresse de ce compte Google appartient déjà à un autre membre. Rattacher les deux détournerait ses connexions.",
  },
  dernier_acces: {
    ton: "erreur",
    texte:
      "C’est votre seul moyen de vous connecter : vous n’avez pas de mot de passe. Définissez-en un avant de détacher ce compte.",
  },
};

/**
 * Section « Connexion par un compte tiers » des paramètres.
 *
 * C'est ici — et seulement ici — qu'un membre de la rédaction peut rattacher
 * son compte Google. La connexion sociale ordinaire le refuse pour les comptes
 * qui publient ; le refus protège d'un rattachement subi, pas d'un choix fait
 * en connaissance de cause depuis sa propre session.
 */
export function ComptesLies({
  liens,
  aUnMotDePasse,
}: {
  liens: { provider: string; createdAt: Date }[];
  aUnMotDePasse: boolean;
}) {
  const actifs = fournisseursActifs();
  if (actifs.length === 0) return null;

  return (
    <section className="rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-[0.06em] text-ink-3">
        Connexion par un compte tiers
      </h2>
      <p className="mb-5 text-[12.5px] leading-[1.6] text-ink-3">
        Rattachez un compte pour vous connecter sans saisir votre mot de passe. Votre adresse e-mail et votre
        rôle sur le site restent inchangés.
      </p>

      <div className="grid gap-3">
        {actifs.map((f) => {
          const lien = liens.find((l) => l.provider === f.id);
          return (
            <div
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-surface-2 px-4 py-3"
            >
              <div>
                <div className="text-[14px] font-semibold text-ink">{f.label}</div>
                <div className="text-[12px] text-ink-3">
                  {lien ? `Rattaché le ${formatDateFull(lien.createdAt)}` : "Non rattaché"}
                </div>
              </div>

              {lien ? (
                <form action={detacherCompteAction}>
                  <input type="hidden" name="provider" value={f.id} />
                  <button
                    type="submit"
                    className="rounded-pill border border-line bg-surface px-4 py-2 text-[12.5px] font-bold text-red"
                  >
                    Détacher
                  </button>
                </form>
              ) : (
                <form action={rattacherCompteAction}>
                  <input type="hidden" name="provider" value={f.id} />
                  <button
                    type="submit"
                    className="rounded-pill bg-brand-fill px-4 py-2 text-[12.5px] font-bold text-brand-on"
                  >
                    Rattacher {f.label}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {!aUnMotDePasse && liens.length > 0 ? (
        <p className="mt-4 rounded-[8px] bg-[rgba(232,100,26,0.1)] px-3.5 py-2.5 text-[12.5px] leading-[1.5] font-semibold text-orange">
          Vous n’avez pas de mot de passe : ce rattachement est votre seul moyen d’entrer. Définissez-en un
          ci-dessus avant de le détacher.
        </p>
      ) : null}
    </section>
  );
}
