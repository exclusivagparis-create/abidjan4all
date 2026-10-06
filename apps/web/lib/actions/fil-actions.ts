"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";

/**
 * Rubriques suivies par un membre.
 *
 * Elles servent à deux choses, et c'est volontaire : classer son fil, et
 * filtrer les alertes push. Un lecteur qui coche « Cacao & Marchés » attend la
 * même chose des deux côtés ; deux réglages séparés auraient surtout produit
 * deux réglages contradictoires.
 */
export async function updateInterestsAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/mon-fil");

  const choisies = formData.getAll("rubriques").map((v) => String(v));

  // On ne garde que des identifiants de rubriques existantes : une valeur
  // forgée dans le formulaire resterait sinon en base pour toujours.
  const connues = await prisma.rubrique.findMany({ where: { id: { in: choisies } }, select: { id: true } });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { interests: connues.map((r) => r.id) },
  });

  revalidatePath("/mon-fil");
  redirect("/mon-fil?ok=1");
}
