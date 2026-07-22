import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type AdFormat, type AdStatus } from "@a4a/db";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Espace annonceur" };
export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("fr-FR");
const FORMAT_LABEL: Record<AdFormat, string> = {
  leaderboard_728x90: "Bandeau 728×90",
  mpu_300x250: "Pavé 300×250",
  native: "Natif",
  interstitial: "Interstitiel",
  skin: "Habillage",
  video: "Vidéo",
};
const STATUS_LABEL: Record<AdStatus, string> = {
  draft: "En préparation",
  active: "En diffusion",
  paused: "En pause",
  ended: "Terminée",
};

export default async function EspaceAnnonceur() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/espace-annonceur");

  const campaigns = await prisma.adCampaign.findMany({
    where: { advertiserUserId: session.user.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { banners: { orderBy: { createdAt: "asc" } } },
  });

  const tImp = campaigns.reduce((s, c) => s + c.banners.reduce((x, b) => x + b.impressions, 0), 0);
  const tClk = campaigns.reduce((s, c) => s + c.banners.reduce((x, b) => x + b.clicks, 0), 0);
  const tCtr = tImp > 0 ? ((tClk / tImp) * 100).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[980px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-6">
          <div className="flex items-center gap-3.5">
            <span className="h-[5px] w-[34px] rounded-[3px] bg-[#1A6B3C]" />
            <h1 className="font-serif text-[27px] font-medium leading-none sm:text-[33px] lg:text-[38px]">Espace annonceur</h1>
          </div>
          {campaigns.length > 0 ? (
            <a href="/espace-annonceur/export" className="rounded-pill border border-line bg-surface-2 px-4 py-2 text-[12.5px] font-semibold text-ink-2 hover:text-ink">
              ⭳ Export CSV
            </a>
          ) : null}
        </div>

        <p className="mb-6 max-w-[64ch] font-serif text-[15px] text-ink-2">
          Suivez les performances de vos campagnes sur Abidjan4All : affichages, clics et taux de clic (CTR), en temps réel.
        </p>

        {campaigns.length === 0 ? (
          <div className="rounded-[14px] border border-line bg-surface p-8 text-center shadow-[var(--shadow-sm)]">
            <p className="font-serif text-[16px] text-ink-2">Aucune campagne n&apos;est encore rattachée à votre compte.</p>
            <p className="mt-1 text-[13px] text-ink-3">
              Contactez la régie via <Link href="/publicite" className="font-semibold text-[#1A6B3C] hover:underline">la page Publicité</Link> pour lancer une campagne.
            </p>
          </div>
        ) : (
          <>
            {/* Totaux */}
            <div className="mb-8 grid grid-cols-3 gap-4">
              {(
                [
                  [nf.format(tImp), "Affichages"],
                  [nf.format(tClk), "Clics"],
                  [`${tCtr} %`, "CTR moyen"],
                ] as const
              ).map(([v, l]) => (
                <div key={l} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
                  <div className="font-serif text-[26px] font-medium">{v}</div>
                  <div className="mt-0.5 text-[12px] text-ink-3">{l}</div>
                </div>
              ))}
            </div>

            {/* Une carte par campagne */}
            <div className="flex flex-col gap-5">
              {campaigns.map((c) => {
                const imp = c.banners.reduce((s, b) => s + b.impressions, 0);
                const clk = c.banners.reduce((s, b) => s + b.clicks, 0);
                const ctr = imp > 0 ? ((clk / imp) * 100).toFixed(2) : "—";
                return (
                  <section key={c.id} className="rounded-[14px] border border-line bg-surface px-6 py-5 shadow-[var(--shadow-sm)]">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line-2 pb-3">
                      <div>
                        <div className="font-serif text-[18px] font-semibold">{c.advertiser}</div>
                        <div className="text-[12px] text-ink-3">
                          {c.permanent ? "Diffusion permanente" : `${formatDate(c.startAt)} → ${formatDate(c.endAt)}`}
                        </div>
                      </div>
                      <span className="rounded-pill bg-surface-2 px-3 py-1 text-[11.5px] font-bold text-ink-2">{STATUS_LABEL[c.status]}</span>
                    </div>
                    <div className="mb-3 flex flex-wrap gap-x-8 gap-y-1 text-[13px]">
                      <span><b className="font-serif text-[16px]">{nf.format(imp)}</b> <span className="text-ink-3">affichages</span></span>
                      <span><b className="font-serif text-[16px]">{nf.format(clk)}</b> <span className="text-ink-3">clics</span></span>
                      <span><b className="font-serif text-[16px]">{ctr}{ctr !== "—" ? " %" : ""}</b> <span className="text-ink-3">CTR</span></span>
                    </div>
                    {/* Détail par bannière */}
                    <div className="overflow-x-auto rounded-[10px] border border-line-2">
                      <table className="w-full min-w-[420px] text-[12.5px]">
                        <thead>
                          <tr className="border-b border-line-2 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">
                            <th className="px-3 py-2">Bannière</th>
                            <th className="px-3 py-2 text-right">Affichages</th>
                            <th className="px-3 py-2 text-right">Clics</th>
                            <th className="px-3 py-2 text-right">CTR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.banners.map((b) => {
                            const bctr = b.impressions > 0 ? ((b.clicks / b.impressions) * 100).toFixed(2) + " %" : "—";
                            return (
                              <tr key={b.id} className="border-b border-line-2 last:border-b-0">
                                <td className="px-3 py-2">{FORMAT_LABEL[b.format]}{b.headline ? ` — ${b.headline}` : ""}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{nf.format(b.impressions)}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{nf.format(b.clicks)}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{bctr}</td>
                              </tr>
                            );
                          })}
                          {c.banners.length === 0 ? (
                            <tr><td colSpan={4} className="px-3 py-3 text-center text-ink-3">Aucune bannière pour l&apos;instant.</td></tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
