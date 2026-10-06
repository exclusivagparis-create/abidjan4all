"use client";

import { useEffect, useRef } from "react";

/**
 * Signale au serveur qu'une vidéo vient d'être lancée.
 *
 * Une vidéo déjà comptée ne l'est plus de la session : sans cette mémoire, un
 * lecteur qui revient trois fois sur la page gonflerait le chiffre à lui seul.
 * Le serveur applique la même prudence de son côté, une fois par heure et par
 * adresse.
 *
 * `sendBeacon` plutôt que `fetch` : le clic ouvre la vidéo dans un autre
 * onglet ou quitte la page, et une requête ordinaire serait annulée en vol.
 */
const CLE = "a4a-vues-video";

function dejaComptee(id: string): boolean {
  try {
    return (sessionStorage.getItem(CLE) ?? "").split(",").includes(id);
  } catch {
    // Navigation privée ou stockage refusé : on compte, le serveur limitera.
    return false;
  }
}

function retenir(id: string) {
  try {
    const vues = (sessionStorage.getItem(CLE) ?? "").split(",").filter(Boolean);
    vues.push(id);
    sessionStorage.setItem(CLE, vues.join(","));
  } catch {
    /* sans mémoire de session, le garde-fou serveur suffit */
  }
}

export function compterVue(id: string) {
  if (dejaComptee(id)) return;
  retenir(id);
  const url = `/api/v1/videos/${id}/vue`;
  if (navigator.sendBeacon) navigator.sendBeacon(url);
  else void fetch(url, { method: "POST", keepalive: true }).catch(() => {});
}

/** Lien vers la vidéo d'origine, qui compte la lecture au passage. */
export function LienVideo({
  id,
  href,
  className,
  children,
}: {
  id: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className} onClick={() => compterVue(id)}>
      {children}
    </a>
  );
}

/**
 * Compte une lecture sur le lecteur intégré.
 *
 * Le contenu d'une iframe appartient à la plateforme : ni clic ni événement de
 * lecture ne nous parviennent. Le seul signal fiable est le départ du focus
 * vers cette iframe, qui ne se produit que si quelqu'un a cliqué dedans —
 * c'est-à-dire, sur un lecteur vidéo, s'il a lancé la lecture.
 */
export function VueLecteurIntegre({ id }: { id: string }) {
  const compte = useRef(false);

  useEffect(() => {
    const onBlur = () => {
      if (compte.current) return;
      const actif = document.activeElement;
      if (actif instanceof HTMLIFrameElement && actif.dataset.videoId === id) {
        compte.current = true;
        compterVue(id);
      }
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [id]);

  return null;
}
