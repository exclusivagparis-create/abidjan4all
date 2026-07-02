import type { ArticleStatus } from "@a4a/db";

export const STATUS_META: Record<ArticleStatus, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "var(--ink-3)" },
  review: { label: "Révision", color: "var(--orange)" },
  scheduled: { label: "Programmé", color: "var(--navy-2)" },
  published: { label: "Publié", color: "var(--green)" },
};

/** Pastille + libellé de statut (table des articles du CMS). */
export function StatusChip({ status }: { status: ArticleStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11.5px] font-bold"
      style={{ color: meta.color }}
    >
      <span className="h-[7px] w-[7px] rounded-pill" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}
