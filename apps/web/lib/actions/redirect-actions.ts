"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";

async function requirePublisher() {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    redirect("/login?next=/admin/redirections");
  }
}

/** Normalise un chemin source : "/ancienne-page.html" (une seule section). */
function normalizeFrom(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!s.startsWith("/")) s = `/${s}`;
  // le repli de route ne voit qu'une section — pas de sous-chemins
  if (s.slice(1).includes("/")) return null;
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

export async function deleteRedirectAction(id: string): Promise<void> {
  await requirePublisher();
  await prisma.redirect.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/redirections");
  revalidatePath("/", "layout");
  redirect("/admin/redirections");
}
