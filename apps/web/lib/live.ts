import type { LiveUpdate, MediaAsset } from "@a4a/db";

/** Update sérialisée pour le client (dates en ISO, média aplati). */
export interface LiveUpdateDTO {
  id: string;
  time: string;
  type: "text" | "quote" | "stat" | "media";
  title: string | null;
  body: string;
  pinned: boolean;
  mediaUrl: string | null;
  mediaAlt: string | null;
}

export function toLiveUpdateDTO(u: LiveUpdate & { mediaAsset: MediaAsset | null }): LiveUpdateDTO {
  return {
    id: u.id,
    time: u.time.toISOString(),
    type: u.type,
    title: u.title,
    body: u.body,
    pinned: u.pinned,
    mediaUrl: u.mediaAsset?.url ?? null,
    mediaAlt: u.mediaAsset?.alt ?? null,
  };
}
