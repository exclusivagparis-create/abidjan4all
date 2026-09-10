import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { ArticleEditor, type EditorArticle } from "@/components/admin/article-editor";
import { motsClesConnus } from "@/lib/actions/article-actions";

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
  const [session, article, rubriques, mediaRecents, auteurs, motsCles] = await Promise.all([
    auth(),
    prisma.article.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true } },
        coverAsset: { select: { id: true, url: true, alt: true } },
      },
    }),
    prisma.rubrique.findMany({ orderBy: { order: "asc" }, select: { id: true, slug: true, name: true, color: true } }),
    prisma.mediaAsset.findMany({
      where: { type: { in: ["image", "svg"] } },
      orderBy: { createdAt: "desc" },
      take: 500, // le sélecteur défile et se recherche ; plafond large de sécurité
      select: { id: true, url: true, alt: true },
    }),
    // Signataires possibles : les comptes de la rédaction. Chargé pour tous,
    // mais transmis à l'éditeur seulement si le rôle permet de signer — ce
    // n'est pas une donnée sensible, et l'éviter coûterait une requête en
    // cascade pour un gain nul.
    prisma.user.findMany({
      where: { role: { in: ["journalist", "editor", "admin"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
    motsClesConnus(),
  ]);
  if (!article) notFound();

  // La couverture actuelle doit toujours figurer dans la liste, même si c'est
  // un ancien visuel hors des 23 plus récents : sinon le sélecteur ne la montre
  // pas et le contrôle « vraie couverture » de l'éditeur la croit absente.
  const mediaOptions =
    article.coverAsset && !mediaRecents.some((m) => m.id === article.coverAsset!.id)
      ? [article.coverAsset, ...mediaRecents]
      : mediaRecents;

  const initial: EditorArticle = {
    id: article.id,
    title: article.title,
    kicker: article.kicker ?? "",
    dek: article.dek ?? "",
    rubriqueId: article.rubriqueId,
    premium: article.premium,
    sponsored: article.sponsored,
    sponsorName: article.sponsorName ?? "",
    tags: article.tags,
    status: article.status,
    scheduledAt: toLocalInput(article.scheduledAt),
    coverAssetId: article.coverAssetId,
    coverCaption: article.coverCaption ?? "",
    featuredRank: article.featuredRank,
    hidden: article.hidden,
    slug: article.slug,
    blocks: Array.isArray(article.body) ? (article.body as EditorArticle["blocks"]) : [],
    authorId: article.authorId,
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
        auteurs={auteurs}
        motsCles={motsCles.map((m) => m.mot)}
      />
    </div>
  );
}
