"use client";

import Link from "next/link";
import { useState } from "react";
import { startAdReservationAction } from "@/lib/actions/order-actions";
import { formatFCFA, type PackPub } from "@/lib/tarifs";

const field = "w-full rounded-[8px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-ink-3";
const lbl = "grid gap-1.5 text-xs font-semibold text-ink-2";

const METHODES: Array<[string, string]> = [
  ["momo", "MTN MoMo"],
  ["orange", "Orange Money"],
  ["wave", "Wave"],
  ["moov", "Moov Money"],
  ["djamo", "Djamo"],
  ["card", "Carte bancaire"],
  ["paypal", "PayPal"],
];

const FORMAT_LABEL: Record<string, string> = {
  leaderboard_728x90: "Bandeau 728×90",
  mpu_300x250: "Pavé 300×250",
  native: "Natif in-feed",
  interstitial: "Interstitiel mobile",
  skin: "Habillage du site",
  video: "Encart vidéo",
};

export function ReservationForm({ connected, packs }: { connected: boolean; packs: PackPub[] }) {
  // Regroupe les packs par format, dans l'ordre de la grille (éditable au Studio).
  const parFormat = [...new Set(packs.map((p) => p.format))].map((format) => ({
    format,
    packs: packs.filter((p) => p.format === format),
  }));
  const [pack, setPack] = useState<PackPub>(packs[0]!);

  if (packs.length === 0) {
    return (
      <div className="rounded-[14px] border border-line bg-surface-2 p-6 text-center">
        <p className="font-serif text-[15px] text-ink-2">
          La réservation en ligne est momentanément fermée — contactez la régie via la page Publicité.
        </p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="rounded-[14px] border border-line bg-surface-2 p-6 text-center">
        <p className="mb-3 font-serif text-[15px] text-ink-2">Connectez-vous pour réserver et payer un emplacement.</p>
        <Link href="/login?next=/publicite/reserver" className="inline-block rounded-pill bg-red px-5 py-2.5 text-[13px] font-bold text-white">
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <form action={startAdReservationAction} className="grid gap-5 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
      {/* 1. Choix du pack */}
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">1 · Emplacement &amp; durée</legend>
        {parFormat.map((g) => (
          <div key={g.format}>
            <div className="mb-1.5 text-[12.5px] font-bold text-ink">{FORMAT_LABEL[g.format] ?? g.format}</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {g.packs.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer flex-col gap-0.5 rounded-[10px] border px-3.5 py-2.5 ${pack.id === p.id ? "border-red bg-[rgba(214,40,45,0.05)]" : "border-line"}`}
                >
                  <span className="flex items-center gap-2">
                    <input type="radio" name="pack" value={p.id} checked={pack.id === p.id} onChange={() => setPack(p)} className="h-4 w-4" />
                    <span className="text-[13px] font-semibold">{p.jours} jours</span>
                  </span>
                  <span className="pl-6 font-serif text-[15px] font-bold text-red">{formatFCFA(p.prix)}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      {/* 2. Créatif */}
      <fieldset className="grid gap-3 border-t border-line-2 pt-4">
        <legend className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">2 · Votre visuel</legend>
        <label className={lbl}>
          Visuel (JPG/PNG/WebP/GIF, 8 Mo max)
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" className="text-[12.5px] text-ink-2 file:mr-3 file:rounded-pill file:border file:border-line file:bg-surface-2 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-ink" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={lbl}>Accroche (repli si pas de visuel)<input name="headline" maxLength={120} placeholder="Abidjan–Paris dès 450 000 FCFA" className={field} /></label>
          <label className={lbl}>Lien de destination<input name="linkUrl" type="url" placeholder="https://…" className={field} /></label>
        </div>
      </fieldset>

      {/* 3. Paiement */}
      <fieldset className="grid gap-3 border-t border-line-2 pt-4">
        <legend className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">3 · Paiement</legend>
        <label className={`${lbl} sm:max-w-[280px]`}>
          Moyen de paiement
          <select name="method" className={field}>
            {METHODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-2 pt-4">
        <span className="text-[13px] text-ink-3">
          Total : <b className="font-serif text-[18px] text-ink">{formatFCFA(pack.prix)}</b> · {pack.jours} jours
        </span>
        <button type="submit" className="rounded-pill bg-red px-7 py-3 text-[14px] font-bold text-white">
          Réserver et payer
        </button>
      </div>
      <p className="text-[11.5px] text-ink-3">
        Après paiement, votre visuel est <b>vérifié par la rédaction</b> (généralement sous 24 h ouvrées) puis mis en
        diffusion pour la durée complète choisie — le temps de validation n&apos;est pas décompté. Vous suivez le statut
        et les performances dans votre espace annonceur. Un visuel non conforme peut être refusé.
      </p>
    </form>
  );
}
