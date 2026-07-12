"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type RubriqueKind } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";

const KINDS: RubriqueKind[] = ["gratuit", "premium", "freemium", "affiliation"];

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
