"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { segmentsValides } from "@/lib/newsletter-segments";
import { lireAdresses, TAILLE_MAX_OCTETS, type LectureAdresses } from "@/lib/newsletter-import";

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

/** Ce qu'a produit une injection d'adresses, pour le rendre compte à l'écran. */
interface BilanInjection {
  /** Inscriptions créées. */
  ajoutes: number;
  /** Adresses déjà présentes sur cette lettre — réinscrites si elles étaient éteintes. */
  existants: number;
  /** Adresses de l'apport qui correspondent à un compte existant. */
  rattaches: number;
}

/**
 * Coeur commun de l'ajout d'inscrits, qu'il vienne d'une adresse tapée à la
 * main, d'une liste collée dans le champ ou d'un fichier plat.
 *
 * Tient en un nombre fixe de requêtes, quelle que soit la taille de l'apport :
 * une par adresse ferait des milliers d'allers-retours sur un fichier de
 * salon.
 *
 * Les adresses déjà inscrites ne sont pas dupliquées. On les réactive si elles
 * étaient désinscrites, mais **sans toucher à leurs centres d'intérêt** : la
 * personne les a peut-être choisis elle-même dans son espace membre, et un
 * ajout par la rédaction n'a pas à les effacer.
 */
async function injecterAdresses(
  newsletterId: string,
  adresses: string[],
  segments: string[]
): Promise<BilanInjection> {
  const [comptes, existantes] = await Promise.all([
    prisma.user.findMany({ where: { email: { in: adresses } }, select: { id: true, email: true } }),
    prisma.newsletterSubscription.findMany({
      where: { newsletterId, email: { in: adresses } },
      select: { email: true },
    }),
  ]);

  const compteParAdresse = new Map(comptes.map((c) => [c.email.toLowerCase(), c.id]));
  const dejaInscrites = new Set(existantes.map((s) => s.email.toLowerCase()));
  const nouvelles = adresses.filter((a) => !dejaInscrites.has(a));

  const cree = nouvelles.length
    ? await prisma.newsletterSubscription.createMany({
        data: nouvelles.map((email) => ({
          newsletterId,
          email,
          confirmed: true,
          segments,
          // Rattachement immédiat quand le compte existe déjà.
          userId: compteParAdresse.get(email) ?? null,
        })),
        skipDuplicates: true,
      })
    : { count: 0 };

  if (cree.count > 0) {
    await prisma.newsletter.update({
      where: { id: newsletterId },
      data: { subscribersCount: { increment: cree.count } },
    });
  }

  if (dejaInscrites.size > 0) {
    const connues = [...dejaInscrites];

    // Un ajout par la rédaction vaut réinscription pour une adresse éteinte.
    await prisma.newsletterSubscription.updateMany({
      where: { newsletterId, email: { in: connues }, confirmed: false },
      data: { confirmed: true },
    });

    // Inscriptions restées orphelines d'un apport antérieur : on les réunit à
    // leur compte. Une seule requête, sans boucle côté application.
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "NewsletterSubscription" AS s
      SET "userId" = u."id"
      FROM "User" AS u
      WHERE s."newsletterId" = ${newsletterId}
        AND s."userId" IS NULL
        AND s."email" = u."email"
        AND s."email" IN (${Prisma.join(connues)})
    `);
  }

  return { ajoutes: cree.count, existants: dejaInscrites.size, rattaches: compteParAdresse.size };
}

/** Construit la destination de retour : le bilan de l'apport, lisible à l'écran. */
function retourAvecBilan(bilan: BilanInjection, lecture: LectureAdresses): string {
  const params = new URLSearchParams({
    ajoutes: String(bilan.ajoutes),
    existants: String(bilan.existants),
    rattaches: String(bilan.rattaches),
  });
  if (lecture.nbInvalides > 0) params.set("invalides", String(lecture.nbInvalides));
  if (lecture.doublons > 0) params.set("doublons", String(lecture.doublons));
  if (lecture.tronque) params.set("tronque", "1");
  return `/admin/newsletters?${params.toString()}`;
}

/**
 * Ajoute une ou plusieurs adresses à une newsletter (inscription hors ligne,
 * salon, demande par téléphone). Le champ accepte une adresse seule ou une
 * liste séparée par des virgules — même lecture que le fichier plat.
 */
export async function ajouterInscritAction(newsletterId: string, formData: FormData): Promise<void> {
  await requirePublisher();

  const lecture = lireAdresses(String(formData.get("email") ?? ""));
  if (lecture.adresses.length === 0) redirect("/admin/newsletters?erreur=email");

  const segments = segmentsValides(formData.getAll("segments").map((s) => String(s)));
  const bilan = await injecterAdresses(newsletterId, lecture.adresses, segments);

  revalidatePath("/admin/newsletters");
  revalidatePath("/espace-membre");
  redirect(retourAvecBilan(bilan, lecture));
}

/**
 * Injecte en masse les adresses d'un fichier plat : texte ou CSV, UTF-8,
 * virgule entre les adresses. Disponible sur chaque newsletter.
 *
 * Le fichier est lu tel quel, sans colonne imposée : tout ce qui ressemble à
 * une adresse est retenu, le reste est écarté et rapporté. La rédaction n'a
 * donc pas à préparer ses fichiers.
 */
export async function importerInscritsAction(newsletterId: string, formData: FormData): Promise<void> {
  await requirePublisher();

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) redirect("/admin/newsletters?erreur=fichier");
  if (fichier.size > TAILLE_MAX_OCTETS) redirect("/admin/newsletters?erreur=taille");

  const lecture = lireAdresses(await fichier.text());
  if (lecture.adresses.length === 0) redirect("/admin/newsletters?erreur=aucune");

  const segments = segmentsValides(formData.getAll("segments").map((s) => String(s)));
  const bilan = await injecterAdresses(newsletterId, lecture.adresses, segments);

  revalidatePath("/admin/newsletters");
  revalidatePath("/espace-membre");
  redirect(retourAvecBilan(bilan, lecture));
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
