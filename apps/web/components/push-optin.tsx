"use client";

import { useEffect, useState } from "react";

/** Convertit la clé VAPID publique base64url en Uint8Array pour PushManager. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type PushState = "loading" | "unsupported" | "no-key" | "denied" | "subscribed" | "idle" | "busy";

/**
 * Opt-in aux alertes Web Push (DF-04) : breaking news et alertes rubrique
 * (filtrées par vos intérêts si vous êtes connecté).
 */
export function PushOptIn() {
  const [state, setState] = useState<PushState>("loading");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState("unsupported");
    if (!publicKey) return setState("no-key");
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "subscribed" : "idle"))
      .catch(() => setState("unsupported"));
  }, [publicKey]);

  async function subscribe() {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey!) as BufferSource,
      });
      const body = sub.toJSON();
      const res = await fetch("/api/v1/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: body.endpoint, keys: body.keys }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("subscribed");
    } catch {
      setState(Notification.permission === "denied" ? "denied" : "idle");
    }
  }

  async function unsubscribe() {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/v1/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("idle");
    } catch {
      setState("subscribed");
    }
  }

  if (state === "loading" || state === "unsupported" || state === "no-key") return null;

  return (
    <section className="mb-8 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.06em] text-ink-3">Alertes info</h2>
          <p className="mt-1.5 max-w-[48ch] font-serif text-[14px] text-ink-2">
            {state === "subscribed"
              ? "Vous recevez les alertes de publication — filtrées selon vos rubriques suivies."
              : state === "denied"
                ? "Les notifications sont bloquées par votre navigateur pour ce site."
                : "Recevez une notification à la publication des articles de vos rubriques suivies."}
          </p>
        </div>
        {state === "denied" ? null : state === "subscribed" ? (
          <button
            type="button"
            onClick={unsubscribe}
            className="rounded-pill border border-line bg-surface-2 px-4 py-2.5 text-xs font-semibold text-ink"
          >
            Désactiver
          </button>
        ) : (
          <button
            type="button"
            onClick={subscribe}
            disabled={state === "busy"}
            className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on disabled:opacity-60"
          >
            {state === "busy" ? "Activation…" : "Activer les alertes"}
          </button>
        )}
      </div>
    </section>
  );
}
