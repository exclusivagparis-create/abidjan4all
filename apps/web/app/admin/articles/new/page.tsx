import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { ArticleEditor, type EditorArticle } from "@/components/admin/article-editor";

export const metadata: Metadata = { title: "Nouvel article · Studio" };
export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  const [session, rubriques] = await Promise.all([
    auth(),
    prisma.rubrique.findMany({ orderBy: { order: "asc" }, select: { id: true, slug: true, name: true, color: true } }),
  ]);

  const initial: EditorArticle = {
    id: null,
    title: "",
    kicker: "",
    dek: "",
    rubriqueId: "",
    premium: false,
    tags: [],
    status: "draft",
    scheduledAt: null,
    slug: null,
    blocks: [{ type: "paragraph", text: "" }],
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
        authorName={session?.user?.name ?? "—"}
      />
    </div>
  );
}
