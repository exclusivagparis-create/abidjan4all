import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { listActivePacks } from "@/lib/packs";
import { ReservationForm } from "./reservation-form";

export const metadata: Metadata = {
  title: "Réserver un emplacement publicitaire",
  description: "Réservez et payez en ligne un emplacement publicitaire sur Abidjan4All : bandeau, pavé, natif ou vidéo, à la durée.",
  alternates: { canonical: "/publicite/reserver" },
};
export const dynamic = "force-dynamic";

const ERREURS: Record<string, string> = {
  saisie: "Sélection incomplète — choisissez un emplacement et un moyen de paiement.",
  lien: "Le lien de destination doit commencer par http:// ou https://.",
  image: "Visuel refusé — format image (JPG/PNG/WebP/GIF) et 8 Mo maximum.",
  creatif: "Ajoutez un visuel ou au moins une accroche.",
  "1": "Paiement non abouti. Vous pouvez réessayer ci-dessous.",
};

export default async function ReserverPage({ searchParams }: { searchParams: Promise<{ echec?: string; indisponible?: string }> }) {
  const [{ echec, indisponible }, session, packs] = await Promise.all([searchParams, auth(), listActivePacks()]);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[860px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <Link href="/publicite" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-ink-3 hover:text-ink">
          ‹ Retour aux tarifs
        </Link>
        <div className="mb-3 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="h-[5px] w-[34px] rounded-[3px] bg-red" />
          <h1 className="font-serif text-[27px] font-medium leading-none sm:text-[33px] lg:text-[38px]">Réserver un emplacement</h1>
        </div>
        <p className="mb-6 max-w-[64ch] font-serif text-[15px] text-ink-2">
          Choisissez un emplacement et une durée, envoyez votre visuel, payez en ligne — après un rapide contrôle de
          conformité par la rédaction, votre publicité est diffusée pour la période complète choisie.
        </p>

        {echec ? (
          <p className="mb-5 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
            {ERREURS[echec] ?? "Une erreur est survenue — réessayez."}
          </p>
        ) : null}
        {indisponible ? (
          <p className="mb-5 rounded-md bg-[rgba(232,100,26,0.1)] px-4 py-2.5 text-[13px] font-semibold text-orange">
            Ce moyen de paiement est momentanément indisponible — essayez-en un autre.
          </p>
        ) : null}

        <ReservationForm connected={Boolean(session?.user)} packs={packs} />
      </main>
      <SiteFooter />
    </div>
  );
}
