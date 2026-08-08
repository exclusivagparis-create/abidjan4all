"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type BrandLeadStatus } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { sendEmail, emailConfigured } from "@/lib/email";
import { formatFCFA } from "@/lib/tarifs";

const STATUTS: BrandLeadStatus[] = ["nouveau", "en_cours", "gagne", "perdu"];

/** Régie ou rédaction en chef : le brand content est un sujet commercial. */
async function requireRegieOuPublication() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/brand-content");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } });
  const autorises = [...PUBLISH_ROLES, "ad_manager"] as string[];
  if (!me || !autorises.includes(me.role)) redirect("/admin");
  return me;
}

// ---------------------------------------------------------------------------
// Demandes des annonceurs (formulaire public)
// ---------------------------------------------------------------------------

export type BrandLeadResult = { ok: true } | { ok: false; error: string };

/**
 * Demande de devis sur une offre de brand content. Formulaire public : pot de
 * miel contre les robots, aucune énumération possible (la réponse ne dit
 * jamais si l'offre existe).
 */
export async function demanderDevisAction(
  _prev: BrandLeadResult | undefined,
  formData: FormData
): Promise<BrandLeadResult> {
  // Pot de miel : rempli = robot. On répond « ok » sans rien enregistrer.
  if (String(formData.get("website") ?? "").trim()) return { ok: true };

  const societe = String(formData.get("societe") ?? "").trim().slice(0, 120);
  const contact = String(formData.get("contact") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  const tel = String(formData.get("tel") ?? "").trim().slice(0, 40) || null;
  const message = String(formData.get("message") ?? "").trim().slice(0, 2000);
  const offerId = String(formData.get("offerId") ?? "").trim() || null;

  if (!societe || !contact || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !message) {
    return { ok: false, error: "Renseignez la société, le contact, un e-mail valide et votre besoin." };
  }

  const offre = offerId
    ? await prisma.brandOffer.findUnique({ where: { id: offerId }, select: { id: true, title: true, prix: true, unite: true } })
    : null;

  await prisma.brandLead.create({
    data: { offerId: offre?.id ?? null, societe, contact, email, tel, message },
  });

  // Notification à la régie — best effort, un échec d'e-mail ne doit pas
  // faire perdre la demande (elle est déjà enregistrée).
  if (emailConfigured) {
    const destinataires = [process.env.SMTP_USER, process.env.CONTACT_TO ?? "contact@abidjan4all.info"]
      .filter((a): a is string => Boolean(a))
      .filter((a, i, t) => t.indexOf(a) === i);
    const tarif = offre ? (offre.prix > 0 ? ` (${formatFCFA(offre.prix)} ${offre.unite})` : " (sur devis)") : "";
    sendEmail({
      to: destinataires.join(", "),
      replyTo: email,
      subject: `Demande brand content — ${societe}`,
      html: `<p><b>${societe}</b> — ${contact} (${email}${tel ? `, ${tel}` : ""})</p><p>Offre : ${offre?.title ?? "non précisée"}${tarif}</p><p>${message.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`,
      text: `${societe} — ${contact} (${email}${tel ? `, ${tel}` : ""})\nOffre : ${offre?.title ?? "non précisée"}${tarif}\n\n${message}`,
    }).catch(() => {});
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Studio — catalogue des offres
// ---------------------------------------------------------------------------

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "offre"
  );
}

async function slugLibre(base: string): Promise<string> {
  const s = slugify(base);
  for (let i = 0; ; i++) {
    const candidat = i === 0 ? s : `${s}-${i + 1}`;
    const existe = await prisma.brandOffer.findUnique({ where: { slug: candidat }, select: { id: true } });
    if (!existe) return candidat;
  }
}

function parseOfferForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim().slice(0, 140);
  const pitch = String(formData.get("pitch") ?? "").trim().slice(0, 300);
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000);
  const prix = Number(formData.get("prix"));
  const unite = String(formData.get("unite") ?? "").trim().slice(0, 60) || "la prestation";
  const ordre = Number(formData.get("ordre"));
  // Une ligne = un livrable ; les lignes vides sont ignorées.
  const livrables = String(formData.get("livrables") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12);

  const valid = !!title && !!pitch && Number.isInteger(prix) && prix >= 0;
  return {
    valid,
    data: { title, pitch, description, prix, unite, livrables, ordre: Number.isInteger(ordre) ? ordre : 0 },
  };
}

export async function createOfferAction(formData: FormData): Promise<void> {
  await requireRegieOuPublication();
  const { valid, data } = parseOfferForm(formData);
  if (!valid) redirect("/admin/brand-content?erreur=1");
  await prisma.brandOffer.create({ data: { ...data, slug: await slugLibre(data.title) } });
  revalidatePath("/admin/brand-content");
  revalidatePath("/publicite/brand-content");
  redirect("/admin/brand-content");
}

export async function updateOfferAction(id: string, formData: FormData): Promise<void> {
  await requireRegieOuPublication();
  const { valid, data } = parseOfferForm(formData);
  if (!valid) redirect("/admin/brand-content?erreur=1");
  await prisma.brandOffer.update({ where: { id }, data }).catch(() => {});
  revalidatePath("/admin/brand-content");
  revalidatePath("/publicite/brand-content");
  redirect("/admin/brand-content");
}

export async function setOfferActiveAction(id: string, formData: FormData): Promise<void> {
  await requireRegieOuPublication();
  const actif = String(formData.get("actif") ?? "") === "1";
  await prisma.brandOffer.update({ where: { id }, data: { actif } }).catch(() => {});
  revalidatePath("/admin/brand-content");
  revalidatePath("/publicite/brand-content");
}

export async function deleteOfferAction(id: string): Promise<void> {
  await requireRegieOuPublication();
  // Les demandes reçues sont conservées (offerId passe à null) : l'historique
  // commercial ne doit pas disparaître avec une ligne de catalogue.
  await prisma.brandOffer.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/brand-content");
  revalidatePath("/publicite/brand-content");
  redirect("/admin/brand-content");
}

// ---------------------------------------------------------------------------
// Studio — pipeline commercial
// ---------------------------------------------------------------------------

export async function setLeadStatusAction(id: string, formData: FormData): Promise<void> {
  await requireRegieOuPublication();
  const status = String(formData.get("status") ?? "") as BrandLeadStatus;
  if (!STATUTS.includes(status)) return;
  await prisma.brandLead.update({ where: { id }, data: { status } }).catch(() => {});
  revalidatePath("/admin/brand-content");
}

export async function setLeadNoteAction(id: string, formData: FormData): Promise<void> {
  await requireRegieOuPublication();
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000) || null;
  await prisma.brandLead.update({ where: { id }, data: { note } }).catch(() => {});
  revalidatePath("/admin/brand-content");
}

export async function deleteLeadAction(id: string): Promise<void> {
  await requireRegieOuPublication();
  await prisma.brandLead.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/brand-content");
}
