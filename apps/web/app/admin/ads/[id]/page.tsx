import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";
import { updateCampaignAction } from "@/lib/actions/ad-actions";
import { CampaignForm, type CampaignInitial } from "@/components/admin/campaign-form";

export const metadata: Metadata = { title: "Modifier la campagne · Studio" };
export const dynamic = "force-dynamic";

const ymd = (d: Date) => new Date(d).toISOString().slice(0, 10);

export default async function EditCampaign({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  const [{ id }, { erreur }, session] = await Promise.all([params, searchParams, auth()]);
  if (session?.user?.role !== "admin") redirect("/admin");

  const [campaign, rubriques] = await Promise.all([
    prisma.adCampaign.findUnique({ where: { id } }),
    prisma.rubrique.findMany({ orderBy: { order: "asc" }, select: { slug: true, name: true } }),
  ]);
  if (!campaign) notFound();

  const initial: CampaignInitial = {
    advertiser: campaign.advertiser,
    format: campaign.format,
    cpm: campaign.cpm,
    headline: campaign.headline,
    linkUrl: campaign.linkUrl,
    imageUrl: campaign.imageUrl,
    targeting: (campaign.targeting ?? {}) as { rubriques?: string[]; geo?: string[] },
    startAt: ymd(campaign.startAt),
    endAt: ymd(campaign.endAt),
  };

  return (
    <div>
      <Link href="/admin/ads" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-ink-3 hover:text-ink">
        ‹ Retour à la régie
      </Link>
      <h1 className="mb-1 text-lg font-bold">Modifier la campagne</h1>
      <p className="mb-5 text-[12.5px] text-ink-3">
        {campaign.advertiser} — les modifications s&apos;appliquent immédiatement, même en cours de diffusion.
      </p>

      {campaign.status === "ended" ? (
        <p className="mb-4 rounded-md bg-[rgba(232,100,26,0.1)] px-4 py-2.5 text-[13px] font-semibold text-orange">
          Campagne terminée — enregistrez avec une <b>date de fin future</b> pour la reconduire :
          elle repassera en brouillon, prête à être réactivée.
        </p>
      ) : null}

      {erreur ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
          {erreur === "image"
            ? "Visuel refusé — format image (JPG/PNG/WebP/GIF/SVG) et 8 Mo maximum."
            : "Campagne invalide — vérifiez les champs et les dates."}
        </p>
      ) : null}

      <section className="rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <CampaignForm
          action={updateCampaignAction.bind(null, id)}
          rubriques={rubriques}
          initial={initial}
          submitLabel="Enregistrer les modifications"
        />
      </section>
    </div>
  );
}
