"use client";

import { useActionState } from "react";
import { addComment, type CommentResult } from "@/lib/actions/comment-actions";

export function CommentForm({ articleId }: { articleId: string }) {
  const [result, formAction, pending] = useActionState<CommentResult | undefined, FormData>(
    addComment.bind(null, articleId),
    undefined
  );

  if (result?.ok) {
    return (
      <p className="rounded-md border border-line bg-surface-2 px-4 py-3 text-[13px] font-semibold text-green">
        Merci ! Votre commentaire est en attente de modération.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <textarea
        name="body"
        required
        rows={3}
        placeholder="Votre commentaire — courtois et argumenté."
        className="w-full resize-y rounded-md border border-line bg-surface px-4 py-3 font-serif text-[15px] text-ink outline-none placeholder:text-ink-3 focus:border-ink-3"
      />
      {result && !result.ok ? (
        <p className="text-[12.5px] font-semibold text-red">{result.error}</p>
      ) : null}
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] text-ink-3">Les commentaires sont modérés avant publication.</span>
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-brand-fill px-5 py-2.5 text-[13px] font-bold text-brand-on disabled:opacity-60"
        >
          {pending ? "Envoi…" : "Commenter"}
        </button>
      </div>
    </form>
  );
}
