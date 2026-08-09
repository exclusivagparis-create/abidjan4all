"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { segmentsValides } from "@/lib/newsletter-segments";

/**
 * Gestion du catalogue des newsletters (créer, modifier, supprimer) et de
 * leurs inscrits (ajout et retrait à la main par la rédaction).
 */

async function requirePublisher() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/newsletters");
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
      .slice(0, 60) || "newsletter"
  );
}

async function slugLibre(base: string): Promise<string> {
  const s = slugify(base);
  for (let i = 0; ; i++) {
    const candidat = i === 0 ? s : `${s}-${i + 1}`;
    const existe = await prisma.newsletter.findUnique({ where: { slug: candidat }, select: { id: true } });
    if (!existe) return candidat;
  }
}

function parseForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const cadence = String(formData.get("cadence") ?? "").trim().slice(0, 40) || "hebdomadaire";
  const description = String(formData.get("description") ?? "").trim().slice(0, 400);
  return { valid: name.length >= 2, data: { name, cadence, description } };
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export async function createNewsletterAction(formData: FormData): Promise<void> {
  await requirePublisher();
  const { valid, data } = parseForm(formData);
  if (!valid) redirect("/admin/newsletters?erreur=lettre");

  await prisma.newsletter.create({ data: { ...data, slug: await slugLibre(data.name) } });
  revalidatePath("/admin/newsletters");
  revalidatePath("/espace-membre");
  redirect("/admin/newsletters?lettre=creee");
}

/** Modifie le libellé, la cadence et la description. Le slug est verrouillé. */
export async function updateNewsletterAction(id: string, formData: FormData): Promise<void> {
  await requirePublisher();
  const { valid, data } = parseForm(formData);
  if (!valid) redirect("/admin/newsletters?erreur=lettre");

  await prisma.newsletter.update({ where: { id }, data }).catch(() => {});
  revalidatePath("/admin/newsletters");
  revalidatePath("/espace-membre");
  redirect("/admin/newsletters?lettre=modifiee");
}

/**
 * Supprime une newsletter. Refusé tant qu'elle a des inscrits : une liste
 * d'audience se transfère ou se vide sciemment, elle ne disparaît pas d'un
 * clic. Les éditions, elles, suivent en cascade.
 */
export async function deleteNewsletterAction(id: string): Promise<void> {
  await requirePublisher();
  const inscrits = await prisma.newsletterSubscription.count({ where: { newsletterId: id } });
  if (inscrits > 0) redirect("/admin/newsletters?erreur=inscrits");

  await prisma.newsletter.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/newsletters");
  revalidatePath("/espace-membre");
  redirect("/admin/newsletters?lettre=supprimee");
}

// ---------------------------------------------------------------------------
// Inscrits
// ---------------------------------------------------------------------------

/**
 * Ajoute une adresse à une newsletter (inscription hors ligne, salon,
 * demande par téléphone). Rattache le compte si l'adresse en a un.
 */
export async function ajouterInscritAction(newsletterId: string, formData: FormData): Promise<void> {
  await requirePublisher();
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/admin/newsletters?erreur=email");

  const segments = segmentsValides(formData.getAll("segments").map((s) => String(s)));
  const compte = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  const deja = await prisma.newsletterSubscription.findUnique({
    where: { newsletterId_email: { newsletterId, email } },
    select: { id: true },
  });
  if (deja) {
    // Déjà là : on remet l'inscription active et on prend les segments.
    await prisma.newsletterSubscription.update({
      where: { id: deja.id },
      data: { confirmed: true, segments, userId: compte?.id ?? undefined },
    });
  } else {
    await prisma.$transaction([
      prisma.newsletterSubscription.create({
        data: { newsletterId, email, confirmed: true, segments, userId: compte?.id ?? null },
      }),
      prisma.newsletter.update({ where: { id: newsletterId }, data: { subscribersCount: { increment: 1 } } }),
    ]);
  }

  revalidatePath("/admin/newsletters");
  redirect("/admin/newsletters?inscrit=ok");
}

/** Retire une inscription (désinscription à la demande, adresse erronée). */
export async function retirerInscritAction(subscriptionId: string): Promise<void> {
  await requirePublisher();
  const sub = await prisma.newsletterSubscription
    .delete({ where: { id: subscriptionId }, select: { newsletterId: true } })
    .catch(() => null);
  if (sub) {
    await prisma.newsletter
      .update({ where: { id: sub.newsletterId }, data: { subscribersCount: { decrement: 1 } } })
      .catch(() => {});
    revalidatePath("/admin/newsletters");
  }
}

// ---------------------------------------------------------------------------
// Choix du membre (espace membre)
// ---------------------------------------------------------------------------

/**
 * Le membre choisit lui-même les newsletters qu'il reçoit et, pour chacune,
 * ses centres d'intérêt. Les cases décochées valent désinscription.
 */
export async function choisirMesNewslettersAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/espace-membre");
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true },
  });
  if (!me) redirect("/login?next=/espace-membre");

  const voulues = new Set(formData.getAll("newsletters").map((s) => String(s)));
  const segments = segmentsValides(formData.getAll("segments").map((s) => String(s)));
  const toutes = await prisma.newsletter.findMany({ select: { id: true } });

  for (const nl of toutes) {
    const existante = await prisma.newsletterSubscription.findUnique({
      where: { newsletterId_email: { newsletterId: nl.id, email: me.email } },
      select: { id: true },
    });

    if (voulues.has(nl.id)) {
      if (existante) {
        await prisma.newsletterSubscription.update({
          where: { id: existante.id },
          data: { confirmed: true, segments, userId: me.id },
        });
      } else {
        await prisma.$transaction([
          prisma.newsletterSubscription.create({
            data: { newsletterId: nl.id, email: me.email, confirmed: true, segments, userId: me.id },
          }),
          prisma.newsletter.update({ where: { id: nl.id }, data: { subscribersCount: { increment: 1 } } }),
        ]);
      }
    } else if (existante) {
      await prisma.$transaction([
        prisma.newsletterSubscription.delete({ where: { id: existante.id } }),
        prisma.newsletter.update({ where: { id: nl.id }, data: { subscribersCount: { decrement: 1 } } }),
      ]);
    }
  }

  revalidatePath("/espace-membre");
  revalidatePath("/admin/newsletters");
  redirect("/espace-membre?newsletters=ok");
}
