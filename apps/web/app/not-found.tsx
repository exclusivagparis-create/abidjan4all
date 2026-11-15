import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Page introuvable",
  // `noindex` : sans cela, une 404 atteinte par un moteur peut finir indexée
  // comme une page ordinaire, puisqu'elle en a désormais l'apparence.
  robots: { index: false, follow: true },
};

// Le pied de page interroge la base (rubriques, pages) — rendu à la requête.
export const dynamic = "force-dynamic";

/**
 * Page 404 du site public.
 *
 * Elle compte plus ici que sur un site ordinaire : six ans d'archives ont été
 * transférés depuis abidjan4all.net, avec 3 384 redirections. Une adresse
 * oubliée dans cette table tombe ici, et le lecteur venait de quelque part —
 * d'un moteur, d'un partage, d'un vieux signet. La page lui propose donc des
 * chemins de sortie plutôt qu'un cul-de-sac.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[720px] px-4 pb-24 pt-12 sm:px-6 lg:px-8">
        <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-orange">Erreur 404</p>
        <h1 className="mb-3 border-b-2 border-ink pb-5 font-serif text-[clamp(28px,5vw,40px)] font-medium">
          Cette page n&apos;existe pas
        </h1>
        <p className="mb-8 max-w-[60ch] font-serif text-[15px] leading-relaxed text-ink-2">
          L&apos;adresse est peut-être erronée, ou l&apos;article a été déplacé lors du transfert de nos archives.
          Nos 4 800 articles restent en ligne : voici par où les retrouver.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Lien href="/" titre="L&apos;accueil" detail="L&apos;actualité du jour, à la une" />
          <Lien href="/recherche" titre="La recherche" detail="Chercher dans six ans d&apos;archives" />
          <Lien href="/actualite" titre="Actualité" detail="La rubrique la plus fournie" />
          <Lien href="/contact" titre="Nous écrire" detail="Signaler un lien cassé" />
        </div>

        <p className="mt-8 max-w-[60ch] text-[13px] leading-relaxed text-ink-3">
          Vous êtes arrivé ici depuis un lien d&apos;un autre site ou d&apos;un moteur de recherche ?
          Dites-le-nous : nous rétablissons la redirection manquante.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

function Lien({ href, titre, detail }: { href: string; titre: string; detail: string }) {
  return (
    <Link
      href={href}
      className="rounded-[10px] border border-line bg-surface px-4 py-3 transition-colors hover:border-ink-3"
    >
      <span className="block font-serif text-[16px] font-semibold text-ink">{titre}</span>
      <span className="mt-0.5 block text-[13px] text-ink-3">{detail}</span>
    </Link>
  );
}
