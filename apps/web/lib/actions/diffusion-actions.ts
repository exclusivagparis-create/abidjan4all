"use server";

import { revalidatePath } from "next/cache";
import { PUBLISH_ROLES } from "@/auth";
import { exigerRole } from "@/lib/garde-role";
import { relancerDiffusion } from "@/lib/diffusion-sociale";

/**
 * Relance une annonce restée en échec.
 *
 * Réservée aux rôles de publication : renvoyer une annonce, c'est écrire sur
 * la page officielle du média — pas une opération de lecture.
 */
export async function relancerDiffusionAction(formData: FormData): Promise<void> {
  if (!(await exigerRole(PUBLISH_ROLES))) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await relancerDiffusion(id);
  revalidatePath("/admin/diffusion");
}
