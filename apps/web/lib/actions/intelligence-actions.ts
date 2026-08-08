"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type BriefKind } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { removeUpload, saveDocumentUpload, saveImageUpload } from "@/lib/uploads";
import { ouvrirAbonnement } from "@/lib/intelligence";

const KINDS: BriefKind[] = ["rapport", "revue", "classement", "etude", "revue_presse"];

/** Rédaction en chef ou administration (rôle relu en base, jamais le JWT seul). */
async function requirePublish() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/intelligence");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } });
  if (!me || !PUBLISH_ROLES.includes(me.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");
  return me;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "publication"
  );
}

// ---------------------------------------------------------------------------
// Séries (produits d'abonnement)
// ---------------------------------------------------------------------------

function parseSerieForm(formData: FormData) {
  const kind = String(formData.get("kind") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 140);
  const pitch = String(formData.get("pitch") ?? "").trim().slice(0, 300);
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000);
  const cible = String(formData.get("cible") ?? "").trim().slice(0, 160);
  const rythme = String(formData.get("rythme") ?? "").trim().slice(0, 40);
  const prixAnnuel = Number(formData.get("prixAnnuel"));
  const dureeMois = Number(formData.get("dureeMois"));
  const ordre = Number(formData.get("ordre"));

  const valid =
    KINDS.includes(kind as BriefKind) &&
    !!title &&
    !!pitch &&
    Number.isInteger(prixAnnuel) &&
    prixAnnuel > 0 &&
    Number.isInteger(dureeMois) &&
    dureeMois > 0;

  return {
    valid,
    data: {
      kind: kind as BriefKind,
      title,
      pitch,
      description,
      cible,
      rythme: rythme || "périodique",
      prixAnnuel,
      dureeMois,
      ordre: Number.isInteger(ordre) ? ordre : 0,
    },
  };
}

/** Slug unique — l'identifiant public d'une série ne change jamais après coup. */
async function slugLibre(base: string): Promise<string> {
  const s = slugify(base);
  for (let i = 0; ; i++) {
    const candidat = i === 0 ? s : `${s}-${i + 1}`;
    const existe = await prisma.briefSerie.findUnique({ where: { slug: candidat }, select: { id: true } });
    if (!existe) return candidat;
  }
}

export async function createSerieAction(formData: FormData): Promise<void> {
  await requirePublish();
  const { valid, data } = parseSerieForm(formData);
  if (!valid) redirect("/admin/intelligence?erreur=1");

  const serie = await prisma.briefSerie.create({ data: { ...data, slug: await slugLibre(data.title) } });
  revalidatePath("/admin/intelligence");
  revalidatePath("/intelligence");
  redirect(`/admin/intelligence/${serie.id}`);
}

export async function updateSerieAction(id: string, formData: FormData): Promise<void> {
  await requirePublish();
  const { valid, data } = parseSerieForm(formData);
  if (!valid) redirect(`/admin/intelligence/${id}?erreur=1`);

  let coverUrl: string | undefined;
  const file = formData.get("cover");
  if (file instanceof File && file.size > 0) {
    const up = await saveImageUpload(file);
    if (!up.ok) redirect(`/admin/intelligence/${id}?erreur=image`);
    const actuelle = await prisma.briefSerie.findUnique({ where: { id }, select: { coverUrl: true } });
    await removeUpload(actuelle?.coverUrl);
    coverUrl = up.url;
  }

  await prisma.briefSerie.update({ where: { id }, data: { ...data, ...(coverUrl ? { coverUrl } : {}) } });
  revalidatePath("/admin/intelligence");
  revalidatePath(`/admin/intelligence/${id}`);
  revalidatePath("/intelligence");
  redirect(`/admin/intelligence/${id}`);
}

/** Met une publication en vente / la retire du catalogue (sans rien supprimer). */
export async function setSerieActiveAction(id: string, formData: FormData): Promise<void> {
  await requirePublish();
  const actif = String(formData.get("actif") ?? "") === "1";
  await prisma.briefSerie.update({ where: { id }, data: { actif } }).catch(() => {});
  revalidatePath("/admin/intelligence");
  revalidatePath("/intelligence");
}

/**
 * Supprime une publication. Refusé si des abonnés y ont accès : on la retire
 * de la vente à la place — un abonné payant ne doit jamais perdre ses éditions.
 */
export async function deleteSerieAction(id: string): Promise<void> {
  await requirePublish();
  const abonnes = await prisma.briefAbonnement.count({ where: { serieId: id } });
  if (abonnes > 0) redirect(`/admin/intelligence/${id}?erreur=abonnes`);

  const editions = await prisma.briefEdition.findMany({ where: { serieId: id }, select: { fileUrl: true } });
  const serie = await prisma.briefSerie.findUnique({ where: { id }, select: { coverUrl: true } });
  await Promise.all([...editions.map((e) => removeUpload(e.fileUrl)), removeUpload(serie?.coverUrl)]);
  await prisma.briefSerie.delete({ where: { id } }).catch(() => {}); // cascade → éditions
  revalidatePath("/admin/intelligence");
  revalidatePath("/intelligence");
  redirect("/admin/intelligence");
}

// ---------------------------------------------------------------------------
// Éditions (livraisons d'une série)
// ---------------------------------------------------------------------------

function parseEditionForm(formData: FormData) {
  const numero = String(formData.get("numero") ?? "").trim().slice(0, 40);
  const title = String(formData.get("title") ?? "").trim().slice(0, 180);
  const resume = String(formData.get("resume") ?? "").trim().slice(0, 1200);
  const valid = !!numero && !!title && !!resume;
  return { valid, data: { numero, title, resume } };
}

export async function createEditionAction(serieId: string, formData: FormData): Promise<void> {
  await requirePublish();
  const { valid, data } = parseEditionForm(formData);
  if (!valid) redirect(`/admin/intelligence/${serieId}?erreur=edition`);

  // Le numéro identifie l'édition dans l'URL publique : il doit rester unique.
  const doublon = await prisma.briefEdition.findUnique({
    where: { serieId_numero: { serieId, numero: data.numero } },
    select: { id: true },
  });
  if (doublon) redirect(`/admin/intelligence/${serieId}?erreur=doublon`);

  let fileUrl: string | null = null;
  const file = formData.get("pdf");
  if (file instanceof File && file.size > 0) {
    const up = await saveDocumentUpload(file);
    if (!up.ok) redirect(`/admin/intelligence/${serieId}?erreur=pdf`);
    fileUrl = up.url;
  }

  await prisma.briefEdition.create({ data: { ...data, serieId, fileUrl } });
  revalidatePath(`/admin/intelligence/${serieId}`);
  redirect(`/admin/intelligence/${serieId}`);
}

export async function updateEditionAction(editionId: string, formData: FormData): Promise<void> {
  await requirePublish();
  const current = await prisma.briefEdition.findUnique({
    where: { id: editionId },
    select: { serieId: true, fileUrl: true, numero: true },
  });
  if (!current) redirect("/admin/intelligence");
  const { valid, data } = parseEditionForm(formData);
  if (!valid) redirect(`/admin/intelligence/${current.serieId}?erreur=edition`);

  if (data.numero !== current.numero) {
    const doublon = await prisma.briefEdition.findUnique({
      where: { serieId_numero: { serieId: current.serieId, numero: data.numero } },
      select: { id: true },
    });
    if (doublon) redirect(`/admin/intelligence/${current.serieId}?erreur=doublon`);
  }

  let fileUrl = current.fileUrl;
  const file = formData.get("pdf");
  const retirer = formData.get("removePdf") === "1";
  if (file instanceof File && file.size > 0) {
    const up = await saveDocumentUpload(file);
    if (!up.ok) redirect(`/admin/intelligence/${current.serieId}?erreur=pdf`);
    await removeUpload(current.fileUrl);
    fileUrl = up.url;
  } else if (retirer) {
    await removeUpload(current.fileUrl);
    fileUrl = null;
  }

  await prisma.briefEdition.update({ where: { id: editionId }, data: { ...data, fileUrl } });
  revalidatePath(`/admin/intelligence/${current.serieId}`);
  redirect(`/admin/intelligence/${current.serieId}`);
}

/** Publie / dépublie une édition (les abonnés y accèdent dès la publication). */
export async function setEditionPubliedAction(editionId: string, formData: FormData): Promise<void> {
  await requirePublish();
  const publier = String(formData.get("publier") ?? "") === "1";
  const e = await prisma.briefEdition
    .update({
      where: { id: editionId },
      data: { publishedAt: publier ? new Date() : null },
      select: { serieId: true },
    })
    .catch(() => null);
  if (e) {
    revalidatePath(`/admin/intelligence/${e.serieId}`);
    revalidatePath("/intelligence");
  }
}

export async function deleteEditionAction(editionId: string): Promise<void> {
  await requirePublish();
  const e = await prisma.briefEdition.findUnique({ where: { id: editionId }, select: { serieId: true, fileUrl: true } });
  if (!e) return;
  await removeUpload(e.fileUrl);
  await prisma.briefEdition.delete({ where: { id: editionId } }).catch(() => {});
  revalidatePath(`/admin/intelligence/${e.serieId}`);
}

// ---------------------------------------------------------------------------
// Abonnés (accès accordés hors paiement en ligne : contrats, gratuités)
// ---------------------------------------------------------------------------

/** Ouvre un accès à un compte identifié par son e-mail (vente hors ligne). */
export async function accorderAbonnementAction(serieId: string, formData: FormData): Promise<void> {
  await requirePublish();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const mois = Number(formData.get("mois"));
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user || !Number.isInteger(mois) || mois <= 0) redirect(`/admin/intelligence/${serieId}?erreur=abonne`);

  await ouvrirAbonnement({ userId: user.id, serieId, dureeMois: mois });
  revalidatePath(`/admin/intelligence/${serieId}`);
  redirect(`/admin/intelligence/${serieId}?abonne=1`);
}

/** Ferme un accès (résiliation, erreur de saisie). */
export async function retirerAbonnementAction(abonnementId: string): Promise<void> {
  await requirePublish();
  const a = await prisma.briefAbonnement
    .delete({ where: { id: abonnementId }, select: { serieId: true } })
    .catch(() => null);
  if (a) revalidatePath(`/admin/intelligence/${a.serieId}`);
}
