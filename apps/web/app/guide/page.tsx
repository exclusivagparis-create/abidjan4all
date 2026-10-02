import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { parRegion } from "@/lib/guide";

export const metadata: Metadata = {
  title: "Guide de l'Afrique — pays, cultures, institutions",
  description:
    "Des fiches de fond sur l'Afrique : pays, peuples, langues, histoire, institutions. Le Guide de l'Afrique d'Abidjan4All, consultable et mis à jour.",
  alternates: { canonical: "/guide" },
};
export const dynamic = "force-dynamic";

export default async function GuidePage() {
  const fiches = await prisma.guideFiche.findMany({
    where: { published: true },
    orderBy: [{ order: "asc" }, { title: "asc" }],
    select: { slug: true, title: true, kind: true, region: true, summary: true },
  });

  const groupes = parRegion(fiches);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[1000px] px-4 pb-24 pt-12 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="h-[5px] w-[34px] rounded-[3px] bg-[var(--navy)]" />
          <h1 className="font-serif text-[27px] font-medium leading-none sm:text-[33px] lg:text-[40px]">Guide de l&apos;Afrique</h1>
        </div>
        <p className="mb-8 max-w-[64ch] font-serif text-[15.5px] leading-relaxed text-ink-2">
          Des fiches de fond, à consulter plutôt qu&apos;à suivre : un pays, un peuple, une institution, une tradition.
          Chacune suit la même trame — identité, histoire, culture, société, économie — pour qu&apos;une fiche se lise
          comme la précédente, et que deux pays se comparent sans tout relire.
        </p>

        {groupes.map(({ region, fiches }) => (
          <section key={region} className="mb-10">
            <h2 className="mb-4 border-b border-line pb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-3">{region}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {fiches.map((f) => (
                <Link
                  key={f.slug}
                  href={`/guide/${f.slug}`}
                  className="rounded-[12px] border border-line bg-surface p-5 transition-colors hover:border-ink-3"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded bg-surface-2 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-3">
                      {f.kind === "theme" ? "Thème" : "Pays"}
                    </span>
                  </div>
                  <h3 className="mb-1.5 font-serif text-[19px] font-semibold leading-snug">{f.title}</h3>
                  <p className="line-clamp-3 font-serif text-[14px] leading-relaxed text-ink-2">{f.summary}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {fiches.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-line bg-surface-2 px-5 py-12 text-center font-serif text-lg text-ink-3">
            Les premières fiches arrivent bientôt.
          </p>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
