"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { PUBLISH_ROLES } from "@/auth";
import { exigerRoleOuRediriger } from "@/lib/garde-role";
import { seuilValide } from "@/lib/qualite-editoriale";

async function requirePublish() {
  return exigerRoleOuRediriger(PUBLISH_ROLES, "/admin/qualite");
}

/**
 * Le sitemap est régénéré avec le reste : il déclare les pages indexées, donc
 * il change à chaque opération. L'oublier laisserait Google lire pendant une
 * heure une liste qui contredit les balises `robots` des pages elles-mêmes.
 */
function rafraichir() {
  revalidatePath("/admin/qualite");
  revalidatePath("/sitemap.xml");
}

/**
 * Retire de l'index tous les articles publiés dont la durée de lecture est
 * inférieure ou égale au seuil.
 *
 * `noindex: false` figure dans le FILTRE, pas seulement dans les données : on
 * ne touche qu'à ce qui change. Sans cela, un second clic réécrirait des
 * milliers de lignes pour rien et ferait bouger tous les `updatedAt`, donc
 * tout le sitemap.
 *
 * Jamais automatique : retirer des milliers de pages de l'index est un geste
 * éditorial, pris en voyant le compte exact à l'écran, et réversible par
 * `reindexerAuDessusAction`.
 */
export async function retirerBrevesAction(formData: FormData): Promise<void> {
  await requirePublish();
  const seuil = seuilValide(formData.get("seuil"));

  await prisma.article.updateMany({
    where: { status: "published", noindex: false, readingTime: { lte: seuil } },
    data: { noindex: true },
  });

  rafraichir();
}

/**
 * Remet à l'index les articles retirés qui sont AU-DESSUS du seuil.
 *
 * Sert à revenir en arrière après un seuil trop sévère : on relève le seuil,
 * puis on réindexe ce qui le dépasse désormais. Les articles encore sous le
 * seuil restent retirés — sans quoi ce bouton annulerait la règle au lieu de
 * la corriger, et il faudrait tout recommencer.
 */
export async function reindexerAuDessusAction(formData: FormData): Promise<void> {
  await requirePublish();
  const seuil = seuilValide(formData.get("seuil"));

  await prisma.article.updateMany({
    where: { status: "published", noindex: true, readingTime: { gt: seuil } },
    data: { noindex: false },
  });

  rafraichir();
}

/** Bascule un seul article, pour les décisions au cas par cas. */
export async function basculerNoindexAction(formData: FormData): Promise<void> {
  await requirePublish();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const article = await prisma.article.findUnique({ where: { id }, select: { id: true, noindex: true } });
  if (!article) return;

  await prisma.article.update({ where: { id }, data: { noindex: !article.noindex } });
  rafraichir();
}
