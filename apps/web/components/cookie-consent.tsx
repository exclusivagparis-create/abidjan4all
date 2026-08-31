"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";

const KEY = "a4a-consent"; // "granted" | "denied"

/**
 * Bandeau de consentement pour la MESURE D'AUDIENCE seulement.
 *
 * La publicité n'est plus de son ressort : depuis l'activation d'AdSense,
 * Google affiche son propre message de consentement (cadre TCF), qui fait
 * autorité pour les annonces. Le temps où ce bandeau couvrait aussi la
 * publicité aura duré quelques jours, et il aura suffi à empiler deux
 * dialogues plein écran par-dessus le site — le second masquant tout ce qui se
 * trouvait derrière. Un seul dispositif doit poser la question.
 *
 * Le bandeau ne s'affiche donc que si GA4 est configuré. GA4 ne l'étant pas en
 * production, il ne s'affiche pas du tout aujourd'hui, et c'est correct : rien
 * ne se dépose qu'on n'ait déjà annoncé.
 *
 * À prévoir le jour où GA4 sera activé : le lectorat européen verrait de
 * nouveau deux bandeaux. Il faudra alors lire le signal TCF de Google plutôt
 * que de reposer la question.
 */
export function CookieConsent({ ga4Id }: { ga4Id?: string }) {
  const [choice, setChoice] = useState<"granted" | "denied" | null | "loading">("loading");

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    setChoice(saved === "granted" || saved === "denied" ? saved : null);
  }, []);

  const decide = (value: "granted" | "denied") => {
    localStorage.setItem(KEY, value);
    setChoice(value);
  };

  return (
    <>
      {/* GA4 chargé uniquement si consentement accordé */}
      {ga4Id && choice === "granted" ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${ga4Id}',{anonymize_ip:true});`}
          </Script>
        </>
      ) : null}

      {/* Bandeau : seulement si la mesure d'audience est réellement active. */}
      {ga4Id && choice === null ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface px-5 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-[1000px] flex-wrap items-center gap-x-6 gap-y-3">
            <p className="min-w-[240px] flex-1 text-[13px] leading-relaxed text-ink-2">
              Nous utilisons des cookies de mesure d&apos;audience pour améliorer votre expérience. Vous pouvez
              les accepter ou les refuser. Voir notre{" "}
              <Link href="/confidentialite" className="font-semibold text-blue underline">
                politique de confidentialité
              </Link>
              .
            </p>
            <div className="flex flex-none gap-2.5">
              <button
                type="button"
                onClick={() => decide("denied")}
                className="rounded-pill border border-line bg-surface-2 px-4 py-2 text-[13px] font-semibold text-ink"
              >
                Refuser
              </button>
              <button
                type="button"
                onClick={() => decide("granted")}
                className="rounded-pill bg-red px-5 py-2 text-[13px] font-bold text-white"
              >
                Accepter
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
