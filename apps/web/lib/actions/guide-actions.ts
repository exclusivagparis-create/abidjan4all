"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type GuideKind } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { sanitizeArticleHtml } from "@/lib/sanitize-html";
import { IDENTITE, SECTIONS, slugifier } from "@/lib/guide";

async function requirePublisher() {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    redirect("/login?next=/admin/guide");
  }
}

const texte = (formData: FormData, nom: string, max = 200) => String(formData.get(nom) ?? "").trim().slice(0, max);

/** Champs rédigés : même filtre que les articles, aucune balise de plus. */
function sections(formData: FormData): Record<string, string> {
  const valeurs: Record<string, string> = {};
  for (const s of SECTIONS) valeurs[s.cle] = sanitizeArticleHtml(String(formData.get(s.cle) ?? ""));
  return valeurs;
}

function identite(formData: FormData): Record<string, string> {
  const valeurs: Record<string, string> = {};
  for (const c of IDENTITE) valeurs[c.cle] = texte(formData, c.cle, 160);
  return valeurs;
}

export async function createFicheAction(formData: FormData): Promise<void> {
  await requirePublisher();
  const title = texte(formData, "title", 120);
  if (title.length < 2) redirect("/admin/guide?erreur=titre");

  // Le slug se déduit du titre et ne bouge plus ensuite : il porte les liens
  // et le référencement de la fiche, qui vivra des années.
  let slug = slugifier(title);
  if (!slug) redirect("/admin/guide?erreur=titre");
  if (await prisma.guideFiche.findUnique({ where: { slug }, select: { id: true } })) {
    redirect("/admin/guide?erreur=doublon");
  }

  const kind = (texte(formData, "kind", 10) === "theme" ? "theme" : "pays") as GuideKind;
  const fiche = await prisma.guideFiche.create({
    data: { slug, title, kind, region: texte(formData, "region", 60) || null, summary: "" },
  });

  revalidatePath("/admin/guide");
  redirect(`/admin/guide/${fiche.id}`);
}

export async function updateFicheAction(id: string, formData: FormData): Promise<void> {
  await requirePublisher();

  const title = texte(formData, "title", 120);
  if (title.length < 2) redirect(`/admin/guide/${id}?erreur=titre`);

  const summary = texte(formData, "summary", 600);
  const published = formData.get("published") === "on";

  // Publier sans chapô donnerait une fiche muette dans le sommaire et dans les
  // résultats de recherche : on refuse, en disant pourquoi.
  if (published && summary.length < 20) redirect(`/admin/guide/${id}?erreur=chapo`);

  await prisma.guideFiche.update({
    where: { id },
    data: {
      title,
      summary,
      kind: (texte(formData, "kind", 10) === "theme" ? "theme" : "pays") as GuideKind,
      region: texte(formData, "region", 60) || null,
      coverUrl: texte(formData, "coverUrl", 300) || null,
      order: Number(texte(formData, "order", 6)) || 0,
      published,
      ...identite(formData),
      ...sections(formData),
    },
  });

  revalidatePath("/admin/guide");
  revalidatePath("/guide");
  revalidatePath(`/guide/${(await prisma.guideFiche.findUnique({ where: { id }, select: { slug: true } }))?.slug ?? ""}`);
  redirect(`/admin/guide/${id}?ok=1`);
}

export async function deleteFicheAction(id: string): Promise<void> {
  await requirePublisher();
  await prisma.guideFiche.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/guide");
  revalidatePath("/guide");
  redirect("/admin/guide");
}
