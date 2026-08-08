"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import type { PaymentMethodId } from "@a4a/payments";
import { auth } from "@/auth";
import { startOrderCheckout } from "@/lib/order-billing";

const METHODS: PaymentMethodId[] = ["momo", "orange", "wave", "moov", "djamo", "card", "paypal"];

/** Offres A4A+ qui incluent l'accès aux cours payants (pilier 6). */
const PLANS_INCLUANT_FORMATION = ["pro", "corporate"];

/** Session dont l'utilisateur existe toujours en base (un re-seed dev invalide les JWT). */
async function requireFreshUser(nextPath: string) {
  const session = await auth();
  if (!session?.user) redirect(`/login?next=${nextPath}`);
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } });
  if (!user) redirect(`/login?next=${nextPath}`);
  return user;
}

/**
 * Inscription à une formation (POST /enrollments du contrat).
 *
 * Cours gratuit, ou abonné A4A+ Pro/Corporate : inscription immédiate — c'est
 * l'avantage mis en avant sur la page d'abonnement. Sinon le cours est payant
 * (pilier 6) : passage par le flux de commande, l'inscription est créée au
 * paiement confirmé.
 */
export async function enrollAction(courseSlug: string, formData?: FormData): Promise<void> {
  const user = await requireFreshUser(`/formation/${courseSlug}`);

  const course = await prisma.course.findUnique({ where: { slug: courseSlug } });
  if (!course) redirect("/formation");

  // Déjà inscrit : rien à refacturer.
  const deja = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId: course.id, userId: user.id } },
    select: { id: true },
  });

  const sub = await prisma.subscription.findUnique({
    where: { userId: user.id },
    select: { plan: true, status: true, currentPeriodEnd: true },
  });
  const abonnementCouvrant =
    !!sub &&
    PLANS_INCLUANT_FORMATION.includes(sub.plan) &&
    sub.status !== "canceled" &&
    (!sub.currentPeriodEnd || sub.currentPeriodEnd > new Date());

  if (deja || course.price <= 0 || abonnementCouvrant) {
    await prisma.enrollment.upsert({
      where: { courseId_userId: { courseId: course.id, userId: user.id } },
      create: { courseId: course.id, userId: user.id },
      update: {},
    });
    revalidatePath(`/formation/${courseSlug}`);
    return;
  }

  const method = String(formData?.get("method") ?? "") as PaymentMethodId;
  if (!METHODS.includes(method)) redirect(`/formation/${courseSlug}?echec=saisie`);

  const result = await startOrderCheckout({
    userId: user.id,
    email: (await auth())?.user?.email ?? "",
    kind: "course_enrollment",
    tierId: course.id,
    method,
  });
  if (!result.ok) redirect(`/formation/${courseSlug}?indisponible=1`);
  redirect(result.checkoutUrl);
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
