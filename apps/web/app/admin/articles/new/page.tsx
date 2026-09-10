import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { ArticleEditor, type EditorArticle } from "@/components/admin/article-editor";
import { motsClesConnus } from "@/lib/actions/article-actions";

export const metadata: Metadata = { title: "Nouvel article · Studio" };
export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  const [session, rubriques, mediaOptions, motsCles] = await Promise.all([
    auth(),
    prisma.rubrique.findMany({ orderBy: { order: "asc" }, select: { id: true, slug: true, name: true, color: true } }),
    prisma.mediaAsset.findMany({
      where: { type: { in: ["image", "svg"] } },
      orderBy: { createdAt: "desc" },
      take: 500, // le sélecteur défile et se recherche ; plafond large de sécurité
      select: { id: true, url: true, alt: true },
    }),
    motsClesConnus(),
  ]);

  const initial: EditorArticle = {
    id: null,
    title: "",
    kicker: "",
    dek: "",
    rubriqueId: "",
    premium: false,
    sponsored: false,
    sponsorName: "",
    tags: [],
    status: "draft",
    scheduledAt: null,
    coverAssetId: null,
    coverCaption: "",
    featuredRank: null,
    hidden: false,
    slug: null,
    blocks: [{ type: "paragraph", text: "" }],
    // À la création, la signature est celle du rédacteur connecté ; le serveur
    // l'impose de toute façon (saveArticle n'accepte `authorId` qu'en mise à
    // jour). Le sélecteur d'auteur n'apparaît donc qu'une fois l'article créé.
    authorId: session?.user?.id ?? "",
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
        mediaOptions={mediaOptions}
        motsCles={motsCles.map((m) => m.mot)}
      />
    </div>
  );
}
