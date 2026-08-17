import { autoriserAction, refuserAction } from "@/lib/actions/oauth-actions";

/**
 * Écran de consentement. Volontairement sobre et explicite : le lecteur doit
 * comprendre d'un coup d'œil qui demande, au nom de qui, et quoi exactement.
 * Les portées sont décochables — on accorde le minimum utile, pas le maximum
 * demandé.
 */
export function FormulaireAutorisation({
  client,
  redirectUri,
  state,
  codeChallenge,
  utilisateur,
  portées,
}: {
  client: { clientId: string; name: string };
  redirectUri: string;
  state: string;
  codeChallenge: string;
  utilisateur: { nom: string; role: string };
  portées: { id: string; label: string; detail: string }[];
}) {
  const hôte = (() => {
    try {
      return new URL(redirectUri).host;
    } catch {
      return redirectUri;
    }
  })();

  return (
    <main className="mx-auto grid min-h-screen max-w-[560px] place-items-center px-5 py-10">
      <div className="w-full rounded-[14px] border border-line bg-surface p-7 shadow-[var(--shadow-sm)]">
        {/* Deux fichiers, comme dans le pied de page : le thème sombre du
            lecteur ne doit pas avaler un logo noir. */}
        <img src="/logo-light.png" alt="Abidjan4All" className="mb-6 h-7 [display:var(--show-light)]" />
        <img src="/logo-dark.png" alt="Abidjan4All" className="mb-6 h-7 [display:var(--show-dark)]" />

        <h1 className="mb-2 font-serif text-[23px] font-semibold leading-[1.25] text-ink">
          Autoriser «&nbsp;{client.name}&nbsp;» à accéder au site&nbsp;?
        </h1>
        <p className="mb-6 text-[13.5px] leading-[1.6] text-ink-2">
          Cette application agira en votre nom, en tant que <b>{utilisateur.nom}</b>. Elle ne pourra rien
          faire que votre rôle ne vous permette déjà, et <b>ne publiera jamais</b>&nbsp;: la mise en ligne
          reste un geste humain, dans le Studio.
        </p>

        <form action={autoriserAction} className="grid gap-5">
          <input type="hidden" name="client_id" value={client.clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="code_challenge" value={codeChallenge} />

          <fieldset className="grid gap-2.5 rounded-[10px] border border-line bg-surface-2 p-4">
            <legend className="px-1 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-3">
              Ce que vous accordez
            </legend>
            {portées.map((s) => (
              <label key={s.id} className="flex items-start gap-2.5 text-[13.5px] text-ink-2">
                <input type="checkbox" name="scopes" value={s.id} defaultChecked className="mt-1" />
                <span>
                  <b className="font-semibold text-ink">{s.label}</b>
                  <span className="block text-[12.5px] text-ink-3">{s.detail}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <p className="text-[12px] leading-[1.55] text-ink-3">
            Après autorisation, vous serez renvoyé vers <b>{hôte}</b>. L&apos;accès est révocable à tout
            moment depuis Studio&nbsp;▸&nbsp;Accès API, et expire automatiquement au bout de 90 jours.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-pill bg-brand-fill px-6 py-2.5 text-[13px] font-bold text-brand-on"
            >
              Autoriser
            </button>
            <button
              type="submit"
              formAction={refuserAction}
              className="rounded-pill border border-line bg-surface px-6 py-2.5 text-[13px] font-bold text-ink-2"
            >
              Refuser
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
