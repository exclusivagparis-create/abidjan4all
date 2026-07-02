"use client";

import { useState, useTransition } from "react";
import { deleteMedia } from "@/lib/actions/media-actions";

export function MediaDeleteButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await deleteMedia(id);
            if (!r.ok) setError(r.error);
          })
        }
        className="rounded-pill border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-red disabled:opacity-60"
      >
        Supprimer
      </button>
      {error ? <p className="mt-1 text-[11px] font-semibold text-red">{error}</p> : null}
    </>
  );
}
