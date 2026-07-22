import { prisma } from "@a4a/db";
import { auth } from "@/auth";

function csv(value: string | number): string {
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /espace-annonceur/export — stats des campagnes du compte annonceur, en CSV.
export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Authentification requise.", { status: 401 });

  const campaigns = await prisma.adCampaign.findMany({
    where: { advertiserUserId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { banners: { orderBy: { createdAt: "asc" } } },
  });

  const header = ["Campagne", "Statut", "Bannière", "Affichages", "Clics", "CTR (%)"];
  const lignes = campaigns.flatMap((c) =>
    c.banners.map((b) => {
      const ctr = b.impressions > 0 ? ((b.clicks / b.impressions) * 100).toFixed(2) : "0.00";
      return [c.advertiser, c.status, b.format, b.impressions, b.clicks, ctr].map(csv).join(";");
    })
  );
  const corps = "﻿" + [header.join(";"), ...lignes].join("\r\n");

  return new Response(corps, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mes-campagnes-a4a.csv"`,
    },
  });
}
