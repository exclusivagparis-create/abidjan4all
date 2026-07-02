import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { ArticleEditor, type EditorArticle } from "@/components/admin/article-editor";

export const metadata: Metadata = { title: "Éditeur · Studio" };
export const dynamic = "force-dynamic";

/** Date → valeur `datetime-local` (heure locale, sans secondes). */
function toLocalInput(d: Date | null): string | null {
  if (!d) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, article, rubriques, mediaOptions] = await Promise.all([
    auth(),
    prisma.article.findUnique({ where: { id }, include: { author: { select: { name: true } } } }),
    prisma.rubrique.findMany({ orderBy: { order: "asc" }, select: { id: true, slug: true, name: true, color: true } }),
    prisma.mediaAsset.findMany({
      where: { type: { in: ["image", "svg"] } },
      orderBy: { createdAt: "desc" },
      take: 23,
      select: { id: true, url: true, alt: true },
    }),
  ]);
  if (!article) notFound();

  const initial: EditorArticle = {
    id: article.id,
    title: article.title,
    kicker: article.kicker ?? "",
    dek: article.dek ?? "",
    rubriqueId: article.rubriqueId,
    premium: article.premium,
    tags: article.tags,
    status: article.status,
    scheduledAt: toLocalInput(article.scheduledAt),
    coverAssetId: article.coverAssetId,
    slug: article.slug,
    blocks: Array.isArray(article.body) ? (article.body as EditorArticle["blocks"]) : [],
  };

  return (
    <div>
      <Link href="/admin/articles" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-ink-3 hover:text-ink">
        ‹ Retour aux articles
      </Link>
      <ArticleEditor
        initial={initial}
        rubriques={rubriques}
        canPublish={PUBLISH_ROLES.includes((session?.user?.role ?? "") as (typeof PUBLISH_ROLES)[number])}
        authorName={article.author.name}
        mediaOptions={mediaOptions}
      />
    </div>
  );
}
