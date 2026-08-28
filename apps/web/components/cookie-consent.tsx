"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";

const KEY = "a4a-consent"; // "granted" | "denied"

/**
 * Bandeau de consentement cookies (RGPD/CNIL).
 *
 * Deux usages en dépendent, et pas de la même façon :
 *  — la MESURE D'AUDIENCE (GA4) n'est pas chargée du tout sans accord ;
 *  — la PUBLICITÉ (AdSense) est chargée dans tous les cas, parce que Google
 *    exige sa balise sur chaque page, mais en mode non personnalisé tant que
 *    l'accord n'est pas donné (voir le préambule dans app/layout.tsx).
 *
 * Le bandeau s'affiche dès que l'un des deux est configuré. Il ne se montrait
 * qu'avec GA4 : la publicité activée seule — ce qui est le cas en production,
 * GA4 n'étant pas renseigné — n'aurait jamais laissé au lecteur l'occasion de
 * se prononcer, et la personnalisation serait restée éteinte à jamais.
 */
export function CookieConsent({ ga4Id, adsense }: { ga4Id?: string; adsense?: boolean }) {
  const [choice, setChoice] = useState<"granted" | "denied" | null | "loading">("loading");

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    setChoice(saved === "granted" || saved === "denied" ? saved : null);
  }, []);

  const decide = (value: "granted" | "denied") => {
    localStorage.setItem(KEY, value);
    setChoice(value);
    // Le script publicitaire a déjà été lu, avec le réglage d'avant le choix :
    // seul un rechargement le fait repartir sur la bonne base. On ne recharge
    // qu'en acceptant — un refus n'a rien à réappliquer, le mode restreint
    // étant déjà celui en vigueur.
    if (value === "granted" && adsense) window.location.reload();
  };

  const aQuoiConsentir = Boolean(ga4Id) || Boolean(adsense);

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

      {/* Bandeau : dès qu'il y a matière à consentir, et tant qu'on n'a pas choisi */}
      {aQuoiConsentir && choice === null ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface px-5 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-[1000px] flex-wrap items-center gap-x-6 gap-y-3">
            <p className="min-w-[240px] flex-1 text-[13px] leading-relaxed text-ink-2">
              {/* Le texte doit nommer ce à quoi on consent réellement : annoncer
                  la seule « mesure d'audience » alors que des cookies
                  publicitaires sont en jeu rendrait le consentement caduc. */}
              {adsense && ga4Id
                ? "Nous utilisons des cookies de mesure d'audience et de personnalisation des annonces. "
                : adsense
                  ? "Nous utilisons des cookies pour personnaliser les annonces publicitaires. Sans votre accord, les annonces restent affichées, mais sans profilage. "
                  : "Nous utilisons des cookies de mesure d'audience pour améliorer votre expérience. "}
              Vous pouvez les accepter ou les refuser. Voir notre{" "}
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
