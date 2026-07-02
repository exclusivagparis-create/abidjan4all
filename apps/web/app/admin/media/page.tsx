import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { MediaUpload } from "@/components/admin/media-upload";
import { MediaDeleteButton } from "@/components/admin/media-delete-button";
import { PlaceholderMedia } from "@/components/placeholder-media";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Médiathèque · Studio" };
export const dynamic = "force-dynamic";

export default async function AdminMedia() {
  const assets = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
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
              <div className="mt-2">
                <MediaDeleteButton id={a.id} />
              </div>
            </div>
          </div>
        ))}
      </div>
      {assets.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-ink-3">Bibliothèque vide — téléversez un premier visuel.</p>
      ) : null}
    </div>
  );
}
