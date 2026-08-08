import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { kpiBusinessModel, type Kpi } from "@/lib/kpi";

export const metadata: Metadata = { title: "KPI Business Model · Studio" };
export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("fr-FR");

function rendre(k: Kpi): string {
  if (k.valeur === null) return "—";
  if (k.unite === "pourcent") return `${nf.format(k.valeur)} %`;
  if (k.unite === "fcfa") return `${nf.format(k.valeur)} F`;
  return nf.format(k.valeur);
}

export default async function AdminKpi() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");

  const kpis = await kpiBusinessModel();
  const mesures = kpis.filter((k) => k.valeur !== null);
  const manquants = kpis.filter((k) => k.valeur === null);

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">KPI du Business Model 2026-2031</h1>
      <p className="mb-6 max-w-[74ch] text-[12.5px] text-ink-3">
        Les indicateurs de pilotage du business plan (§5.3), mesurés sur les données réelles du site, face aux cibles
        du document. <b>{mesures.length} sur {kpis.length}</b> sont mesurables aujourd&apos;hui ; les autres sont
        listés avec ce qu&apos;il faudrait mettre en place pour les obtenir.
      </p>

      <div className="mb-6 overflow-x-auto rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">
              <th className="px-5 py-3">Indicateur</th>
              <th className="px-3 py-3 text-right">Aujourd&apos;hui</th>
              <th className="px-3 py-3 text-right">Cible 2027</th>
              <th className="px-3 py-3 text-right">Cible 2028</th>
              <th className="px-3 py-3 text-right">Cible 2030</th>
            </tr>
          </thead>
          <tbody>
            {kpis.map((k) => (
              <tr key={k.label} className="border-b border-line-2 last:border-b-0 align-top">
                <td className="px-5 py-3">
                  <div className="font-semibold">{k.label}</div>
                  {k.note ? <div className="mt-1 max-w-[62ch] text-[11.5px] leading-snug text-ink-3">{k.note}</div> : null}
                </td>
                <td className="px-3 py-3 text-right">
                  <span
                    className="font-serif text-[19px] font-bold"
                    style={{ color: k.valeur === null ? "var(--ink-3)" : "var(--ink)" }}
                  >
                    {rendre(k)}
                  </span>
                  {k.valeur === null ? (
                    <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">non mesuré</div>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-right text-[12.5px] text-ink-2">{k.cible2027}</td>
                <td className="px-3 py-3 text-right text-[12.5px] text-ink-2">{k.cible2028}</td>
                <td className="px-3 py-3 text-right text-[12.5px] text-ink-2">{k.cible2030}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {manquants.length > 0 ? (
        <section className="rounded-[14px] border border-line bg-surface-2 px-6 py-5">
          <h2 className="mb-2 text-sm font-bold">Ce qui n&apos;est pas mesurable en l&apos;état</h2>
          <p className="mb-3 max-w-[70ch] text-[12.5px] leading-[1.6] text-ink-2">
            Ces {manquants.length} indicateurs figurent au business plan mais la plateforme ne peut pas les produire
            aujourd&apos;hui. Ils restent affichés « non mesuré » plutôt que remplis d&apos;une estimation : un chiffre
            faux dans un tableau de bord est pire qu&apos;une case vide.
          </p>
          <ul className="grid gap-2">
            {manquants.map((k) => (
              <li key={k.label} className="text-[12.5px] leading-snug text-ink-2">
                <b>{k.label}</b> — {k.note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-6 text-[11.5px] leading-[1.6] text-ink-3">
        Rappel : la mesure d&apos;audience a démarré le 17 juillet 2026. Les indicateurs qui dépendent d&apos;un
        historique (churn, LTV) ne deviendront fiables qu&apos;après douze mois d&apos;exploitation.
      </p>
    </div>
  );
}
