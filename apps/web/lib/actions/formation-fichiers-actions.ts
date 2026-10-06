"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { removeUpload, saveLessonDocument } from "@/lib/uploads";
import { FORMATS, ressourcesDe, type Ressource } from "@/lib/formation-ressources";

async function requirePublisher(courseId: string) {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    redirect(`/login?next=/admin/formation/${courseId}`);
  }
}

/** Joint un fichier à une leçon : support de cours, modèle, exercice. */
export async function addLessonResourceAction(lessonId: string, courseId: string, formData: FormData): Promise<void> {
  await requirePublisher(courseId);
  const retour = `/admin/formation/${courseId}`;

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) redirect(`${retour}?erreur=fichier`);

  const depot = await saveLessonDocument(fichier);
  if (!depot.ok) redirect(`${retour}?erreur=${encodeURIComponent(depot.error)}`);

  const lecon = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { resources: true } });
  if (!lecon) {
    // La leçon a disparu entre l'affichage et l'envoi : on ne laisse pas le
    // fichier orphelin sur le disque.
    await removeUpload(depot.url);
    redirect(retour);
  }

  // Nom affiché : celui saisi, ou à défaut celui du fichier déposé.
  const saisi = String(formData.get("nom") ?? "").trim().slice(0, 120);
  const ressource: Ressource = {
    url: depot.url,
    nom: saisi || fichier.name.replace(/\.[a-z0-9]{1,5}$/i, "").slice(0, 120) || "Document",
    label: FORMATS[fichier.type]?.label ?? "Fichier",
    taille: fichier.size,
  };

  await prisma.lesson.update({
    where: { id: lessonId },
    data: { resources: [...ressourcesDe(lecon.resources), ressource] },
  });

  revalidatePath(retour);
  revalidatePath("/formation");
  redirect(`${retour}?ok=fichier`);
}

/**
 * Retire un fichier d'une leçon, et l'efface du disque.
 *
 * Le fichier est désigné par son adresse et non par son rang : entre
 * l'affichage de la page et le clic, un autre rédacteur a pu en ajouter ou en
 * retirer un, et un rang supprimerait alors le mauvais.
 */
export async function removeLessonResourceAction(lessonId: string, courseId: string, url: string): Promise<void> {
  await requirePublisher(courseId);

  const lecon = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { resources: true } });
  if (lecon) {
    const restantes = ressourcesDe(lecon.resources).filter((r) => r.url !== url);
    await prisma.lesson.update({ where: { id: lessonId }, data: { resources: restantes } });
    await removeUpload(url);
  }

  revalidatePath(`/admin/formation/${courseId}`);
  revalidatePath("/formation");
  redirect(`/admin/formation/${courseId}?ok=retire`);
}
