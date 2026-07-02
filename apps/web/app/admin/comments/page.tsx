import Link from "next/link";
import type { Metadata } from "next";
import { prisma, type CommentStatus } from "@a4a/db";
import { moderateComment } from "@/lib/actions/comment-actions";
import { formatDate, initials } from "@/lib/format";

export const metadata: Metadata = { title: "Commentaires · Studio" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<CommentStatus, { label: string; color: string }> = {
  pending: { label: "En attente", color: "var(--orange)" },
  approved: { label: "Approuvé", color: "var(--green)" },
  rejected: { label: "Rejeté", color: "var(--red)" },
  flagged: { label: "Signalé", color: "var(--red)" },
};

export default async function AdminComments() {
  const comments = await prisma.comment.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      body: true,
      status: true,
      createdAt: true,
      user: { select: { name: true } },
      article: { select: { title: true, slug: true, rubrique: { select: { slug: true } } } },
    },
  });
  const pending = comments.filter((c) => c.status === "pending" || c.status === "flagged");
  const others = comments.filter((c) => c.status === "approved" || c.status === "rejected");

  return (
    <div>
      <h1 className="mb-6 text-lg font-bold">Commentaires</h1>

      <Section title="File de modération" count={pending.length}>
        {pending.length === 0 ? (
          <p className="py-4 text-[13px] text-ink-3">Aucun commentaire en attente. 🎉</p>
        ) : (
          pending.map((c) => <Row key={c.id} comment={c} showActions />)
        )}
      </Section>

      <Section title="Modérés récemment" count={others.length}>
        {others.map((c) => (
          <Row key={c.id} comment={c} showActions={false} />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="text-sm font-bold">{title}</span>
        <span className="rounded-pill bg-surface-2 px-2.5 py-0.5 text-[11px] font-bold text-ink-3">{count}</span>
      </div>
      {children}
    </div>
  );
}

function Row({
  comment: c,
  showActions,
}: {
  comment: {
    id: string;
    body: string;
    status: CommentStatus;
    createdAt: Date;
    user: { name: string };
    article: { title: string; slug: string; rubrique: { slug: string } };
  };
  showActions: boolean;
}) {
  const meta = STATUS_LABEL[c.status];
  const approve = async () => {
    "use server";
    await moderateComment(c.id, "approved");
  };
  const reject = async () => {
    "use server";
    await moderateComment(c.id, "rejected");
  };

  return (
    <div className="flex flex-wrap items-start gap-4 border-b border-line-2 py-3.5 last:border-b-0">
      <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-[linear-gradient(135deg,#2E5AAC,#0E8A5F)] text-[11px] font-bold text-white">
        {initials(c.user.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
          <span className="font-bold text-ink">{c.user.name}</span>
          <span>· {formatDate(c.createdAt)} · sur</span>
          <Link
            href={`/${c.article.rubrique.slug}/${c.article.slug}`}
            className="truncate font-serif font-semibold text-ink hover:underline"
          >
            {c.article.title}
          </Link>
          <span className="inline-flex items-center gap-1.5 font-bold" style={{ color: meta.color }}>
            <span className="h-[7px] w-[7px] rounded-pill" style={{ background: meta.color }} />
            {meta.label}
          </span>
        </div>
        <p className="font-serif text-[14.5px] leading-relaxed text-ink-2">{c.body}</p>
      </div>
      {showActions ? (
        <div className="flex gap-2">
          <form action={approve}>
            <button
              type="submit"
              className="rounded-pill bg-green px-4 py-2 text-xs font-bold text-white"
            >
              Approuver
            </button>
          </form>
          <form action={reject}>
            <button
              type="submit"
              className="rounded-pill border border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-ink"
            >
              Rejeter
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
