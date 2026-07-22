import { prisma } from "@a4a/db";
import { sendEmail, emailLayout } from "@/lib/email";
import { SITE_URL } from "@/lib/seo";

const nf = new Intl.NumberFormat("fr-FR");

/** Période courante au format « YYYY-MM » (mois d'envoi du rapport). */
export function periodeCourante(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Envoie le récapitulatif mensuel à chaque annonceur (rôle « partner ») ayant
 * au moins une campagne rattachée. Idempotent : un seul envoi par annonceur et
 * par période (contrainte unique AdReportLog). Le rapport présente le delta
 * d'affichages et de clics depuis le dernier relevé.
 */
export async function sendMonthlyAdReports(period = periodeCourante()): Promise<{ envoyes: number; ignores: number }> {
  const partners = await prisma.user.findMany({
    where: { role: "partner", advertiserCampaigns: { some: {} } },
    select: { id: true, name: true, email: true },
  });

  let envoyes = 0;
  let ignores = 0;

  for (const p of partners) {
    // Déjà envoyé ce mois-ci ? on n'insiste pas.
    const deja = await prisma.adReportLog.findUnique({
      where: { advertiserUserId_period: { advertiserUserId: p.id, period } },
    });
    if (deja) {
      ignores++;
      continue;
    }

    const campaigns = await prisma.adCampaign.findMany({
      where: { advertiserUserId: p.id },
      include: { banners: { select: { impressions: true, clicks: true } } },
    });
    const curImp = campaigns.reduce((s, c) => s + c.banners.reduce((x, b) => x + b.impressions, 0), 0);
    const curClk = campaigns.reduce((s, c) => s + c.banners.reduce((x, b) => x + b.clicks, 0), 0);

    // Delta depuis le dernier relevé (période précédente).
    const dernier = await prisma.adReportLog.findFirst({
      where: { advertiserUserId: p.id },
      orderBy: { period: "desc" },
    });
    const dImp = Math.max(0, curImp - (dernier?.impressions ?? 0));
    const dClk = Math.max(0, curClk - (dernier?.clicks ?? 0));
    const ctr = dImp > 0 ? ((dClk / dImp) * 100).toFixed(2) : "0.00";

    const body = `
      <p>Bonjour ${p.name},</p>
      <p>Voici le récapitulatif de vos campagnes sur Abidjan4All pour la période <b>${period}</b> :</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 4px;border-collapse:collapse">
        <tr>
          <td style="padding:10px 18px;border:1px solid #e0d8cc;border-radius:6px;text-align:center">
            <div style="font-size:24px;font-weight:700;color:#1A6B3C">${nf.format(dImp)}</div>
            <div style="font-size:12px;color:#777">Affichages</div>
          </td>
          <td style="width:12px"></td>
          <td style="padding:10px 18px;border:1px solid #e0d8cc;border-radius:6px;text-align:center">
            <div style="font-size:24px;font-weight:700;color:#1A6B3C">${nf.format(dClk)}</div>
            <div style="font-size:12px;color:#777">Clics</div>
          </td>
          <td style="width:12px"></td>
          <td style="padding:10px 18px;border:1px solid #e0d8cc;border-radius:6px;text-align:center">
            <div style="font-size:24px;font-weight:700;color:#1A6B3C">${ctr} %</div>
            <div style="font-size:12px;color:#777">CTR</div>
          </td>
        </tr>
      </table>
      <p style="font-size:13px;color:#777">Retrouvez le détail par campagne et par bannière dans votre espace annonceur.</p>`;

    const html = emailLayout(`Vos campagnes — ${period}`, body, {
      label: "Voir mes statistiques",
      url: `${SITE_URL}/espace-annonceur`,
    });

    const ok = await sendEmail({ to: p.email, subject: `Abidjan4All — récapitulatif de vos campagnes (${period})`, html });

    // Relevé enregistré dans tous les cas : borne le mois et évite les doublons,
    // même si l'e-mail n'a pas pu partir (SMTP indisponible).
    await prisma.adReportLog
      .create({ data: { advertiserUserId: p.id, period, impressions: curImp, clicks: curClk } })
      .catch(() => {});

    if (ok) envoyes++;
  }

  return { envoyes, ignores };
}
