import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: "A4A Formation" };
export const dynamic = "force-dynamic";

export default async function FormationPage() {
  const courses = await prisma.course.findMany({
    orderBy: { title: "asc" },
    include: { _count: { select: { enrollments: true } } },
  });

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[1080px] px-8 pb-16 pt-10">
        <div className="mb-3 text-[13px] font-bold uppercase tracking-[0.16em] text-accent">A4A Formation</div>
        <h1 className="max-w-[24ch] font-serif text-[40px] font-medium leading-[1.05] tracking-tight">
          Des compétences concrètes, pensées pour la Côte d&apos;Ivoire et la diaspora.
        </h1>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/formation/${c.slug}`}
              className="group rounded-[16px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]"
            >
              <div className="mb-3 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-3">
                <span className="rounded-pill bg-surface-2 px-2.5 py-1">{c.category}</span>
                <span className="rounded-pill bg-surface-2 px-2.5 py-1">{c.level}</span>
                {c.isPremium ? (
                  <span className="rounded-pill bg-[linear-gradient(135deg,#F5C24B,#E8641A)] px-2.5 py-1 text-[#16181D]">
                    ★ A4A+
                  </span>
                ) : null}
              </div>
              <h2 className="font-serif text-[24px] font-semibold leading-[1.15] group-hover:underline">{c.title}</h2>
              <div className="mt-3 flex items-center gap-3 text-[13px] text-ink-3">
                <span>{c.lessonsCount} leçons</span>
                <span>· ★ {c.rating.toFixed(1)}</span>
                <span>· {c._count.enrollments} inscrit{c._count.enrollments > 1 ? "s" : ""}</span>
                <span className="ml-auto text-[15px] font-extrabold text-ink">
                  {c.price > 0 ? formatXOF(c.price) : "Gratuit"}
                </span>
              </div>
            </Link>
          ))}
        </div>
        {courses.length === 0 ? (
          <p className="py-16 text-center font-serif text-lg text-ink-3">Le catalogue ouvre bientôt.</p>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
