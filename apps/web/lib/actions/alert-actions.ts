"use server";

import { redirect } from "next/navigation";
import { prisma } from "@a4a/db";
import { PUBLISH_ROLES } from "@/auth";
import { exigerRole } from "@/lib/garde-role";
import { pushConfigured, sendBroadcast } from "@/lib/push";

async function requirePublisher() {
  const moi = await exigerRole(PUBLISH_ROLES);
  if (!moi) {
    redirect("/login?next=/admin/alertes");
  }
}

/**
 * Envoie une alerte push « breaking news » à tous les abonnés. La destination
 * est un chemin interne (ex. /politique/mon-article) ou l'accueil par défaut.
 */
export async function sendBreakingAlertAction(formData: FormData): Promise<void> {
  await requirePublisher();
  if (!pushConfigured) redirect("/admin/alertes?erreur=push");

  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  const body = String(formData.get("body") ?? "").trim().slice(0, 160);
  let url = String(formData.get("url") ?? "").trim();
  if (title.length < 2 || body.length < 2) redirect("/admin/alertes?erreur=1");

  if (!url) url = "/";
  if (!url.startsWith("http")) {
    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
    url = `${site}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  const sent = await sendBroadcast({ title, body, url });
  redirect(`/admin/alertes?envoye=${sent}`);
}
