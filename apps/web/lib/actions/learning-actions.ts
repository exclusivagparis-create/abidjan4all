"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";

/** Session dont l'utilisateur existe toujours en base (un re-seed dev invalide les JWT). */
async function requireFreshUser(nextPath: string) {
  const session = await auth();
  if (!session?.user) redirect(`/login?next=${nextPath}`);
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } });
  if (!user) redirect(`/login?next=${nextPath}`);
  return user;
}

/** POST /enrollments du contrat — inscription à une formation. */
export async function enrollAction(courseSlug: string): Promise<void> {
  const user = await requireFreshUser(`/formation/${courseSlug}`);

  const course = await prisma.course.findUnique({ where: { slug: courseSlug } });
  if (!course) redirect("/formation");

  await prisma.enrollment.upsert({
    where: { courseId_userId: { courseId: course.id, userId: user.id } },
    create: { courseId: course.id, userId: user.id },
    update: {},
  });
  revalidatePath(`/formation/${courseSlug}`);
}

/** Marque une leçon comme suivie et recalcule la progression. */
export async function completeLessonAction(courseSlug: string, lessonId: string): Promise<void> {
  const user = await requireFreshUser(`/formation/${courseSlug}`);

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { course: { include: { _count: { select: { lessons: true } } } } },
  });
  if (!lesson || lesson.course.slug !== courseSlug) redirect("/formation");

  const enrollment = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId: lesson.courseId, userId: user.id } },
  });
  if (!enrollment) redirect(`/formation/${courseSlug}`);

  const total = lesson.course._count.lessons;
  const progressPct = Math.min(100, Math.round((lesson.order / Math.max(1, total)) * 100));

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      lastLessonId: lesson.id,
      progressPct: Math.max(enrollment.progressPct, progressPct),
      certificateIssued: progressPct >= 100 || enrollment.certificateIssued,
    },
  });
  revalidatePath(`/formation/${courseSlug}`);
}
