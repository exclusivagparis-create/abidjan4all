"use client";

import { useEffect, useState } from "react";

/**
 * Enregistre le service worker et propose l'installation quand le navigateur
 * l'accepte.
 *
 * Deux rôles dans un seul composant, parce qu'ils vont ensemble : sans service
 * worker enregistré sur toutes les pages, aucun navigateur ne propose
 * l'installation, et les alertes push ne survivent pas à la fermeture de
 * l'onglet. Il était jusqu'ici enregistré par le seul formulaire d'alertes de
 * l'espace membre — autant dire presque jamais.
 *
 * Le bouton n'apparaît que si le navigateur a émis `beforeinstallprompt` :
 * c'est lui qui sait si l'application est déjà installée, si la page est
 * éligible, et si le lecteur a déjà refusé. Proposer une installation qui ne
 * peut pas aboutir — sur iOS notamment, où elle passe par le menu Partager —
 * ferait une promesse que le bouton ne tiendrait pas.
 */
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function AppInstallable() {
  const [invite, setInvite] = useState<PromptEvent | null>(null);
  const [masque, setMasque] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Navigateur sans service worker, ou site ouvert sans HTTPS : le site
        // fonctionne comme avant, sans installation ni alertes.
      });
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInvite(e as PromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setInvite(null));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!invite || masque) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-line bg-surface-2 px-5 py-3.5">
      <span className="flex-1 text-[13.5px] font-semibold text-ink-2">
        📱 Installez Abidjan4All sur votre écran d&apos;accueil : lecture plein écran et alertes en direct.
      </span>
      <button
        type="button"
        onClick={async () => {
          await invite.prompt();
          await invite.userChoice;
          setInvite(null);
        }}
        className="flex-none rounded-pill bg-red px-5 py-2 text-xs font-bold text-white"
      >
        Installer
      </button>
      <button
        type="button"
        onClick={() => setMasque(true)}
        aria-label="Masquer la proposition d'installation"
        className="flex-none text-[12.5px] font-semibold text-ink-3 hover:text-ink"
      >
        Plus tard
      </button>
    </div>
  );
}
