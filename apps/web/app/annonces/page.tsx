import Link from "next/link";
import type { Metadata } from "next";
import { prisma, type ListingType } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatDate } from "@/lib/format";
import { ListingForm } from "./listing-form";

export const metadata: Metadata = {
  title: "Petites annonces — emploi, immobilier, services",
  description: "Les annonces de la communauté Abidjan4All : offres d'emploi, immobilier et services en Côte d'Ivoire.",
  alternates: { canonical: "/annonces" },
};
// Le pied de page et les annonces interrogent la base — rendu à la requête.
export const dynamic = "force-dynamic";

const TYPE_META: Record<ListingType, { label: string; color: string }> = {
  emploi: { label: "Emploi", color: "#0E8A5F" },
  immobilier: { label: "Immobilier", color: "#2E5AAC" },
  service: { label: "Service", color: "#C98A17" },
};
const TYPES = Object.keys(TYPE_META) as ListingType[];

export default async function AnnoncesPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const [{ type }, session] = await Promise.all([searchParams, auth()]);
  const filter = TYPES.includes(type as ListingType) ? (type as ListingType) : undefined;

  const listings = await prisma.listing.findMany({
    where: {
      status: "published",
      expiresAt: { gt: new Date() },
      ...(filter ? { type: filter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true, type: true, title: true, description: true, price: true,
      location: true, attributes: true, createdAt: true,
      author: { select: { name: true } },
    },
  });

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-8 pb-24 pt-12">
        <div className="mb-3 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="h-[5px] w-[34px] rounded-[3px] bg-green" />
          <h1 className="font-serif text-[40px] font-medium leading-none">Petites annonces</h1>
        </div>
        <p className="mb-6 max-w-[62ch] font-serif text-[15px] text-ink-2">
          Emploi, immobilier et services — les annonces de la communauté Abidjan4All, en Côte d&apos;Ivoire et dans la
          diaspora. Dépôt gratuit, publication après validation.
        </p>

        <div className="mb-6 flex flex-wrap gap-2">
          <Link href="/annonces" className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold ${!filter ? "bg-navy text-white" : "border border-line bg-surface text-ink-2"}`}>
            Toutes
          </Link>
          {TYPES.map((t) => (
            <Link key={t} href={`/annonces?type=${t}`} className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold ${filter === t ? "text-white" : "border border-line bg-surface text-ink-2"}`} style={filter === t ? { background: TYPE_META[t].color } : undefined}>
              {TYPE_META[t].label}
            </Link>
          ))}
        </div>

        <div className="mb-10 grid gap-3">
          {listings.map((l) => {
            const m = TYPE_META[l.type];
            const contact = (l.attributes as { contact?: string } | null)?.contact;
            return (
              <article key={l.id} className="rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
                <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                  <span className="rounded px-2 py-0.5 text-[10.5px] font-bold uppercase text-white" style={{ background: m.color }}>{m.label}</span>
                  <span className="text-[11.5px] text-ink-3">{l.location}</span>
                  <span className="ml-auto text-[11.5px] text-ink-3">{formatDate(l.createdAt)}</span>
                </div>
                <h2 className="mb-1.5 font-serif text-[20px] font-semibold leading-snug">{l.title}</h2>
                <p className="whitespace-pre-wrap font-serif text-[14.5px] leading-relaxed text-ink-2">{l.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line-2 pt-3 text-[12.5px] text-ink-3">
                  {l.price ? <span className="font-bold text-ink">{formatXOF(l.price)}</span> : null}
                  <span>Par {l.author.name}</span>
                  {contact ? <span className="ml-auto font-semibold text-ink-2">Contact : {contact}</span> : null}
                </div>
              </article>
            );
          })}
          {listings.length === 0 ? (
            <p className="py-12 text-center font-serif text-lg text-ink-3">Aucune annonce dans cette catégorie pour l&apos;instant.</p>
          ) : null}
        </div>

        <h2 className="mb-4 border-b-2 border-ink pb-3 font-serif text-[26px] font-medium">Déposer une annonce</h2>
        <ListingForm connected={Boolean(session?.user)} />
      </main>
      <SiteFooter />
    </div>
  );
}
