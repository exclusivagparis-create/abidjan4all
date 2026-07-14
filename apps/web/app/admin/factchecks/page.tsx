import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type FactCheckVerdict } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { createFactCheckAction, deleteFactCheckAction, updateFactCheckAction } from "@/lib/actions/factcheck-actions";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Fact-checking · Studio" };
export const dynamic = "force-dynamic";

const VERDICT_META: Record<FactCheckVerdict, { label: string; color: string }> = {
  vrai: { label: "Vrai", color: "#0E8A5F" },
  faux: { label: "Faux", color: "#a01520" },
  trompeur: { label: "Trompeur", color: "#E8641A" },
  a_verifier: { label: "À vérifier", color: "#6C7791" },
};
const VERDICTS = Object.keys(VERDICT_META) as FactCheckVerdict[];

export default async function AdminFactChecks({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const items = await prisma.factCheck.findMany({ orderBy: { publishedAt: "desc" }, take: 100 });
  const inp = "rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]";

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">Fact-checking — A4A Vérifie</h1>
      <p className="mb-6 max-w-[70ch] text-[12.5px] text-ink-3">
        Vérifications publiées sur <code>/verifie</code>. Une affirmation, un verdict, une explication sourcée.
      </p>

      {erreur ? <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">Affirmation (≥5 car.), verdict et explication (≥10 car.) requis.</p> : null}

      <section className="mb-6 rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Nouvelle vérification</div>
        <form action={createFactCheckAction} className="grid gap-3">
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Affirmation vérifiée<input name="claim" required maxLength={300} placeholder="« La Côte d'Ivoire produit 60 % du cacao mondial »" className={inp} /></label>
          <div className="flex flex-wrap gap-3">
            <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Verdict
              <select name="verdict" className={inp}>{VERDICTS.map((v) => <option key={v} value={v}>{VERDICT_META[v].label}</option>)}</select>
            </label>
            <label className="grid flex-1 gap-1.5 text-xs font-semibold text-ink-2">Thème<input name="topic" placeholder="Économie" className={inp} /></label>
          </div>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Explication<textarea name="body" required rows={3} maxLength={4000} className={inp} /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">Sources (une par ligne)<textarea name="sources" rows={2} placeholder="https://…" className={inp} /></label>
          <button type="submit" className="justify-self-start rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">Publier</button>
        </form>
      </section>

      <div className="grid gap-3">
        {items.map((f) => {
          const meta = VERDICT_META[f.verdict];
          return (
            <details key={f.id} className="rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <span className="rounded px-2 py-0.5 text-[10.5px] font-bold uppercase text-white" style={{ background: meta.color }}>{meta.label}</span>
                <span className="min-w-0 flex-1 font-semibold">{f.claim}</span>
                <span className="text-[11.5px] text-ink-3">{f.topic} · {formatDate(f.publishedAt)}</span>
              </summary>
              <form action={updateFactCheckAction.bind(null, f.id)} className="mt-3 grid gap-2.5 border-t border-line-2 pt-3">
                <input name="claim" defaultValue={f.claim} className={inp} />
                <div className="flex flex-wrap gap-2.5">
                  <select name="verdict" defaultValue={f.verdict} className={inp}>{VERDICTS.map((v) => <option key={v} value={v}>{VERDICT_META[v].label}</option>)}</select>
                  <input name="topic" defaultValue={f.topic} className={`${inp} flex-1`} />
                </div>
                <textarea name="body" defaultValue={f.body} rows={3} className={inp} />
                <textarea name="sources" defaultValue={f.sources.join("\n")} rows={2} className={inp} />
                <div className="flex gap-2">
                  <button type="submit" className="rounded-pill bg-brand-fill px-3.5 py-1.5 text-[11.5px] font-bold text-brand-on">Enregistrer</button>
                  <button type="submit" formAction={deleteFactCheckAction.bind(null, f.id)} className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3.5 py-1.5 text-[11.5px] font-semibold text-red">Supprimer</button>
                </div>
              </form>
            </details>
          );
        })}
        {items.length === 0 ? <p className="rounded-[14px] border border-line bg-surface px-5 py-8 text-center text-[13px] text-ink-3">Aucune vérification.</p> : null}
      </div>
    </div>
  );
}
