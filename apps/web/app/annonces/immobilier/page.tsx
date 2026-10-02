import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatDate } from "@/lib/format";
import { TRANSACTIONS, correspond, criteresDe, lireFiltre, resume } from "@/lib/annonces-immobilier";

export const metadata: Metadata = {
  title: "Immobilier en Côte d'Ivoire — vente et location à Abidjan",
  description:
    "Annonces immobilières à Abidjan et en Côte d'Ivoire : vente, location, terrains. Déposées par la communauté Abidjan4All, en Côte d'Ivoire et dans la diaspora.",
  alternates: { canonical: "/annonces/immobilier" },
};
// Les annonces et le pied de page interrogent la base — rendu à la requête.
export const dynamic = "force-dynamic";

type Params = Promise<{ transaction?: string; prixMax?: string; pieces?: string; quartier?: string }>;

const field =
  "w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-ink-3";
const label = "grid gap-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3";

export default async function ImmobilierPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const filtre = lireFiltre(params);

  /**
   * Le tri par critères se fait en mémoire, après la requête.
   *
   * Ces critères vivent dans une colonne JSON : les filtrer en base
   * demanderait des requêtes qui connaissent la forme du JSON, éparpillant
   * cette connaissance hors du module qui la détient. À l'échelle des petites
   * annonces — quelques dizaines en ligne, 200 au plafond ci-dessous — la
   * différence ne se voit pas. Le jour où ce volume change, c'est ici qu'il
   * faudra revenir.
   */
  const toutes = await prisma.listing.findMany({
    where: { status: "published", type: "immobilier", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, title: true, description: true, price: true,
      location: true, attributes: true, createdAt: true,
      author: { select: { name: true } },
    },
  });

  const annonces = toutes.filter((a) => correspond(a, filtre));
  const filtreActif = Boolean(filtre.transaction || filtre.prixMax || filtre.piecesMin || filtre.quartier);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <nav className="mb-4 text-[12.5px] text-ink-3">
          <Link href="/annonces" className="hover:text-ink">Petites annonces</Link>
          <span className="px-1.5">›</span>
          <span className="text-ink-2">Immobilier</span>
        </nav>

        <div className="mb-3 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="h-[5px] w-[34px] rounded-[3px] bg-blue" />
          <h1 className="font-serif text-[27px] sm:text-[33px] lg:text-[40px] font-medium leading-none">Immobilier</h1>
        </div>
        <p className="mb-6 max-w-[62ch] font-serif text-[15px] text-ink-2">
          Vente, location et terrains à Abidjan et partout en Côte d&apos;Ivoire. Les annonces sont déposées par les
          membres, ici comme dans la diaspora, et publiées après règlement de la formule choisie.
        </p>

        {/* Recherche par critères : un formulaire ordinaire, donc une adresse
            partageable et indexable pour chaque recherche. */}
        <form method="get" className="mb-6 grid gap-3 rounded-[14px] border border-line bg-surface-2 p-5 sm:grid-cols-4">
          <label className={label}>
            Transaction
            <select name="transaction" defaultValue={filtre.transaction ?? ""} className={field}>
              <option value="">Toutes</option>
              {TRANSACTIONS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className={label}>
            Quartier
            <input name="quartier" defaultValue={filtre.quartier ?? ""} maxLength={60} placeholder="Cocody" className={field} />
          </label>
          <label className={label}>
            Pièces (min.)
            <input name="pieces" type="number" min={1} max={50} defaultValue={filtre.piecesMin ?? ""} className={field} />
          </label>
          <label className={label}>
            Prix max. (FCFA)
            <input name="prixMax" type="number" min={0} defaultValue={filtre.prixMax ?? ""} className={field} />
          </label>
          <div className="flex items-center gap-3 sm:col-span-4">
            <button type="submit" className="rounded-pill bg-navy px-5 py-2 text-xs font-bold text-white">Rechercher</button>
            {filtreActif ? (
              <Link href="/annonces/immobilier" className="text-[12.5px] font-semibold text-ink-3 hover:text-ink">
                Effacer les critères
              </Link>
            ) : null}
            <span className="ml-auto text-[12.5px] text-ink-3">
              {annonces.length} annonce{annonces.length > 1 ? "s" : ""}
              {filtreActif ? ` sur ${toutes.length}` : ""}
            </span>
          </div>
        </form>

        <div className="mb-10 grid gap-3">
          {annonces.map((a) => {
            const criteres = criteresDe(a.attributes);
            const traits = resume(criteres);
            return (
              <article key={a.id} className="rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
                <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                  <span className="rounded bg-blue px-2 py-0.5 text-[10.5px] font-bold uppercase text-white">Immobilier</span>
                  <span className="text-[11.5px] text-ink-3">{a.location}</span>
                  <span className="ml-auto text-[11.5px] text-ink-3">{formatDate(a.createdAt)}</span>
                </div>
                <h2 className="mb-1.5 font-serif text-[20px] font-semibold leading-snug">{a.title}</h2>
                {traits.length ? (
                  <p className="mb-2 text-[12.5px] font-semibold text-ink-2">{traits.join(" · ")}</p>
                ) : null}
                <p className="whitespace-pre-wrap font-serif text-[14.5px] leading-relaxed text-ink-2">{a.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line-2 pt-3 text-[12.5px] text-ink-3">
                  {a.price ? <span className="font-bold text-ink">{formatXOF(a.price)}</span> : null}
                  <span>Par {a.author.name}</span>
                  {criteres.contact ? (
                    <span className="ml-auto font-semibold text-ink-2">Contact : {criteres.contact}</span>
                  ) : null}
                </div>
              </article>
            );
          })}

          {annonces.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-line bg-surface-2 px-5 py-12 text-center">
              <p className="font-serif text-lg text-ink-3">
                {filtreActif ? "Aucune annonce ne correspond à ces critères." : "Aucune annonce immobilière en ligne pour l'instant."}
              </p>
              {filtreActif ? (
                <Link href="/annonces/immobilier" className="mt-3 inline-block text-[13px] font-bold text-blue">
                  Voir toutes les annonces immobilières
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line bg-surface-2 px-5 py-4">
          <span className="text-[13.5px] font-semibold text-ink-2">
            🏠 Un bien à vendre ou à louer ? Publiez-le auprès de la communauté, en Côte d&apos;Ivoire et dans la diaspora.
          </span>
          <Link href="/annonces#deposer" className="flex-none rounded-pill bg-red px-5 py-2 text-xs font-bold text-white">
            Déposer une annonce
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
