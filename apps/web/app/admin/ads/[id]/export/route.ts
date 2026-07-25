import { prisma } from "@a4a/db";
import { auth } from "@/auth";

/** Échappe une valeur pour un champ CSV (guillemets doublés, entouré si besoin). */
function csv(value: string | number): string {
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /admin/ads/:id/export — stats par bannière d'une campagne, en CSV.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!["admin", "ad_manager"].includes(session?.user?.role ?? "")) return new Response("Accès refusé.", { status: 403 });

  const { id } = await params;
  const campaign = await prisma.adCampaign.findUnique({
    where: { id },
    include: { banners: { orderBy: { createdAt: "asc" } } },
  });
  if (!campaign) return new Response("Campagne introuvable.", { status: 404 });

  const header = ["Annonceur", "Format", "Accroche", "Lien", "Impressions", "Clics", "CTR (%)", "Active", "Créée le"];
  const lignes = campaign.banners.map((b) => {
    const ctr = b.impressions > 0 ? ((b.clicks / b.impressions) * 100).toFixed(2) : "0.00";
    return [
      campaign.advertiser,
      b.format,
      b.headline ?? "",
      b.linkUrl ?? "",
      b.impressions,
      b.clicks,
      ctr,
      b.active ? "oui" : "non",
      new Date(b.createdAt).toISOString().slice(0, 10),
    ].map(csv).join(";");
  });
  // BOM UTF-8 : Excel ouvre correctement les accents.
  const corps = "﻿" + [header.join(";"), ...lignes].join("\r\n");

  const nom = `campagne-${campaign.advertiser.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
  return new Response(corps, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nom}"`,
    },
  });
}
