"use client";

/**
 * Protection du travail non enregistré dans l'éditeur d'article.
 *
 * Un rédacteur qui quittait la page perdait tout : rien ne l'avertissait, et
 * rien ne subsistait. Deux protections, parce qu'aucune ne suffit seule.
 *
 *  1. L'AVERTISSEMENT arrête le départ volontaire — fermeture d'onglet,
 *     rechargement, clic sur un lien du Studio. Il ne peut rien contre une
 *     coupure de courant, un plantage du navigateur ou une session expirée.
 *
 *  2. LE BROUILLON LOCAL couvre précisément ces cas-là. Il est écrit dans le
 *     navigateur, sans toucher la base : un article en cours n'a pas à exister
 *     côté serveur tant que son auteur ne l'a pas décidé — sans quoi la liste
 *     des articles se remplirait d'ébauches jamais assumées.
 *
 * Le navigateur impose ses règles à l'avertissement : le texte du message n'est
 * pas personnalisable, et la boîte ne s'affiche que si l'utilisateur a déjà
 * interagi avec la page. Cette dernière condition tombe d'elle-même ici — on
 * n'a rien à perdre tant qu'on n'a rien tapé.
 */
import { useEffect, useRef } from "react";

/** Espace de nommage des brouillons locaux, par article. */
export function cleBrouillon(id: string | null) {
  return `a4a:brouillon:${id ?? "nouveau"}`;
}

export interface BrouillonLocal<T> {
  valeur: T;
  enregistreLe: number;
}

/**
 * Avertit avant de quitter, et conserve une copie locale tant que des
 * modifications ne sont pas enregistrées.
 *
 * @param modifie   Y a-t-il du travail non enregistré ?
 * @param valeur    L'état à sauvegarder localement.
 * @param cle       Clé de stockage (voir `cleBrouillon`).
 */
export function useGardeModifications<T>(modifie: boolean, valeur: T, cle: string) {
  // Une référence, et non une dépendance d'effet : l'écouteur est posé une
  // fois, et lit la valeur du moment quand il se déclenche. Le réinstaller à
  // chaque frappe serait du gaspillage pour un résultat identique.
  const etat = useRef({ modifie, valeur, cle });
  etat.current = { modifie, valeur, cle };

  // 1. Avertissement du navigateur.
  useEffect(() => {
    const avant = (e: BeforeUnloadEvent) => {
      if (!etat.current.modifie) return;
      e.preventDefault();
      // Exigé par les navigateurs anciens ; le texte, lui, est ignoré partout.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avant);
    return () => window.removeEventListener("beforeunload", avant);
  }, []);

  // 2. Navigation interne : le routeur de Next.js ne déclenche pas
  // `beforeunload`, un clic sur « Articles » dans le menu du Studio emportait
  // donc le travail sans un mot. On intercepte le clic avant qu'il n'atteigne
  // le lien, en phase de capture.
  useEffect(() => {
    const surClic = (e: MouseEvent) => {
      if (!etat.current.modifie) return;
      // Clic milieu, Ctrl/Cmd+clic : ouvre un onglet, la page reste. Rien à faire.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const lien = (e.target as HTMLElement | null)?.closest?.("a");
      if (!lien) return;
      const href = lien.getAttribute("href");
      if (!href || href.startsWith("#") || lien.target === "_blank") return;

      const cible = new URL(href, window.location.href);
      if (cible.origin !== window.location.origin) return; // sortie du site : beforeunload s'en charge
      if (cible.pathname === window.location.pathname) return;

      const partir = window.confirm(
        "Cet article contient des modifications non enregistrées.\n\nQuitter la page sans enregistrer ?"
      );
      if (!partir) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("click", surClic, true);
    return () => document.removeEventListener("click", surClic, true);
  }, []);

  // 3. Brouillon local. Écrit après une pause de frappe pour ne pas solliciter
  // le stockage à chaque caractère.
  useEffect(() => {
    if (!modifie) return;
    const minuteur = setTimeout(() => {
      try {
        const copie: BrouillonLocal<T> = { valeur, enregistreLe: Date.now() };
        window.localStorage.setItem(cle, JSON.stringify(copie));
      } catch {
        // Stockage plein ou refusé (navigation privée) : l'avertissement reste
        // la protection principale, on n'interrompt pas la rédaction pour ça.
      }
    }, 1000);
    return () => clearTimeout(minuteur);
  }, [modifie, valeur, cle]);
}

/** Lit un brouillon local, ou null s'il n'y en a pas d'exploitable. */
export function lireBrouillon<T>(cle: string): BrouillonLocal<T> | null {
  try {
    const brut = window.localStorage.getItem(cle);
    if (!brut) return null;
    const copie = JSON.parse(brut) as BrouillonLocal<T>;
    return copie?.valeur ? copie : null;
  } catch {
    return null;
  }
}

/** Efface le brouillon local — après enregistrement, ou après refus de reprise. */
export function oublierBrouillon(cle: string) {
  try {
    window.localStorage.removeItem(cle);
  } catch {
    /* rien à faire : au pire une copie périmée reste, elle sera écrasée. */
  }
}
