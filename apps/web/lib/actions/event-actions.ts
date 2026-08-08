"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type EventKind, type EventStatus } from "@a4a/db";
import type { PaymentMethodId } from "@a4a/payments";
import { auth, PUBLISH_ROLES } from "@/auth";
import { removeUpload, saveImageUpload } from "@/lib/uploads";
import { startOrderCheckout } from "@/lib/order-billing";
import { genererCode, placesRestantes, placesRestantesTicket } from "@/lib/events";

const KINDS: EventKind[] = ["forum", "awards", "webinaire", "conference"];
const STATUTS: EventStatus[] = ["draft", "published", "ended", "cancelled"];
const METHODS: PaymentMethodId[] = ["momo", "orange", "wave", "moov", "djamo", "card", "paypal"];

async function requirePublish() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/evenements");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } });
  if (!me || !PUBLISH_ROLES.includes(me.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");
  return me;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "evenement"
  );
}

async function slugLibre(base: string): Promise<string> {
  const s = slugify(base);
  for (let i = 0; ; i++) {
    const candidat = i === 0 ? s : `${s}-${i + 1}`;
    const existe = await prisma.event.findUnique({ where: { slug: candidat }, select: { id: true } });
    if (!existe) return candidat;
  }
}

// ---------------------------------------------------------------------------
// Inscription du public
// ---------------------------------------------------------------------------

/**
 * Inscription à un événement. Billet gratuit : confirmée aussitôt. Billet
 * payant : inscription « en attente » puis passage au paiement — elle est
 * confirmée par le fulfillment, et annulée (place libérée) si le paiement
 * n'aboutit pas.
 */
export async function inscrireEventAction(ticketId: string, formData: FormData): Promise<void> {
  const session = await auth();
  const billet = await prisma.eventTicket.findUnique({ where: { id: ticketId }, include: { event: true } });
  if (!billet) redirect("/evenements");
  const slug = billet.event.slug;
  if (!session?.user) redirect(`/login?next=/evenements/${slug}`);

  if (billet.event.status !== "published" || !billet.actif) redirect(`/evenements/${slug}?echec=ferme`);
  if (billet.event.startAt < new Date()) redirect(`/evenements/${slug}?echec=passe`);

  // Une seule inscription par personne et par événement.
  const deja = await prisma.eventRegistration.findUnique({
    where: { eventId_userId: { eventId: billet.eventId, userId: session.user.id } },
    select: { status: true },
  });
  if (deja && deja.status !== "cancelled") redirect(`/evenements/${slug}?echec=deja`);

  // Jauges : celle de l'événement et celle, éventuelle, de la catégorie.
  const [restantes, restantesBillet] = await Promise.all([
    placesRestantes(billet.eventId, billet.event.capacite),
    placesRestantesTicket(billet.id, billet.quota),
  ]);
  if (restantes === 0 || restantesBillet === 0) redirect(`/evenements/${slug}?echec=complet`);

  const code = await genererCode();
  const gratuit = billet.prix <= 0;

  // Une inscription annulée est réutilisée : la contrainte d'unicité
  // (eventId, userId) interdit d'en créer une seconde.
  const inscription = deja
    ? await prisma.eventRegistration.update({
        where: { eventId_userId: { eventId: billet.eventId, userId: session.user.id } },
        data: { ticketId: billet.id, status: gratuit ? "confirmed" : "pending", code, orderId: null },
      })
    : await prisma.eventRegistration.create({
        data: {
          eventId: billet.eventId,
          ticketId: billet.id,
          userId: session.user.id,
          status: gratuit ? "confirmed" : "pending",
          code,
        },
      });

  if (gratuit) {
    revalidatePath(`/evenements/${slug}`);
    redirect(`/evenements/${slug}?inscrit=1`);
  }

  const method = String(formData.get("method") ?? "") as PaymentMethodId;
  if (!METHODS.includes(method)) redirect(`/evenements/${slug}?echec=saisie`);

  const result = await startOrderCheckout({
    userId: session.user.id,
    email: session.user.email ?? "",
    kind: "event_ticket",
    tierId: billet.id,
    method,
  });
  if (!result.ok) {
    await prisma.eventRegistration.update({ where: { id: inscription.id }, data: { status: "cancelled" } });
    redirect(`/evenements/${slug}?indisponible=1`);
  }
  // Rattache la commande à l'inscription pour que le paiement la confirme.
  await prisma.eventRegistration.update({
    where: { id: inscription.id },
    data: { orderId: result.orderId },
  });
  redirect(result.checkoutUrl);
}

/** Annulation par l'inscrit lui-même (libère la place). */
export async function annulerMonInscriptionAction(registrationId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const insc = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    include: { event: { select: { slug: true } } },
  });
  if (!insc || insc.userId !== session.user.id) redirect("/espace-membre");

  await prisma.eventRegistration.update({ where: { id: registrationId }, data: { status: "cancelled" } });
  revalidatePath(`/evenements/${insc.event.slug}`);
  revalidatePath("/espace-membre");
  redirect("/espace-membre?inscription=annulee");
}

// ---------------------------------------------------------------------------
// Studio — événements
// ---------------------------------------------------------------------------

function parseEventForm(formData: FormData) {
  const kind = String(formData.get("kind") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const pitch = String(formData.get("pitch") ?? "").trim().slice(0, 300);
  const description = String(formData.get("description") ?? "").trim().slice(0, 4000);
  const enLigne = String(formData.get("enLigne") ?? "") === "1";
  const lieu = String(formData.get("lieu") ?? "").trim().slice(0, 160) || null;
  const ville = String(formData.get("ville") ?? "").trim().slice(0, 80) || null;
  const accessUrl = String(formData.get("accessUrl") ?? "").trim() || null;
  const capaciteRaw = String(formData.get("capacite") ?? "").trim();
  const capacite = capaciteRaw ? Number(capaciteRaw) : null;

  const startAt = new Date(String(formData.get("startAt") ?? ""));
  const endRaw = String(formData.get("endAt") ?? "").trim();
  const endAt = endRaw ? new Date(endRaw) : null;

  const valid =
    KINDS.includes(kind as EventKind) &&
    !!title &&
    !!pitch &&
    !Number.isNaN(startAt.getTime()) &&
    (endAt === null || (!Number.isNaN(endAt.getTime()) && endAt >= startAt)) &&
    (capacite === null || (Number.isInteger(capacite) && capacite > 0)) &&
    (!accessUrl || /^https?:\/\//.test(accessUrl));

  return {
    valid,
    data: { kind: kind as EventKind, title, pitch, description, enLigne, lieu, ville, accessUrl, capacite, startAt, endAt },
  };
}

export async function createEventAction(formData: FormData): Promise<void> {
  await requirePublish();
  const { valid, data } = parseEventForm(formData);
  if (!valid) redirect("/admin/evenements?erreur=1");

  const ev = await prisma.event.create({ data: { ...data, slug: await slugLibre(data.title) } });
  revalidatePath("/admin/evenements");
  revalidatePath("/evenements");
  redirect(`/admin/evenements/${ev.id}`);
}

export async function updateEventAction(id: string, formData: FormData): Promise<void> {
  await requirePublish();
  const { valid, data } = parseEventForm(formData);
  if (!valid) redirect(`/admin/evenements/${id}?erreur=1`);

  let coverUrl: string | undefined;
  const file = formData.get("cover");
  if (file instanceof File && file.size > 0) {
    const up = await saveImageUpload(file);
    if (!up.ok) redirect(`/admin/evenements/${id}?erreur=image`);
    const actuel = await prisma.event.findUnique({ where: { id }, select: { coverUrl: true } });
    await removeUpload(actuel?.coverUrl);
    coverUrl = up.url;
  }

  await prisma.event.update({ where: { id }, data: { ...data, ...(coverUrl ? { coverUrl } : {}) } });
  revalidatePath("/admin/evenements");
  revalidatePath(`/admin/evenements/${id}`);
  revalidatePath("/evenements");
  redirect(`/admin/evenements/${id}`);
}

export async function setEventStatusAction(id: string, formData: FormData): Promise<void> {
  await requirePublish();
  const status = String(formData.get("status") ?? "") as EventStatus;
  if (!STATUTS.includes(status)) return;
  await prisma.event.update({ where: { id }, data: { status } }).catch(() => {});
  revalidatePath("/admin/evenements");
  revalidatePath(`/admin/evenements/${id}`);
  revalidatePath("/evenements");
}

/** Supprime un événement. Refusé s'il a des inscrits (billets déjà vendus). */
export async function deleteEventAction(id: string): Promise<void> {
  await requirePublish();
  const inscrits = await prisma.eventRegistration.count({
    where: { eventId: id, status: { in: ["pending", "confirmed"] } },
  });
  if (inscrits > 0) redirect(`/admin/evenements/${id}?erreur=inscrits`);

  const ev = await prisma.event.findUnique({ where: { id }, select: { coverUrl: true } });
  const sponsors = await prisma.eventSponsor.findMany({ where: { eventId: id }, select: { logoUrl: true } });
  await Promise.all([removeUpload(ev?.coverUrl), ...sponsors.map((s) => removeUpload(s.logoUrl))]);
  await prisma.event.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/evenements");
  revalidatePath("/evenements");
  redirect("/admin/evenements");
}

// ---------------------------------------------------------------------------
// Studio — catégories de billets
// ---------------------------------------------------------------------------

function parseTicketForm(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim().slice(0, 80);
  const description = String(formData.get("description") ?? "").trim().slice(0, 300);
  const prix = Number(formData.get("prix"));
  const quotaRaw = String(formData.get("quota") ?? "").trim();
  const quota = quotaRaw ? Number(quotaRaw) : null;
  const ordre = Number(formData.get("ordre"));

  const valid =
    !!label &&
    Number.isInteger(prix) &&
    prix >= 0 && // 0 = billet gratuit (webinaires, invitations)
    (quota === null || (Number.isInteger(quota) && quota > 0));

  return { valid, data: { label, description, prix, quota, ordre: Number.isInteger(ordre) ? ordre : 0 } };
}

export async function createTicketAction(eventId: string, formData: FormData): Promise<void> {
  await requirePublish();
  const { valid, data } = parseTicketForm(formData);
  if (!valid) redirect(`/admin/evenements/${eventId}?erreur=billet`);
  await prisma.eventTicket.create({ data: { ...data, eventId } });
  revalidatePath(`/admin/evenements/${eventId}`);
  redirect(`/admin/evenements/${eventId}`);
}

export async function updateTicketAction(ticketId: string, formData: FormData): Promise<void> {
  await requirePublish();
  const current = await prisma.eventTicket.findUnique({ where: { id: ticketId }, select: { eventId: true } });
  if (!current) redirect("/admin/evenements");
  const { valid, data } = parseTicketForm(formData);
  if (!valid) redirect(`/admin/evenements/${current.eventId}?erreur=billet`);
  await prisma.eventTicket.update({ where: { id: ticketId }, data });
  revalidatePath(`/admin/evenements/${current.eventId}`);
  redirect(`/admin/evenements/${current.eventId}`);
}

/** Ouvre / ferme une catégorie à la vente (sans toucher aux inscrits). */
export async function setTicketActifAction(ticketId: string, formData: FormData): Promise<void> {
  await requirePublish();
  const actif = String(formData.get("actif") ?? "") === "1";
  const t = await prisma.eventTicket
    .update({ where: { id: ticketId }, data: { actif }, select: { eventId: true } })
    .catch(() => null);
  if (t) revalidatePath(`/admin/evenements/${t.eventId}`);
}

/** Supprime une catégorie. Refusé si des inscriptions s'y rattachent. */
export async function deleteTicketAction(ticketId: string): Promise<void> {
  await requirePublish();
  const t = await prisma.eventTicket.findUnique({ where: { id: ticketId }, select: { eventId: true } });
  if (!t) return;
  const inscrits = await prisma.eventRegistration.count({ where: { ticketId } });
  if (inscrits > 0) redirect(`/admin/evenements/${t.eventId}?erreur=billet-utilise`);
  await prisma.eventTicket.delete({ where: { id: ticketId } }).catch(() => {});
  revalidatePath(`/admin/evenements/${t.eventId}`);
}

// ---------------------------------------------------------------------------
// Studio — sponsors et inscrits
// ---------------------------------------------------------------------------

export async function createSponsorAction(eventId: string, formData: FormData): Promise<void> {
  await requirePublish();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const niveau = String(formData.get("niveau") ?? "").trim().slice(0, 60) || "Partenaire";
  const linkUrl = String(formData.get("linkUrl") ?? "").trim() || null;
  const ordre = Number(formData.get("ordre"));
  if (!name || (linkUrl && !/^https?:\/\//.test(linkUrl))) redirect(`/admin/evenements/${eventId}?erreur=sponsor`);

  let logoUrl: string | null = null;
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    const up = await saveImageUpload(file);
    if (!up.ok) redirect(`/admin/evenements/${eventId}?erreur=image`);
    logoUrl = up.url;
  }

  await prisma.eventSponsor.create({
    data: { eventId, name, niveau, linkUrl, logoUrl, ordre: Number.isInteger(ordre) ? ordre : 0 },
  });
  revalidatePath(`/admin/evenements/${eventId}`);
  revalidatePath("/evenements");
  redirect(`/admin/evenements/${eventId}`);
}

export async function deleteSponsorAction(sponsorId: string): Promise<void> {
  await requirePublish();
  const s = await prisma.eventSponsor.findUnique({ where: { id: sponsorId }, select: { eventId: true, logoUrl: true } });
  if (!s) return;
  await removeUpload(s.logoUrl);
  await prisma.eventSponsor.delete({ where: { id: sponsorId } }).catch(() => {});
  revalidatePath(`/admin/evenements/${s.eventId}`);
}

/** Pointage à l'accueil : confirme une inscription restée en attente. */
export async function confirmerInscriptionAction(registrationId: string): Promise<void> {
  await requirePublish();
  const r = await prisma.eventRegistration
    .update({ where: { id: registrationId }, data: { status: "confirmed" }, select: { eventId: true } })
    .catch(() => null);
  if (r) revalidatePath(`/admin/evenements/${r.eventId}`);
}

/** Annule une inscription depuis le Studio (désistement, no-show payé). */
export async function annulerInscriptionAction(registrationId: string): Promise<void> {
  await requirePublish();
  const r = await prisma.eventRegistration
    .update({ where: { id: registrationId }, data: { status: "cancelled" }, select: { eventId: true } })
    .catch(() => null);
  if (r) revalidatePath(`/admin/evenements/${r.eventId}`);
}
