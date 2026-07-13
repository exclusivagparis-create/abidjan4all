import nodemailer from "nodemailer";

/**
 * Envoi d'e-mails transactionnels via SMTP (IONOS en production). Comme la
 * couche IA sans clé, tout est neutralisé si le SMTP n'est pas configuré :
 * le site fonctionne, aucun envoi, un avertissement dans les logs.
 *
 * Variables : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 */
const HOST = process.env.SMTP_HOST;
const PORT = Number(process.env.SMTP_PORT ?? 465);
const USER = process.env.SMTP_USER;
const PASS = process.env.SMTP_PASS;
const FROM = process.env.SMTP_FROM ?? (USER ? `Abidjan4All <${USER}>` : undefined);

export const emailConfigured = Boolean(HOST && USER && PASS);

let transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter | null {
  if (!emailConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: PORT === 465, // 465 = TLS implicite ; 587 = STARTTLS
      auth: { user: USER, pass: PASS },
    });
  }
  return transporter;
}

/** Envoie un e-mail ; renvoie false (sans lever) si SMTP non configuré ou échec. */
export async function sendEmail(opts: { to: string; subject: string; html: string; text?: string }): Promise<boolean> {
  const tx = getTransporter();
  if (!tx) {
    console.warn(`[email] SMTP non configuré — e-mail « ${opts.subject} » vers ${opts.to} non envoyé.`);
    return false;
  }
  try {
    await tx.sendMail({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
    return true;
  } catch (e) {
    console.error("[email] échec d'envoi :", e);
    return false;
  }
}

/** Gabarit sobre aux couleurs A4A pour les e-mails transactionnels. */
export function emailLayout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f5f0e8;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e0d8cc">
          <tr><td style="background:#1a1a1a;padding:18px 28px">
            <span style="font-size:20px;font-weight:700;color:#fff">ABIDJAN<span style="color:#F47920">4</span>ALL</span>
          </td></tr>
          <tr><td style="padding:28px">
            <h1 style="margin:0 0 14px;font-size:20px;color:#1a1a1a">${title}</h1>
            <div style="font-size:15px;line-height:1.6;color:#333">${bodyHtml}</div>
            ${
              cta
                ? `<div style="margin:26px 0 8px"><a href="${cta.url}" style="display:inline-block;background:#a01520;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700;font-size:14px">${cta.label}</a></div>`
                : ""
            }
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid #e0d8cc;font-size:12px;color:#999">
            Abidjan4All · Exclusiv'AG — média numérique de la Côte d'Ivoire et de la diaspora<br/>
            Cet e-mail vous a été envoyé automatiquement, merci de ne pas y répondre.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}
