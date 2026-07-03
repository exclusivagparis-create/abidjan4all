import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { completeLessonAction, enrollAction } from "@/lib/actions/learning-actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = await prisma.course.findUnique({ where: { slug }, select: { title: true } });
  return course ? { title: `${course.title} · A4A Formation` } : {};
}

export default async function CoursePage({ params }: Props) {
  const { slug } = await params;
  const [session, course] = await Promise.all([
    auth(),
    prisma.course.findUnique({
      where: { slug },
      include: { lessons: { orderBy: { order: "asc" } } },
    }),
  ]);
  if (!course) notFound();

  const enrollment = session?.user
    ? await prisma.enrollment.findUnique({
        where: { courseId_userId: { courseId: course.id, userId: session.user.id } },
      })
    : null;

  const enroll = enrollAction.bind(null, course.slug);
  const modules = [...new Set(course.lessons.map((l) => l.module))];

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[860px] px-8 pb-16 pt-10">
        <nav className="mb-6 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
          <Link href="/formation" className="hover:text-ink">A4A Formation</Link>
          <span className="mx-2">›</span>
          <span className="text-ink">{course.category}</span>
        </nav>

        <h1 className="max-w-[24ch] font-serif text-[38px] font-medium leading-[1.08] tracking-tight">
          {course.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-ink-3">
          <span className="rounded-pill bg-surface-2 px-2.5 py-1 font-bold uppercase tracking-[0.08em]">{course.level}</span>
          <span>{course.lessonsCount} leçons · ★ {course.rating.toFixed(1)}</span>
          <span className="font-extrabold text-ink">{course.price > 0 ? `${formatXOF(course.price)}` : "Gratuit"}</span>
        </div>

        {/* inscription / progression */}
        <div className="mt-6 rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
          {enrollment ? (
            <div>
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <span className="font-bold">Votre progression</span>
                <span className="font-extrabold">{enrollment.progressPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-pill bg-surface-2">
                <div
                  className="h-full rounded-pill bg-[linear-gradient(90deg,var(--orange),var(--red))]"
                  style={{ width: `${enrollment.progressPct}%` }}
                />
              </div>
              {enrollment.certificateIssued ? (
                <p className="mt-3 text-[13px] font-semibold text-green">
                  🎓 Formation terminée — certificat disponible dans votre espace membre.
                </p>
              ) : null}
            </div>
          ) : (
            <form action={enroll} className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-serif text-[15px] text-ink-2">
                {session?.user
                  ? "Rejoignez la formation pour suivre votre progression."
                  : "Connectez-vous pour vous inscrire et suivre votre progression."}
              </p>
              <button type="submit" className="rounded-pill bg-red px-5 py-2.5 text-[13px] font-bold text-white">
                {course.price > 0 ? "S'inscrire (inclus A4A+ Pro)" : "S'inscrire gratuitement"}
              </button>
            </form>
          )}
        </div>

        {/* leçons par module */}
        {modules.map((module) => (
          <section key={module} className="mt-8">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">{module}</div>
            <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
              {course.lessons
                .filter((l) => l.module === module)
                .map((lesson) => {
                  const done = enrollment
                    ? enrollment.progressPct >= Math.round((lesson.order / course.lessons.length) * 100)
                    : false;
                  const complete = completeLessonAction.bind(null, course.slug, lesson.id);
                  return (
                    <div key={lesson.id} className="flex items-center gap-4 border-b border-line-2 px-5 py-4 last:border-b-0">
                      <span
                        className={`flex h-8 w-8 flex-none items-center justify-center rounded-pill text-xs font-bold ${
                          done ? "bg-green text-white" : "bg-surface-2 text-ink-3"
                        }`}
                      >
                        {done ? "✓" : lesson.order}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-serif text-[16px] font-semibold leading-snug">{lesson.title}</div>
                        <div className="text-xs text-ink-3">{Math.round(lesson.durationSec / 60)} min · vidéo</div>
                      </div>
                      {enrollment && !done ? (
                        <form action={complete}>
                          <button
                            type="submit"
                            className="rounded-pill border border-line bg-surface-2 px-3.5 py-2 text-[11.5px] font-semibold"
                          >
                            Marquer comme suivie
                          </button>
                        </form>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}
