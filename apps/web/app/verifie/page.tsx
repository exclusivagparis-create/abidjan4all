import type { Metadata } from "next";
import { prisma, type FactCheckVerdict } from "@a4a/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatDateFull } from "@/lib/format";

export const metadata: Metadata = {
  title: "A4A Vérifie — le fact-checking d'Abidjan4All",
  description: "Nos vérifications : affirmations passées au crible, avec verdict et sources.",
  alternates: { canonical: "/verifie" },
};
// Rendu à la requête : la base n'est pas joignable au build (Docker/CI).
export const dynamic = "force-dynamic";

const VERDICT_META: Record<FactCheckVerdict, { label: string; color: string; icon: string }> = {
  vrai: { label: "Vrai", color: "#0E8A5F", icon: "✓" },
  faux: { label: "Faux", color: "#a01520", icon: "✕" },
  trompeur: { label: "Trompeur", color: "#E8641A", icon: "!" },
  a_verifier: { label: "À vérifier", color: "#6C7791", icon: "?" },
};

export default async function VerifiePage() {
  const items = await prisma.factCheck.findMany({ orderBy: { publishedAt: "desc" }, take: 50 });

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[820px] px-8 pb-24 pt-12">
        <div className="mb-3 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-green text-white">✓</span>
          <h1 className="font-serif text-[40px] font-medium leading-none">A4A Vérifie</h1>
        </div>
        <p className="mb-8 max-w-[62ch] font-serif text-[15px] text-ink-2">
          Le fact-checking d&apos;Abidjan4All : nous passons au crible les affirmations qui circulent, avec un verdict
          clair et des sources vérifiables.
        </p>

        <div className="grid gap-4">
          {items.map((f) => {
            const m = VERDICT_META[f.verdict];
            return (
              <article key={f.id} className="rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
                <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.04em] text-white" style={{ background: m.color }}>
                    {m.icon} {m.label}
                  </span>
                  <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{f.topic}</span>
                  <span className="ml-auto text-[11.5px] text-ink-3">{formatDateFull(f.publishedAt)}</span>
                </div>
                <h2 className="mb-2 font-serif text-[21px] font-semibold leading-snug">« {f.claim} »</h2>
                <p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-ink-2">{f.body}</p>
                {f.sources.length > 0 ? (
                  <div className="mt-3 border-t border-line-2 pt-3 text-[12.5px] text-ink-3">
                    <span className="font-semibold">Sources :</span>{" "}
                    {f.sources.map((s, i) => (
                      <span key={i}>
                        {i > 0 ? " · " : ""}
                        {/^https?:\/\//.test(s) ? (
                          <a href={s} target="_blank" rel="noreferrer" className="text-blue underline">{new URL(s).hostname.replace("www.", "")}</a>
                        ) : (
                          s
                        )}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
          {items.length === 0 ? (
            <p className="py-16 text-center font-serif text-lg text-ink-3">Les premières vérifications arrivent bientôt.</p>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
