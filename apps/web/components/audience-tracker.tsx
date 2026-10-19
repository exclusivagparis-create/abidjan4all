"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Compteur d'audience, posé dans l'en-tête du site — donc sur toutes les pages
 * publiques, et sur aucune page du Studio.
 *
 * Il tournait côté serveur, au rendu de la page. Deux erreurs, relevées le
 * 19 octobre 2026 en regardant les pays des visites :
 *
 * — Tout programme qui récupérait le HTML comptait pour un lecteur. Les
 *   statistiques donnaient 50 % de visites américaines et 2 % ivoiriennes, avec
 *   des pays entiers à 1,00 page par visite.
 * — Les navigations internes ne comptaient pas : Next ne réaffiche pas
 *   l'en-tête quand on passe d'un article à l'autre, si bien qu'un lecteur qui
 *   parcourait dix pages n'en valait qu'une.
 *
 * Depuis le navigateur, les deux se corrigent ensemble : `usePathname` change à
 * chaque navigation, y compris interne, et un programme qui n'exécute pas de
 * script ne se voit plus.
 *
 * N'affiche rien et ne bloque rien : l'envoi part après le rendu, par
 * `sendBeacon` quand le navigateur le propose — il survit à la fermeture de
 * l'onglet — et par un `fetch` persistant sinon.
 */
export function AudienceTracker() {
  const chemin = usePathname();
  // Garde contre le double appel du mode strict en développement, et contre un
  // réaffichage qui ne changerait pas de page.
  const dernier = useRef<string | null>(null);

  useEffect(() => {
    if (!chemin || dernier.current === chemin) return;
    dernier.current = chemin;

    const corps = JSON.stringify({ path: chemin });
    const adresse = "/api/v1/audience/vue";

    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(adresse, new Blob([corps], { type: "application/json" }));
        return;
      }
    } catch {
      // sendBeacon refuse parfois un type de contenu : on retombe sur fetch.
    }

    void fetch(adresse, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: corps,
      keepalive: true,
    }).catch(() => {
      // Une mesure perdue ne doit jamais remonter au lecteur.
    });
  }, [chemin]);

  return null;
}
