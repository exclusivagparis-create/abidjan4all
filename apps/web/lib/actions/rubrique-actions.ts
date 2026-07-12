"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type RubriqueKind } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";

const KINDS: RubriqueKind[] = ["gratuit", "premium", "freemium", "affiliation"];

/** « Économie & Finances » → "economie-finances" (URL stable, sans accents). */
function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/rubriques");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (me?.role !== "admin") redirect("/admin/rubriques");
}

/** Crée une rubrique (admin) — slug généré du nom, ordre en fin de liste. */
export async function createRubriqueAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const color = String(formData.get("color") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const slug = slugify(name);

  if (name.length < 2 || !slug || !/^#[0-9a-fA-F]{6}$/.test(color) || !KINDS.includes(kind as RubriqueKind)) {
    redirect("/admin/rubriques?erreur=invalide");
  }
  if (await prisma.rubrique.findUnique({ where: { slug } })) {
    redirect("/admin/rubriques?erreur=doublon");
  }

  const last = await prisma.rubrique.aggregate({ _max: { order: true } });
  await prisma.rubrique.create({
    data: { name, slug, color, kind: kind as RubriqueKind, order: (last._max.order ?? 0) + 1 },
  });
  revalidatePath("/admin/rubriques");
  revalidatePath("/", "layout");
  redirect("/admin/rubriques");
}

/** Supprime une rubrique vide (admin) — bloqué si articles ou live-blogs. */
export async function deleteRubriqueAction(id: string): Promise<void> {
  await requireAdmin();

  const rubrique = await prisma.rubrique.findUnique({
    where: { id },
    include: { _count: { select: { articles: true, liveBlogs: true } } },
  });
  if (!rubrique) redirect("/admin/rubriques");
  if (rubrique._count.articles > 0 || rubrique._count.liveBlogs > 0) {
    redirect("/admin/rubriques?erreur=non-vide");
  }

  await prisma.rubrique.delete({ where: { id } });
  revalidatePath("/admin/rubriques");
  revalidatePath("/", "layout");
  redirect("/admin/rubriques");
}

/**
 * Met à jour une rubrique (nom, couleur, type, ordre) — rédaction en chef et
 * admin. Le slug n'est jamais modifiable : il porte les URLs publiques, le
 * sitemap et les redirections 301.
 */
export async function updateRubriqueAction(id: string, formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    redirect("/admin");
  }

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const color = String(formData.get("color") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const order = Number(formData.get("order"));

  if (!name || !/^#[0-9a-fA-F]{6}$/.test(color) || !KINDS.includes(kind as RubriqueKind)) return;

  await prisma.rubrique.update({
    where: { id },
    data: {
      name,
      color,
      kind: kind as RubriqueKind,
      order: Number.isInteger(order) && order > 0 && order < 100 ? order : undefined,
    },
  });
  revalidatePath("/admin/rubriques");
  revalidatePath("/", "layout"); // header/footer publics listent les rubriques
}
