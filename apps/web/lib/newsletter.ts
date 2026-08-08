import { createHmac, timingSafeEqual } from "node:crypto";
import { SITE_URL } from "@/lib/seo";
import { plainTitle } from "@/lib/format";

/** Jeton de désabonnement : HMAC(newsletterId:email) avec AUTH_SECRET. */
function unsubSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-secret";
}

export function unsubToken(newsletterId: string, email: string): string {
  return createHmac("sha256", unsubSecret()).update(`${newsletterId}:${email.toLowerCase()}`).digest("hex").slice(0, 32);
}

export function verifyUnsubToken(newsletterId: string, email: string, token: string): boolean {
  const expected = unsubToken(newsletterId, email);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubUrl(newsletterId: string, email: string): string {
  const p = new URLSearchParams({ nl: newsletterId, email, t: unsubToken(newsletterId, email) });
  return `${SITE_URL}/newsletter/desabonnement?${p.toString()}`;
}

type EditionArticle = {
  slug: string;
  title: string;
  dek: string | null;
  rubrique: { slug: string; name: string; color: string };
};

// Segments d'audience : définis à part (ce module importe `node:crypto`, que
// le formulaire d'inscription — composant client — ne peut pas empaqueter).
export { SEGMENTS, SEGMENT_IDS, segmentsValides, recoitEdition } from "@/lib/newsletter-segments";

/** Sponsor exclusif d'un envoi (Brand Content : 600 000 FCFA l'envoi). */
export type EditionSponsor = {
  name: string;
  baseline?: string | null;
  logoUrl?: string | null;
  linkUrl?: string | null;
};

/** Construit le HTML d'une édition : sponsor + intro + articles + pied. */
export function buildEditionHtml(params: {
  newsletterName: string;
  subject: string;
  introHtml: string;
  articles: EditionArticle[];
  unsubscribeUrl: string;
  sponsor?: EditionSponsor | null;
}): string {
  const { newsletterName, introHtml, articles, unsubscribeUrl, sponsor } = params;

  // Encart sponsor : annoncé explicitement (« vous est offert par »), placé en
  // tête pour justifier son prix mais visuellement détaché de l'éditorial.
  // Le logo est une URL absolue : un client mail ne résout pas « /uploads/… ».
  const logo = sponsor?.logoUrl
    ? sponsor.logoUrl.startsWith("http")
      ? sponsor.logoUrl
      : `${SITE_URL}${sponsor.logoUrl}`
    : null;
  const sponsorInner = sponsor
    ? `${
        logo
          ? `<img src="${logo}" alt="${escapeHtml(sponsor.name)}" style="max-height:38px;display:block;margin:0 auto 8px" />`
          : `<div style="font-size:16px;font-weight:700;color:#16181D;margin-bottom:6px">${escapeHtml(sponsor.name)}</div>`
      }${
        sponsor.baseline
          ? `<div style="font-size:13px;line-height:1.5;color:#444">${escapeHtml(sponsor.baseline)}</div>`
          : ""
      }`
    : "";
  const sponsorBlock = sponsor
    ? `<tr><td style="padding:18px 28px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0d8cc;border-radius:8px;background:#faf7f2">
          <tr><td style="padding:14px 18px;text-align:center">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#999;margin-bottom:8px">Cet envoi vous est offert par</div>
            ${sponsor.linkUrl ? `<a href="${sponsor.linkUrl}" style="text-decoration:none;color:#16181D">${sponsorInner}</a>` : sponsorInner}
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const cards = articles
    .map((a) => {
      const url = `${SITE_URL}/${a.rubrique.slug}/${a.slug}`;
      return `<tr><td style="padding:14px 0;border-bottom:1px solid #eee">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${a.rubrique.color}">${a.rubrique.name}</div>
        <a href="${url}" style="display:block;margin:4px 0 6px;font-family:Georgia,serif;font-size:18px;font-weight:700;color:#1a1a1a;text-decoration:none;line-height:1.3">${escapeHtml(plainTitle(a.title))}</a>
        ${a.dek ? `<div style="font-size:14px;color:#555;line-height:1.5">${escapeHtml(a.dek)}</div>` : ""}
        <a href="${url}" style="display:inline-block;margin-top:6px;font-size:13px;font-weight:700;color:#a01520;text-decoration:none">Lire l'article →</a>
      </td></tr>`;
    })
    .join("");

  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f5f0e8;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0"><tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e0d8cc">
        <tr><td style="background:#1a1a1a;padding:16px 28px">
          <span style="font-size:20px;font-weight:700;color:#fff">ABIDJAN<span style="color:#F47920">4</span>ALL</span>
          <span style="float:right;font-size:12px;color:#bbb;padding-top:6px">${escapeHtml(newsletterName)}</span>
        </td></tr>
        ${sponsorBlock}
        ${introHtml ? `<tr><td style="padding:24px 28px 6px;font-size:15px;line-height:1.6;color:#333">${introHtml}</td></tr>` : ""}
        <tr><td style="padding:8px 28px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table></td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e0d8cc;font-size:12px;color:#999;text-align:center">
          Abidjan4All · Exclusiv'AG — <a href="${SITE_URL}" style="color:#999">abidjan4all.info</a><br/>
          <a href="${unsubscribeUrl}" style="color:#999;text-decoration:underline">Se désabonner de cette newsletter</a>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
