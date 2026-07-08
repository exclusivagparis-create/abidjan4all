import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@a4a/db";
import { formatXOF, planById } from "@a4a/payments";
import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import { formatDateFull } from "@/lib/format";

export const dynamic = "force-dynamic";

const INK = rgb(0.09, 0.1, 0.12);
const MUTED = rgb(0.45, 0.47, 0.52);
const RED = rgb(0.84, 0.16, 0.18);
const LINE = rgb(0.88, 0.89, 0.91);

/** pdf-lib (WinAnsi) ne couvre pas l'espace fine insécable de formatXOF. */
function pdfSafe(text: string): string {
  return text.replace(/[  ]/g, " ");
}

// GET /invoices/:number.pdf — facture générée à la volée (Invoice.url du seed).
// Réservée au titulaire de l'abonnement facturé, ou à un admin.
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("unauthorized", "Authentification requise.", 401);

  const { file } = await params;
  const number = decodeURIComponent(file).replace(/\.pdf$/i, "");

  const invoice = await prisma.invoice.findUnique({
    where: { number },
    include: {
      payment: {
        include: { subscription: { include: { user: { select: { id: true, name: true, email: true } } } } },
      },
    },
  });
  if (!invoice) return apiError("not_found", "Facture introuvable.", 404);

  const owner = invoice.payment.subscription.user;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } });
  if (!me || (me.id !== owner.id && me.role !== "admin")) {
    return apiError("forbidden", "Cette facture ne vous appartient pas.", 403);
  }

  const payment = invoice.payment;
  const plan = planById(payment.subscription.plan);

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 portrait
  const serif = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  const left = 56;
  let y = height - 72;

  // En-tête
  page.drawText("Abidjan4All", { x: left, y, size: 26, font: serif, color: INK });
  page.drawText("FACTURE", { x: 440, y: y + 2, size: 16, font: sansBold, color: RED });
  y -= 18;
  page.drawText("Média numérique de la Côte d'Ivoire et de la diaspora — Exclusiv'AG", {
    x: left, y, size: 9, font: sans, color: MUTED,
  });
  y -= 34;
  page.drawLine({ start: { x: left, y }, end: { x: 539, y }, thickness: 2, color: INK });
  y -= 28;

  // Références
  const meta: Array<[string, string]> = [
    ["Facture n°", invoice.number],
    ["Émise le", formatDateFull(invoice.issuedAt)],
    ["Référence paiement", payment.providerRef],
    ["Client", `${owner.name} — ${owner.email}`],
  ];
  for (const [label, value] of meta) {
    page.drawText(label, { x: left, y, size: 10, font: sansBold, color: MUTED });
    page.drawText(pdfSafe(value), { x: left + 130, y, size: 10, font: sans, color: INK });
    y -= 17;
  }
  y -= 22;

  // Ligne de facturation
  page.drawText("DÉSIGNATION", { x: left, y, size: 8.5, font: sansBold, color: MUTED });
  page.drawText("MONTANT", { x: 460, y, size: 8.5, font: sansBold, color: MUTED });
  y -= 8;
  page.drawLine({ start: { x: left, y }, end: { x: 539, y }, thickness: 0.8, color: LINE });
  y -= 20;
  page.drawText(pdfSafe(`Abonnement A4A+ ${plan?.name ?? payment.subscription.plan} — 1 mois`), {
    x: left, y, size: 11, font: sans, color: INK,
  });
  page.drawText(pdfSafe(formatXOF(payment.amount)), { x: 460, y, size: 11, font: sansBold, color: INK });
  y -= 14;
  page.drawText(`Paiement ${payment.provider} — ${payment.status === "succeeded" ? "réglé" : payment.status}`, {
    x: left, y, size: 9, font: sans, color: MUTED,
  });
  y -= 12;
  page.drawLine({ start: { x: left, y }, end: { x: 539, y }, thickness: 0.8, color: LINE });
  y -= 24;
  page.drawText("TOTAL TTC", { x: 360, y, size: 11, font: sansBold, color: INK });
  page.drawText(pdfSafe(formatXOF(payment.amount)), { x: 460, y, size: 13, font: sansBold, color: RED });

  // Pied de page
  page.drawText("Exclusiv'AG — Directeur de publication : M. Aka Aka Georges · abidjan4all.net", {
    x: left, y: 64, size: 8, font: sans, color: MUTED,
  });
  page.drawText("TVA non applicable en l'état — facture générée électroniquement, valable sans signature.", {
    x: left, y: 52, size: 8, font: sans, color: MUTED,
  });

  const bytes = await doc.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
