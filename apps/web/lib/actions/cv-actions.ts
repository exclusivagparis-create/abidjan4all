"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@a4a/db";
import { auth } from "@/auth";

export type CvResult = { ok: true } | { ok: false; error: string };

/** « Poste | Entreprise | Période | Détail » par ligne → tableau structuré. */
function parseExperiences(raw: string): Prisma.InputJsonValue {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((l) => {
      const [role = "", company = "", period = "", detail = ""] = l.split("|").map((s) => s.trim());
      return { role, company, period, detail };
    });
}

/** « École | Diplôme | Année » par ligne → tableau structuré. */
function parseEducation(raw: string): Prisma.InputJsonValue {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((l) => {
      const [school = "", degree = "", year = ""] = l.split("|").map((s) => s.trim());
      return { school, degree, year };
    });
}

/**
 * Enregistre (crée ou met à jour) le CV en ligne du membre connecté. Gratuit,
 * un CV par compte. La connexion est requise.
 */
export async function saveCvAction(_prev: CvResult | undefined, formData: FormData): Promise<CvResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Connectez-vous pour gérer votre CV." };

  const headline = String(formData.get("headline") ?? "").trim().slice(0, 140);
  if (!headline) return { ok: false, error: "Indiquez au moins votre métier / intitulé." };

  const data = {
    headline,
    summary: String(formData.get("summary") ?? "").trim().slice(0, 3000) || null,
    phone: String(formData.get("phone") ?? "").trim().slice(0, 40) || null,
    contactEmail: String(formData.get("contactEmail") ?? "").trim().slice(0, 140) || null,
    location: String(formData.get("location") ?? "").trim().slice(0, 120) || null,
    skills: String(formData.get("skills") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30),
    experiences: parseExperiences(String(formData.get("experiences") ?? "")),
    education: parseEducation(String(formData.get("education") ?? "")),
    isPublic: formData.get("isPublic") === "on",
  };

  await prisma.cvProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data,
  });

  revalidatePath("/espace-membre/cv");
  revalidatePath(`/cv/${session.user.id}`);
  revalidatePath("/cv");
  return { ok: true };
}

/** Supprime le CV du membre connecté. */
export async function deleteCvAction(): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  await prisma.cvProfile.deleteMany({ where: { userId: session.user.id } });
  revalidatePath("/espace-membre/cv");
  revalidatePath("/cv");
}
