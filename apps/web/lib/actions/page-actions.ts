"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { sanitizeArticleHtml } from "@/lib/sanitize-html";

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function requirePublisher() {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    redirect("/login?next=/admin/pages");
  }
}

/** Slugs réservés (rubriques, routes) : une page ne peut pas les écraser. */
async function slugIsFree(slug: string, exceptId?: string): Promise<boolean> {
  if (!slug) return false;
  const rub = await prisma.rubrique.findUnique({ where: { slug }, select: { id: true } });
  if (rub) return false;
  const page = await prisma.page.findUnique({ where: { slug }, select: { id: true } });
  return !page || page.id === exceptId;
}

export async function createPageAction(formData: FormData): Promise<void> {
  await requirePublisher();
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const slug = slugify(String(formData.get("slug") ?? "") || title);
  const body = sanitizeArticleHtml(String(formData.get("body") ?? ""));
  if (title.length < 2 || !slug) redirect("/admin/pages?erreur=1");
  if (!(await slugIsFree(slug))) redirect("/admin/pages?erreur=slug");

  const last = await prisma.page.aggregate({ _max: { order: true } });
  const page = await prisma.page.create({
    data: { title, slug, body, order: (last._max.order ?? 0) + 1 },
  });
  revalidatePath("/admin/pages");
  revalidatePath("/", "layout");
  redirect(`/admin/pages/${page.id}`);
}

export async function updatePageAction(id: string, formData: FormData): Promise<void> {
  await requirePublisher();
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const body = sanitizeArticleHtml(String(formData.get("body") ?? ""));
  const published = formData.get("published") === "on";
  const inFooter = formData.get("inFooter") === "on";
  if (title.length < 2) redirect(`/admin/pages/${id}?erreur=1`);

  await prisma.page.update({ where: { id }, data: { title, body, published, inFooter } });
  revalidatePath("/admin/pages");
  revalidatePath("/", "layout");
  redirect(`/admin/pages/${id}?ok=1`);
}

export async function deletePageAction(id: string): Promise<void> {
  await requirePublisher();
  await prisma.page.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/pages");
  revalidatePath("/", "layout");
  redirect("/admin/pages");
}
