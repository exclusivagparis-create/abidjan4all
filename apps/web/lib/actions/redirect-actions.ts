"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { PUBLISH_ROLES } from "@/auth";
import { exigerRole } from "@/lib/garde-role";
import { lireRedirections, TAILLE_MAX_OCTETS } from "@/lib/redirects-import";

async function requirePublisher() {
  const moi = await exigerRole(PUBLISH_ROLES);
  if (!moi) {
    redirect("/login?next=/admin/redirections");
  }
}

/**
 * Normalise un chemin source : "/ancienne-page.html" ou "/rubrique/article".
 *
 * Deux sections au plus : ce sont les seules adresses où le site consulte ces
 * règles — le repli de rubrique pour une section, la page d'article pour deux.
 * Au-delà, la règle serait enregistrée sans jamais être lue.
 */
function normalizeFrom(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!s.startsWith("/")) s = `/${s}`;
  const sections = s.slice(1).split("/").filter(Boolean);
  if (sections.length === 0 || sections.length > 2) return null;
  return s.slice(0, 200);
}

export async function createRedirectAction(formData: FormData): Promise<void> {
  await requirePublisher();
  const from = normalizeFrom(String(formData.get("from") ?? ""));
  const to = String(formData.get("to") ?? "").trim().slice(0, 300);

  if (!from) redirect("/admin/redirections?erreur=from");
  if (!to || (!to.startsWith("/") && !/^https?:\/\//.test(to))) redirect("/admin/redirections?erreur=to");
  if (from === to) redirect("/admin/redirections?erreur=boucle");
  if (await prisma.redirect.findUnique({ where: { from } })) redirect("/admin/redirections?erreur=doublon");

  await prisma.redirect.create({ data: { from, to } });
  revalidatePath("/admin/redirections");
  revalidatePath("/", "layout");
  redirect("/admin/redirections");
}

/**
 * Charge un lot de redirections depuis un fichier.
 *
 * Pensé pour la bascule de l'ancien site : des milliers d'adresses à faire
 * pointer vers leur article, qu'aucune rédaction ne saisira à la main.
 *
 * `skipDuplicates` plutôt qu'une erreur : un import rejoué après correction
 * d'une partie du fichier ne doit pas échouer sur les règles déjà passées. Le
 * bilan dit combien ont été ignorées à ce titre.
 */
export async function importRedirectsAction(formData: FormData): Promise<void> {
  await requirePublisher();

  const fichier = formData.get("fichier");
  const colle = String(formData.get("colle") ?? "").trim();

  let contenu = colle;
  if (fichier instanceof File && fichier.size > 0) {
    if (fichier.size > TAILLE_MAX_OCTETS) redirect("/admin/redirections?erreur=taille");
    contenu = await fichier.text();
  }
  if (!contenu) redirect("/admin/redirections?erreur=vide");

  const lecture = lireRedirections(contenu);
  if (lecture.regles.length === 0) redirect("/admin/redirections?erreur=aucune");

  const { count } = await prisma.redirect.createMany({
    data: lecture.regles,
    skipDuplicates: true,
  });

  revalidatePath("/admin/redirections");
  revalidatePath("/", "layout");

  const bilan = new URLSearchParams({
    importees: String(count),
    existantes: String(lecture.regles.length - count),
    rejets: String(lecture.nbRejets),
    doublons: String(lecture.doublons),
  });
  if (lecture.tronque) bilan.set("tronque", "1");
  redirect(`/admin/redirections?${bilan.toString()}`);
}

export async function deleteRedirectAction(id: string): Promise<void> {
  await requirePublisher();
  await prisma.redirect.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/redirections");
  revalidatePath("/", "layout");
  redirect("/admin/redirections");
}
