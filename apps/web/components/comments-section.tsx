import Link from "next/link";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";
import { CommentForm } from "./comment-form";
import { formatDate, initials } from "@/lib/format";

/** Commentaires approuvés + formulaire (connecté) — page article. */
export async function CommentsSection({ articleId }: { articleId: string }) {
  const [session, comments] = await Promise.all([
    auth(),
    prisma.comment.findMany({
      where: { articleId, status: "approved" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        body: true,
        reactions: true,
        createdAt: true,
        user: { select: { id: true, name: true, badges: { select: { label: true } } } },
      },
    }),
  ]);

  return (
    <section className="mx-auto max-w-[760px] px-4 sm:px-6 lg:px-8 pb-4 pt-10">
      <div className="mb-5 border-b-2 border-ink pb-3.5 font-serif text-2xl font-semibold">
        Commentaires <span className="text-ink-3">({comments.length})</span>
      </div>

      <div className="mb-8">
        {session?.user ? (
          <CommentForm articleId={articleId} />
        ) : (
          <p className="rounded-md border border-line bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
            <Link href="/login" className="font-bold text-ink underline">
              Connectez-vous
            </Link>{" "}
            pour rejoindre la discussion — les commentaires sont modérés.
          </p>
        )}
      </div>

      {comments.map((c) => {
        const reactions = (c.reactions ?? {}) as Record<string, number>;
        return (
          <div key={c.id} className="border-b border-line-2 py-4 last:border-b-0">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-pill bg-[linear-gradient(135deg,#2E5AAC,#0E8A5F)] text-[11px] font-bold text-white">
                {initials(c.user.name)}
              </span>
              <Link href={`/membre/${c.user.id}`} className="text-[13px] font-bold hover:underline">
                {c.user.name}
              </Link>
              {c.user.badges[0] ? (
                <span className="rounded-pill border border-line bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink-3">
                  {c.user.badges[0].label}
                </span>
              ) : null}
              <span className="text-xs text-ink-3">· {formatDate(c.createdAt)}</span>
            </div>
            <p className="font-serif text-[15.5px] leading-relaxed text-ink">{c.body}</p>
            {Object.keys(reactions).length > 0 ? (
              <div className="mt-2 flex gap-2">
                {Object.entries(reactions).map(([emoji, n]) => (
                  <span key={emoji} className="rounded-pill border border-line bg-surface-2 px-2.5 py-0.5 text-xs">
                    {emoji} {n}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
