import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { createFicheAction } from "@/lib/actions/guide-actions";
import { REGIONS, avancement } from "@/lib/guide";

export const metadata: Metadata = { title: "Guide de l'Afrique · Studio" };
export const dynamic = "force-dynamic";

const ERREURS: Record<string, string> = {
  titre: "Titre requis — deux caractères au minimum.",
  doublon: "Une fiche porte déjà ce titre.",
};

export default async function AdminGuide({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const fiches = await prisma.guideFiche.findMany({ orderBy: [{ order: "asc" }, { title: "asc" }] });
  const inp = "rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]";

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">Guide de l&apos;Afrique</h1>
      <p className="mb-6 max-w-[75ch] text-[12.5px] text-ink-3">
        Des fiches de fond — pays, peuples, institutions, traditions — qui ne vieillissent pas et qu&apos;on complète au
        fil du temps. Chaque fiche se remplit case par case : encadré d&apos;identité, puis histoire, culture, société,
        économie. Une fiche reste invisible tant qu&apos;elle n&apos;est pas publiée.
      </p>

      {erreur && ERREURS[erreur] ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">{ERREURS[erreur]}</p>
      ) : null}

      <section className="mb-6 rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Nouvelle fiche</div>
        <form action={createFicheAction} className="flex flex-wrap items-end gap-3">
          <label className="grid flex-1 gap-1.5 text-xs font-semibold text-ink-2">
            Titre
            <input name="title" required maxLength={120} placeholder="Côte d&apos;Ivoire" className={inp} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
            Type
            <select name="kind" className={inp}>
              <option value="pays">Pays</option>
              <option value="theme">Thème</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
            Région
            <select name="region" className={inp}>
              <option value="">—</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">Créer</button>
        </form>
      </section>

      <div className="overflow-x-auto rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        <div className="grid min-w-[720px] grid-cols-[1fr_120px_140px_110px_90px] gap-3 border-b border-line bg-surface-2 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
          <span>Fiche</span><span>Type</span><span>Région</span><span>Avancement</span><span>État</span>
        </div>
        {fiches.map((f) => {
          const part = avancement(f);
          return (
            <Link
              key={f.id}
              href={`/admin/guide/${f.id}`}
              className="grid min-w-[720px] grid-cols-[1fr_120px_140px_110px_90px] items-center gap-3 border-b border-line-2 px-5 py-3 last:border-b-0 hover:bg-surface-2"
            >
              <span className="truncate text-[13.5px] font-semibold">{f.title}</span>
              <span className="text-[12.5px] text-ink-2">{f.kind === "theme" ? "Thème" : "Pays"}</span>
              <span className="truncate text-[12.5px] text-ink-3">{f.region ?? "—"}</span>
              <span className="flex items-center gap-2">
                {/* La barre dit d'un coup d'œil ce qui reste à écrire : une fiche
                    se complète à plusieurs mains et sur plusieurs semaines. */}
                <span className="h-1.5 w-[52px] overflow-hidden rounded-pill bg-line">
                  <span className="block h-full rounded-pill bg-green" style={{ width: `${part}%` }} />
                </span>
                <span className="text-[12px] tabular-nums text-ink-3">{part}%</span>
              </span>
              <span className={`text-[12px] font-bold ${f.published ? "text-green" : "text-ink-3"}`}>
                {f.published ? "Publiée" : "Brouillon"}
              </span>
            </Link>
          );
        })}
        {fiches.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-ink-3">Aucune fiche pour l&apos;instant.</p>
        ) : null}
      </div>
    </div>
  );
}
