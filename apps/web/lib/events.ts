import { randomBytes } from "crypto";
import { prisma, type EventKind } from "@a4a/db";

/**
 * A4A Événements — pilier 7 du Business Model 2026-2031 (Forum Diaspora,
 * A4A Awards, webinaires). Billetterie par catégories ; les billets payants
 * réutilisent le flux de commande commun, les gratuits confirment aussitôt.
 */

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  forum: "Forum",
  awards: "Cérémonie / Awards",
  webinaire: "Webinaire",
  conference: "Conférence",
};

/** Code d'entrée lisible à l'accueil : « A4A-7K2M-9QD4 ». */
function nouveauCode(): string {
  // Alphabet sans I/O/0/1 : un code lu au téléphone ou recopié à la main ne
  // doit pas être ambigu.
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const tirage = randomBytes(8);
  const s = [...tirage].map((b) => A[b % A.length]).join("");
  return `A4A-${s.slice(0, 4)}-${s.slice(4, 8)}`;
}

/** Code d'entrée garanti unique (collision improbable mais gérée). */
export async function genererCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = nouveauCode();
    const pris = await prisma.eventRegistration.findUnique({ where: { code }, select: { id: true } });
    if (!pris) return code;
  }
  throw new Error("Impossible de générer un code d'entrée unique.");
}

/** Événements publiés, à venir en premier. */
export function listEventsPublies() {
  return prisma.event.findMany({
    where: { status: "published" },
    orderBy: { startAt: "asc" },
    include: { tickets: { where: { actif: true }, orderBy: { ordre: "asc" } } },
  });
}

/**
 * Places restantes d'un événement (null = jauge illimitée). Ne comptent que
 * les inscriptions non annulées — un billet abandonné en cours de paiement
 * libère sa place quand la commande échoue.
 */
export async function placesRestantes(eventId: string, capacite: number | null): Promise<number | null> {
  if (capacite === null) return null;
  const prises = await prisma.eventRegistration.count({
    where: { eventId, status: { in: ["pending", "confirmed"] } },
  });
  return Math.max(0, capacite - prises);
}

/** Places restantes d'une catégorie de billet (null = pas de quota propre). */
export async function placesRestantesTicket(ticketId: string, quota: number | null): Promise<number | null> {
  if (quota === null) return null;
  const prises = await prisma.eventRegistration.count({
    where: { ticketId, status: { in: ["pending", "confirmed"] } },
  });
  return Math.max(0, quota - prises);
}

/** Les inscriptions d'un compte, événements à venir en premier. */
export function mesInscriptions(userId: string) {
  return prisma.eventRegistration.findMany({
    where: { userId, status: { in: ["pending", "confirmed"] } },
    include: { event: true, ticket: true },
    orderBy: { event: { startAt: "asc" } },
  });
}

/** Confirme une inscription payée (appelée par le fulfillment de commande). */
export async function confirmerInscription(orderId: string) {
  await prisma.eventRegistration.updateMany({
    where: { orderId, status: "pending" },
    data: { status: "confirmed" },
  });
}

/** Annule l'inscription d'une commande abandonnée (libère la place). */
export async function annulerInscription(orderId: string) {
  await prisma.eventRegistration.updateMany({
    where: { orderId, status: "pending" },
    data: { status: "cancelled" },
  });
}
