"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";

async function requireRegieOuPublication() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/affiliation");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } });
  const autorises = [...PUBLISH_ROLES, "ad_manager"] as string[];
  if (!me || !autorises.includes(me.role)) redirect("/admin");
  return me;
}

/** Code d'URL court, stable et lisible (« wave-transfert »). */
function slugifyCode(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "lien"
  );
}

async function codeLibre(base: string): Promise<string> {
  const s = slugifyCode(base);
  for (let i = 0; ; i++) {
    const candidat = i === 0 ? s : `${s}-${i + 1}`;
    const existe = await prisma.affiliateLink.findUnique({ where: { code: candidat }, select: { id: true } });
    if (!existe) return candidat;
  }
}

function parseLinkForm(formData: FormData) {
  const partner = String(formData.get("partner") ?? "").trim().slice(0, 80);
  const label = String(formData.get("label") ?? "").trim().slice(0, 120);
  const url = String(formData.get("url") ?? "").trim();
  const commission = String(formData.get("commission") ?? "").trim().slice(0, 60) || null;
  // Seuls http(s) : un lien d'affiliation pointe vers un site partenaire.
  const valid = !!partner && !!label && /^https?:\/\//.test(url);
  return { valid, data: { partner, label, url, commission } };
}

export async function createLinkAction(formData: FormData): Promise<void> {
  await requireRegieOuPublication();
  const { valid, data } = parseLinkForm(formData);
  if (!valid) redirect("/admin/affiliation?erreur=1");
  const code = await codeLibre(`${data.partner}-${data.label}`);
  await prisma.affiliateLink.create({ data: { ...data, code } });
  revalidatePath("/admin/affiliation");
  redirect("/admin/affiliation");
}

export async function updateLinkAction(id: string, formData: FormData): Promise<void> {
  await requireRegieOuPublication();
  const { valid, data } = parseLinkForm(formData);
  if (!valid) redirect("/admin/affiliation?erreur=1");
  // Le code n'est jamais modifié : il vit dans des articles déjà publiés.
  await prisma.affiliateLink.update({ where: { id }, data }).catch(() => {});
  revalidatePath("/admin/affiliation");
  redirect("/admin/affiliation");
}

export async function setLinkActifAction(id: string, formData: FormData): Promise<void> {
  await requireRegieOuPublication();
  const actif = String(formData.get("actif") ?? "") === "1";
  await prisma.affiliateLink.update({ where: { id }, data: { actif } }).catch(() => {});
  revalidatePath("/admin/affiliation");
}

/**
 * Supprime un lien. Le code cesse alors de fonctionner : les liens déjà
 * publiés dans des articles ramèneront à l'accueil. Désactiver est préférable.
 */
export async function deleteLinkAction(id: string): Promise<void> {
  await requireRegieOuPublication();
  await prisma.affiliateLink.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/affiliation");
  redirect("/admin/affiliation");
}
