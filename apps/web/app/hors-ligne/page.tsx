import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pas de connexion",
  robots: { index: false, follow: false },
};

/**
 * Page servie par le service worker quand le réseau manque.
 *
 * Volontairement autonome : ni en-tête, ni pied de page, ni requête en base.
 * Tout ce qu'elle affiche doit tenir dans le cache installé avec
 * l'application — une page qui aurait besoin du réseau pour dire qu'il n'y a
 * pas de réseau ne s'afficherait jamais.
 */
export default function HorsLignePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 text-ink">
      <div className="max-w-[46ch] text-center">
        <img src="/logo-web-light.png" alt="Abidjan4All" className="mx-auto mb-8 h-10 [display:var(--show-light)]" />
        <img src="/logo-web-dark.png" alt="" aria-hidden className="mx-auto mb-8 h-10 [display:var(--show-dark)]" />
        <h1 className="mb-3 font-serif text-[26px] font-medium leading-tight">Pas de connexion</h1>
        <p className="mb-6 font-serif text-[15.5px] leading-relaxed text-ink-2">
          Votre téléphone n&apos;atteint pas Internet pour l&apos;instant. Les pages déjà ouvertes restent lisibles ;
          celle-ci reviendra dès que le réseau sera de retour.
        </p>
        <Link href="/" className="inline-block rounded-pill bg-red px-5 py-2.5 text-[13px] font-bold text-white">
          Réessayer
        </Link>
      </div>
    </div>
  );
}
