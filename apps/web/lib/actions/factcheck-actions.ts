"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type FactCheckVerdict } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";

const VERDICTS: FactCheckVerdict[] = ["vrai", "faux", "trompeur", "a_verifier"];

async function requirePublisher() {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    redirect("/login?next=/admin/factchecks");
  }
}

function parse(formData: FormData) {
  const claim = String(formData.get("claim") ?? "").trim().slice(0, 300);
  const verdict = String(formData.get("verdict") ?? "");
  const topic = String(formData.get("topic") ?? "").trim().slice(0, 60);
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  const sources = String(formData.get("sources") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  const valid = claim.length >= 5 && VERDICTS.includes(verdict as FactCheckVerdict) && body.length >= 10;
  return { valid, data: { claim, verdict: verdict as FactCheckVerdict, topic: topic || "Général", body, sources } };
}

export async function createFactCheckAction(formData: FormData): Promise<void> {
  await requirePublisher();
  const { valid, data } = parse(formData);
  if (!valid) redirect("/admin/factchecks?erreur=1");
  await prisma.factCheck.create({ data });
  revalidatePath("/admin/factchecks");
  revalidatePath("/verifie");
  redirect("/admin/factchecks");
}

export async function updateFactCheckAction(id: string, formData: FormData): Promise<void> {
  await requirePublisher();
  const { valid, data } = parse(formData);
  if (!valid) redirect("/admin/factchecks?erreur=1");
  await prisma.factCheck.update({ where: { id }, data });
  revalidatePath("/admin/factchecks");
  revalidatePath("/verifie");
  redirect("/admin/factchecks");
}

export async function deleteFactCheckAction(id: string): Promise<void> {
  await requirePublisher();
  await prisma.factCheck.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/factchecks");
  revalidatePath("/verifie");
  redirect("/admin/factchecks");
}
