"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";

/** « Diaspora Québec » → "diaspora-quebec" (slug d'URL stable). */
function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function requireAdmin(next: string) {
  const session = await auth();
  if (!session?.user) redirect(`/login?next=${next}`);
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (me?.role !== "admin") redirect("/admin");
}

async function requirePublisher(next: string) {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    redirect(`/login?next=${next}`);
  }
}

// ===========================================================================
// GROUPES (communauté)
// ===========================================================================

export async function createGroupAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/community");
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const color = String(formData.get("color") ?? "").trim();
  const membersCount = Math.max(0, Number(formData.get("membersCount")) || 0);
  const slug = slugify(name);
  if (name.length < 2 || !slug || !/^#[0-9a-fA-F]{6}$/.test(color)) redirect("/admin/community?erreur=1");
  if (await prisma.group.findUnique({ where: { slug } })) redirect("/admin/community?erreur=doublon");

  await prisma.group.create({ data: { name, slug, color, membersCount } });
  revalidatePath("/admin/community");
  revalidatePath("/groupes");
  redirect("/admin/community");
}

export async function updateGroupAction(id: string, formData: FormData): Promise<void> {
  await requireAdmin("/admin/community");
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const color = String(formData.get("color") ?? "").trim();
  const membersCount = Math.max(0, Number(formData.get("membersCount")) || 0);
  if (name.length < 2 || !/^#[0-9a-fA-F]{6}$/.test(color)) return;

  await prisma.group.update({ where: { id }, data: { name, color, membersCount } });
  revalidatePath("/admin/community");
  revalidatePath("/groupes");
}

export async function deleteGroupAction(id: string): Promise<void> {
  await requireAdmin("/admin/community");
  const g = await prisma.group.findUnique({ where: { id }, include: { _count: { select: { members: true } } } });
  if (!g) redirect("/admin/community");
  if (g._count.members > 0) redirect("/admin/community?erreur=membres");
  await prisma.group.delete({ where: { id } });
  revalidatePath("/admin/community");
  revalidatePath("/groupes");
  redirect("/admin/community");
}

// ===========================================================================
// PODCASTS (émissions + épisodes)
// ===========================================================================

export async function createPodcastAction(formData: FormData): Promise<void> {
  await requirePublisher("/admin/podcasts");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const category = String(formData.get("category") ?? "").trim().slice(0, 60);
  const cadence = String(formData.get("cadence") ?? "").trim().slice(0, 40);
  const coverUrl = String(formData.get("coverUrl") ?? "").trim();
  const slug = slugify(title);
  if (title.length < 2 || !slug) redirect("/admin/podcasts?erreur=1");
  if (await prisma.podcast.findUnique({ where: { slug } })) redirect("/admin/podcasts?erreur=doublon");

  await prisma.podcast.create({
    data: { title, slug, category: category || "Actualité", cadence: cadence || "hebdomadaire", coverUrl: coverUrl || `placeholder://${title}` },
  });
  revalidatePath("/admin/podcasts");
  revalidatePath("/podcasts");
  redirect("/admin/podcasts");
}

export async function updatePodcastAction(id: string, formData: FormData): Promise<void> {
  await requirePublisher("/admin/podcasts");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const category = String(formData.get("category") ?? "").trim().slice(0, 60);
  const cadence = String(formData.get("cadence") ?? "").trim().slice(0, 40);
  const coverUrl = String(formData.get("coverUrl") ?? "").trim();
  if (title.length < 2) return;
  await prisma.podcast.update({
    where: { id },
    data: { title, category, cadence, ...(coverUrl ? { coverUrl } : {}) },
  });
  revalidatePath("/admin/podcasts");
  revalidatePath("/podcasts");
}

export async function deletePodcastAction(id: string): Promise<void> {
  await requirePublisher("/admin/podcasts");
  await prisma.episode.deleteMany({ where: { podcastId: id } });
  await prisma.podcast.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/podcasts");
  revalidatePath("/podcasts");
  redirect("/admin/podcasts");
}

export async function createEpisodeAction(podcastId: string, formData: FormData): Promise<void> {
  await requirePublisher("/admin/podcasts");
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const description = String(formData.get("description") ?? "").trim().slice(0, 400);
  const audioUrl = String(formData.get("audioUrl") ?? "").trim();
  const durationMin = Math.max(1, Number(formData.get("durationMin")) || 20);
  if (title.length < 2) redirect(`/admin/podcasts/${podcastId}?erreur=1`);

  const last = await prisma.episode.aggregate({ where: { podcastId }, _max: { number: true } });
  await prisma.episode.create({
    data: {
      podcastId,
      number: (last._max.number ?? 0) + 1,
      title,
      description,
      audioUrl: audioUrl || `placeholder://${title}`,
      durationSec: durationMin * 60,
      publishedAt: new Date(),
    },
  });
  revalidatePath(`/admin/podcasts/${podcastId}`);
  revalidatePath("/podcasts");
}

export async function deleteEpisodeAction(id: string, podcastId: string): Promise<void> {
  await requirePublisher("/admin/podcasts");
  await prisma.episode.delete({ where: { id } }).catch(() => {});
  revalidatePath(`/admin/podcasts/${podcastId}`);
  revalidatePath("/podcasts");
}

// ===========================================================================
// A4A FORMATION (cours + leçons)
// ===========================================================================

export async function createCourseAction(formData: FormData): Promise<void> {
  await requirePublisher("/admin/formation");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const category = String(formData.get("category") ?? "").trim().slice(0, 60);
  const level = String(formData.get("level") ?? "débutant");
  const price = Math.max(0, Number(formData.get("price")) || 0);
  const isPremium = formData.get("isPremium") === "on";
  const slug = slugify(title);
  if (title.length < 2 || !slug) redirect("/admin/formation?erreur=1");
  if (await prisma.course.findUnique({ where: { slug } })) redirect("/admin/formation?erreur=doublon");

  await prisma.course.create({
    data: { title, slug, category: category || "Général", level, price, isPremium },
  });
  revalidatePath("/admin/formation");
  revalidatePath("/formation");
  redirect("/admin/formation");
}

export async function updateCourseAction(id: string, formData: FormData): Promise<void> {
  await requirePublisher("/admin/formation");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const category = String(formData.get("category") ?? "").trim().slice(0, 60);
  const level = String(formData.get("level") ?? "débutant");
  const price = Math.max(0, Number(formData.get("price")) || 0);
  const isPremium = formData.get("isPremium") === "on";
  if (title.length < 2) return;
  await prisma.course.update({ where: { id }, data: { title, category, level, price, isPremium } });
  revalidatePath("/admin/formation");
  revalidatePath("/formation");
}

export async function deleteCourseAction(id: string): Promise<void> {
  await requirePublisher("/admin/formation");
  const c = await prisma.course.findUnique({ where: { id }, include: { _count: { select: { enrollments: true } } } });
  if (!c) redirect("/admin/formation");
  if (c._count.enrollments > 0) redirect("/admin/formation?erreur=inscrits");
  await prisma.lesson.deleteMany({ where: { courseId: id } });
  await prisma.course.delete({ where: { id } });
  revalidatePath("/admin/formation");
  revalidatePath("/formation");
  redirect("/admin/formation");
}

export async function createLessonAction(courseId: string, formData: FormData): Promise<void> {
  await requirePublisher("/admin/formation");
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const moduleName = String(formData.get("module") ?? "").trim().slice(0, 80);
  const videoUrl = String(formData.get("videoUrl") ?? "").trim();
  const durationMin = Math.max(1, Number(formData.get("durationMin")) || 8);
  if (title.length < 2) redirect(`/admin/formation/${courseId}?erreur=1`);

  const last = await prisma.lesson.aggregate({ where: { courseId }, _max: { order: true } });
  await prisma.$transaction([
    prisma.lesson.create({
      data: {
        courseId,
        order: (last._max.order ?? 0) + 1,
        title,
        module: moduleName || "Module 1",
        videoUrl: videoUrl || null,
        durationSec: durationMin * 60,
      },
    }),
    prisma.course.update({ where: { id: courseId }, data: { lessonsCount: { increment: 1 } } }),
  ]);
  revalidatePath(`/admin/formation/${courseId}`);
  revalidatePath("/formation");
}

export async function deleteLessonAction(id: string, courseId: string): Promise<void> {
  await requirePublisher("/admin/formation");
  await prisma.$transaction([
    prisma.lesson.delete({ where: { id } }),
    prisma.course.update({ where: { id: courseId }, data: { lessonsCount: { decrement: 1 } } }),
  ]).catch(() => {});
  revalidatePath(`/admin/formation/${courseId}`);
  revalidatePath("/formation");
}
