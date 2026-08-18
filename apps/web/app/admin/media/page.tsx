import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { MediaUpload } from "@/components/admin/media-upload";
import { MediaEdit } from "@/components/admin/media-edit";
import { MediaDeleteButton } from "@/components/admin/media-delete-button";
import { PlaceholderMedia } from "@/components/placeholder-media";
import { Pagination } from "@/components/admin/pagination";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Médiathèque · Studio" };
export const dynamic = "force-dynamic";

/** Visuels par page. Divisible par 2, 3 et 4 : les rangées de la grille restent
 *  pleines à toutes les largeurs. */
const PAR_PAGE = 60;

export default async function AdminMedia({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageBrute } = await searchParams;

  // Le total d'abord : il donne le nombre de pages, donc la borne dans laquelle
  // rabattre un numéro farfelu avant d'interroger la base. Sans ce garde-fou,
  // « ?page=9999 » renverrait une grille vide sans rien expliquer.
  const total = await prisma.mediaAsset.count();
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const page = Math.min(pages, Math.max(1, Number(pageBrute) || 1));

  const assets = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAR_PAGE,
    take: PAR_PAGE,
    include: {
      uploadedBy: { select: { name: true } },
      _count: { select: { articlesAsCover: true } },
    },
  });

  return (
    <div>
      <h1 className="mb-6 text-lg font-bold">Médiathèque</h1>
      <MediaUpload />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {assets.map((a) => (
          <div key={a.id} className="overflow-hidden rounded-[12px] border border-line bg-surface shadow-[var(--shadow-sm)]">
            <PlaceholderMedia url={a.url} alt={a.alt} className="h-[140px] w-full" />
            <div className="px-3.5 py-3">
              <div className="truncate text-[12.5px] font-semibold">{a.alt ?? a.url.split("/").pop()}</div>
              <div className="mt-0.5 text-[11px] text-ink-3">
                {a.type} · {a.sizeBytes ? `${Math.round(a.sizeBytes / 1024)} Ko · ` : ""}
                {formatDate(a.createdAt)} · {a.uploadedBy.name}
                {a._count.articlesAsCover > 0 ? ` · à la une ×${a._count.articlesAsCover}` : ""}
              </div>
              <div className="mt-2 flex items-start gap-2">
                <MediaDeleteButton id={a.id} />
                <MediaEdit asset={{ id: a.id, alt: a.alt, credit: a.credit }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      {assets.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-ink-3">Bibliothèque vide — téléversez un premier visuel.</p>
      ) : (
        <Pagination
          page={page}
          pages={pages}
          total={total}
          debut={(page - 1) * PAR_PAGE + 1}
          fin={(page - 1) * PAR_PAGE + assets.length}
          base="/admin/media"
          libelle="visuels"
        />
      )}
    </div>
  );
}
