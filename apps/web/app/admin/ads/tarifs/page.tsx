import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type AdFormat } from "@a4a/db";
import { auth } from "@/auth";
import {
  createPackAction,
  updatePackAction,
  setPackActifAction,
  deletePackAction,
} from "@/lib/actions/pack-actions";
import { formatFCFA } from "@/lib/tarifs";

export const metadata: Metadata = { title: "Grille des prix · Studio" };
export const dynamic = "force-dynamic";

const FORMAT_LABEL: Record<AdFormat, string> = {
  leaderboard_728x90: "Bandeau 728×90",
  mpu_300x250: "Pavé 300×250",
  native: "Natif in-feed",
  interstitial: "Interstitiel",
  skin: "Habillage",
  video: "Encart vidéo",
};

const field =
  "w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-ink-3";
const btn = "rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-[11.5px] font-semibold text-ink-2 hover:text-ink";

export default async function AdminTarifs({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  if (!["admin", "ad_manager"].includes(session?.user?.role ?? "")) redirect("/admin");

  const packs = await prisma.adPack.findMany({ orderBy: [{ ordre: "asc" }, { jours: "asc" }] });

  return (
    <div>
      <Link href="/admin/ads" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-ink-3 hover:text-ink">
        ‹ Retour à la régie
      </Link>
      <h1 className="mb-1 text-lg font-bold">Grille des prix des packs</h1>
      <p className="mb-6 max-w-[72ch] text-[12.5px] text-ink-3">
        Les packs proposés à la réservation en ligne (page « Réserver un emplacement »). Les modifications sont
        immédiates ; un pack <b>retiré de la vente</b> disparaît du formulaire public mais reste dans l&apos;historique
        des commandes déjà passées.
      </p>

      {erreur ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
          {erreur === "utilise"
            ? "Ce pack a déjà des commandes — retirez-le de la vente plutôt que de le supprimer."
            : "Pack invalide — vérifiez le libellé, la durée (jours entiers) et le prix (FCFA entiers)."}
        </p>
      ) : null}

      {/* Packs existants */}
      <div className="mb-6 grid gap-3">
        {packs.map((p) => (
          <div key={p.id} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="font-serif text-[16px] font-bold">{p.label}</span>
              <span className="rounded-pill border border-line bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-ink-2">
                {FORMAT_LABEL[p.format]}
              </span>
              <span className="text-[12px] text-ink-3">
                {p.jours} jours · <b className="text-ink">{formatFCFA(p.prix)}</b>
              </span>
              <span
                className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold"
                style={{ color: p.actif ? "var(--green)" : "var(--ink-3)" }}
              >
                <span className="h-[7px] w-[7px] rounded-pill" style={{ background: p.actif ? "var(--green)" : "var(--ink-3)" }} />
                {p.actif ? "En vente" : "Retiré de la vente"}
              </span>
            </div>

            <form action={updatePackAction.bind(null, p.id)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
              <label className="grid gap-1 text-[11px] font-semibold text-ink-3 lg:col-span-3">
                Libellé
                <input name="label" defaultValue={p.label} maxLength={80} required className={field} />
              </label>
              <label className="grid gap-1 text-[11px] font-semibold text-ink-3 lg:col-span-2">
                Format
                <select name="format" defaultValue={p.format} className={field}>
                  {(Object.keys(FORMAT_LABEL) as AdFormat[]).map((f) => (
                    <option key={f} value={f}>
                      {FORMAT_LABEL[f]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-[11px] font-semibold text-ink-3 lg:col-span-1">
                Jours
                <input name="jours" type="number" min={1} step={1} defaultValue={p.jours} required className={field} />
              </label>
              <label className="grid gap-1 text-[11px] font-semibold text-ink-3 lg:col-span-2">
                Prix (FCFA)
                <input name="prix" type="number" min={1} step={1} defaultValue={p.prix} required className={field} />
              </label>
              <label className="grid gap-1 text-[11px] font-semibold text-ink-3 lg:col-span-1">
                Ordre
                <input name="ordre" type="number" step={1} defaultValue={p.ordre} className={field} />
              </label>
              <label className="grid gap-1 text-[11px] font-semibold text-ink-3 sm:col-span-2 lg:col-span-3">
                Description (formulaire public)
                <input name="description" defaultValue={p.description} maxLength={200} className={field} />
              </label>
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-12">
                <button type="submit" className="rounded-pill bg-red px-4 py-2 text-[12px] font-bold text-white">
                  Enregistrer
                </button>
              </div>
            </form>

            <div className="mt-2 flex flex-wrap gap-2 border-t border-line-2 pt-3">
              <form action={setPackActifAction.bind(null, p.id)}>
                <input type="hidden" name="actif" value={p.actif ? "0" : "1"} />
                <button type="submit" className={btn}>
                  {p.actif ? "Retirer de la vente" : "Remettre en vente"}
                </button>
              </form>
              <form action={deletePackAction.bind(null, p.id)}>
                <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-red">
                  Supprimer
                </button>
              </form>
            </div>
          </div>
        ))}
        {packs.length === 0 ? (
          <p className="rounded-[14px] border border-line bg-surface-2 px-5 py-6 text-center text-[13px] text-ink-3">
            Aucun pack en base — la grille par défaut (lib/tarifs.ts) est servie au public. Créez un premier pack
            ci-dessous pour reprendre la main.
          </p>
        ) : null}
      </div>

      {/* Nouveau pack */}
      <section className="rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-1 text-sm font-bold">Nouveau pack</h2>
        <p className="mb-4 text-[12.5px] text-ink-3">
          Un format, une durée, un prix forfaitaire. Il apparaît immédiatement sur le formulaire de réservation.
        </p>
        <form action={createPackAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <label className="grid gap-1 text-[11px] font-semibold text-ink-3 lg:col-span-3">
            Libellé
            <input name="label" maxLength={80} required placeholder="Bandeau 728×90 — 45 jours" className={field} />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-ink-3 lg:col-span-2">
            Format
            <select name="format" className={field}>
              {(Object.keys(FORMAT_LABEL) as AdFormat[]).map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABEL[f]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-ink-3 lg:col-span-1">
            Jours
            <input name="jours" type="number" min={1} step={1} required className={field} />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-ink-3 lg:col-span-2">
            Prix (FCFA)
            <input name="prix" type="number" min={1} step={1} required className={field} />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-ink-3 lg:col-span-1">
            Ordre
            <input name="ordre" type="number" step={1} defaultValue={0} className={field} />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-ink-3 sm:col-span-2 lg:col-span-3">
            Description (formulaire public)
            <input name="description" maxLength={200} className={field} />
          </label>
          <div className="sm:col-span-2 lg:col-span-12">
            <button type="submit" className="rounded-pill bg-red px-5 py-2.5 text-[13px] font-bold text-white">
              Ajouter le pack
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
