import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LiveFeed } from "@/components/live-feed";
import { toLiveUpdateDTO } from "@/lib/live";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const blog = await prisma.liveBlog.findUnique({ where: { id }, select: { title: true, dek: true } });
  return blog ? { title: `En Direct — ${blog.title}`, description: blog.dek ?? undefined } : {};
}

export default async function LiveBlogPage({ params }: Props) {
  const { id } = await params;
  const blog = await prisma.liveBlog.findUnique({
    where: { id },
    include: { rubrique: { select: { slug: true, name: true, color: true } } },
  });
  if (!blog) notFound();

  const updates = await prisma.liveUpdate.findMany({
    where: { liveBlogId: id },
    orderBy: { time: "desc" },
    take: 100,
    include: { mediaAsset: true },
  });

  const startedTime = blog.startedAt.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />

      {/* en-tête d'événement (Live Blog.dc.html) */}
      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 lg:px-8 pt-[30px]">
        <div className="mb-3.5 flex items-center gap-2.5">
          {blog.status === "live" ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-red px-[13px] py-1.5 text-xs font-extrabold uppercase tracking-[0.06em] text-white">
              <span className="h-2 w-2 rounded-pill bg-white [animation:a4a-pulse_1.4s_infinite]" />
              En Direct
            </span>
          ) : (
            <span className="rounded-pill bg-surface-3 px-[13px] py-1.5 text-xs font-extrabold uppercase tracking-[0.06em] text-ink-3">
              Direct terminé
            </span>
          )}
          <Link
            href={`/${blog.rubrique.slug}`}
            className="text-[11px] font-bold uppercase tracking-[0.12em] hover:underline"
            style={{ color: blog.rubrique.color }}
          >
            {blog.rubrique.name}
          </Link>
        </div>
        <h1 className="mb-3 max-w-[22ch] font-serif text-[27px] sm:text-[34px] lg:text-[42px] font-medium leading-[1.06] tracking-tight">
          {blog.title}
        </h1>
        {blog.dek ? (
          <p className="mb-[18px] max-w-[64ch] font-serif text-[19px] leading-[1.5] text-ink-2">{blog.dek}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line pb-[22px] text-[13px] text-ink-3">
          <span className="flex items-center gap-2">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-pill bg-[linear-gradient(135deg,#E8641A,#D6282D)] text-[11px] font-bold text-white">
              A4A
            </span>
            <span className="font-semibold text-ink-2">La rédaction</span>
          </span>
          <span>·</span>
          <span>Débuté à {startedTime} GMT</span>
          <span>·</span>
          <span className="font-bold text-green">{blog.updatesCount} mises à jour</span>
        </div>
      </div>

      <main className="mx-auto max-w-[1080px] px-4 sm:px-6 lg:px-8 pb-16 pt-[26px]">
        <LiveFeed
          liveBlogId={blog.id}
          initialUpdates={updates.map(toLiveUpdateDTO)}
          live={blog.status === "live"}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
