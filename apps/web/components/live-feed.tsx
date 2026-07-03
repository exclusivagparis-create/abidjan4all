"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveUpdateDTO } from "@/lib/live";
import { PlaceholderMedia } from "./placeholder-media";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Fil en direct (Live Blog.dc.html) : timeline SSR + EventSource sur
 * /api/v1/liveblogs/:id/stream — les nouvelles updates arrivent sans rechargement.
 */
export function LiveFeed({
  liveBlogId,
  initialUpdates,
  live,
}: {
  liveBlogId: string;
  initialUpdates: LiveUpdateDTO[];
  live: boolean;
}) {
  const [updates, setUpdates] = useState(initialUpdates);
  const [connected, setConnected] = useState(false);
  const [ended, setEnded] = useState(!live);
  const latestId = useRef(initialUpdates[0]?.id);

  useEffect(() => {
    if (!live) return;
    const since = initialUpdates[0]?.time ?? new Date().toISOString();
    const es = new EventSource(
      `/api/v1/liveblogs/${liveBlogId}/stream?since=${encodeURIComponent(since)}`
    );
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener("update", (e) => {
      const update = JSON.parse((e as MessageEvent).data) as LiveUpdateDTO;
      latestId.current = update.id;
      setUpdates((prev) => (prev.some((u) => u.id === update.id) ? prev : [update, ...prev]));
    });
    es.addEventListener("ended", () => {
      setEnded(true);
      es.close();
    });
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveBlogId, live]);

  const pinned = updates.filter((u) => u.pinned);

  return (
    <div className="grid grid-cols-1 items-start gap-9 lg:grid-cols-[1fr_300px]">
      <div>
        <div className="mb-[18px] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-3">Fil en direct</span>
          {ended ? (
            <span className="rounded-pill bg-surface-2 px-3 py-[5px] text-xs font-semibold text-ink-3">
              Direct terminé
            </span>
          ) : (
            <span className="inline-flex items-center gap-[7px] rounded-pill bg-[rgba(14,138,95,0.1)] px-3 py-[5px] text-xs font-semibold text-green">
              <span
                className={`h-[7px] w-[7px] rounded-pill bg-green ${connected ? "[animation:a4a-pulse_1.4s_infinite]" : "opacity-40"}`}
              />
              {connected ? "Mise à jour auto" : "Reconnexion…"}
            </span>
          )}
        </div>

        {updates.length === 0 ? (
          <p className="border-t border-line-2 py-10 text-center font-serif text-ink-3">
            Les premières mises à jour arrivent bientôt.
          </p>
        ) : (
          updates.map((u, i) => (
            <UpdateRow key={u.id} update={u} isLatest={i === 0 && !ended} flash={u.id === latestId.current && i === 0} />
          ))
        )}
      </div>

      {/* Faits clés (épinglés) */}
      <aside className="lg:sticky lg:top-[86px]">
        <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 bg-navy px-[18px] py-3.5">
            <span className="text-sm text-[#F5C24B]">📌</span>
            <span className="text-[12.5px] font-bold tracking-[0.04em] text-white">Faits clés</span>
          </div>
          <div className="px-[18px] py-1.5">
            {pinned.length === 0 ? (
              <p className="py-3 text-[12.5px] text-ink-3">Aucun fait épinglé pour l&apos;instant.</p>
            ) : (
              pinned.map((u) => (
                <div key={u.id} className="border-b border-line-2 py-3 last:border-b-0">
                  <div className="mb-1 text-[11px] font-extrabold text-ink-3">{formatTime(u.time)}</div>
                  {u.title ? <div className="mb-0.5 font-serif text-[15px] font-semibold leading-[1.25]">{u.title}</div> : null}
                  <div className="font-serif text-[13.5px] leading-normal text-ink-2">{u.body}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function UpdateRow({ update: u, isLatest, flash }: { update: LiveUpdateDTO; isLatest: boolean; flash: boolean }) {
  const dot = isLatest ? "var(--red)" : u.type === "stat" ? "var(--orange)" : "var(--navy-2)";
  return (
    <div className="relative border-l-2 border-line pb-6 pl-[26px]">
      <span
        className="absolute -left-[7px] top-0.5 h-3 w-3 rounded-pill shadow-[0_0_0_4px_var(--bg)]"
        style={{ background: dot }}
      />
      <div className={flash ? "-m-2 rounded-[10px] p-2 [animation:a4a-flash_2.5s_ease-out]" : ""}>
        <div className="mb-[7px] flex items-center gap-[9px]">
          <span className={`text-[12.5px] font-extrabold ${isLatest ? "text-red" : "text-ink-3"}`}>
            {formatTime(u.time)}
          </span>
          {isLatest ? (
            <span className="rounded-pill bg-red px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.05em] text-white">
              Nouveau
            </span>
          ) : null}
          {u.pinned ? <span className="text-[11px]">📌</span> : null}
        </div>

        {u.type === "quote" ? (
          <>
            {u.title ? <h3 className="mb-2.5 font-serif text-xl font-semibold leading-[1.22]">{u.title}</h3> : null}
            <blockquote className="border-l-[3px] border-orange py-1 pl-[18px]">
              <p className="font-serif text-[21px] font-medium italic leading-[1.35]">{u.body}</p>
            </blockquote>
          </>
        ) : u.type === "stat" ? (
          <div className="rounded-md border border-line bg-surface-2 px-5 py-[18px]">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-orange">Chiffre clé</div>
            {u.title ? <div className="mb-1 font-serif text-[30px] font-medium leading-tight">{u.title}</div> : null}
            <div className="font-serif text-[15px] text-ink-2">{u.body}</div>
          </div>
        ) : (
          <>
            {u.title ? <h3 className="mb-2 font-serif text-[21px] font-semibold leading-[1.22]">{u.title}</h3> : null}
            <p className="font-serif text-[16.5px] leading-[1.6] text-ink-2">{u.body}</p>
            {u.type === "media" ? (
              <PlaceholderMedia url={u.mediaUrl ?? `placeholder://${u.body}`} alt={u.mediaAlt} className="mt-3 h-[220px] w-full rounded-md" />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
