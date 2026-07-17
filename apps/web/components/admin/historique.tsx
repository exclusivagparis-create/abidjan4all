import { formatXOF } from "@a4a/payments";
import type { AnneeHistorique, SyntheseAnnee } from "@/lib/stats-audience";

const nf = new Intl.NumberFormat("fr-FR");
const MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

/** Sélecteur d'année — recharge via ?annee=AAAA, sans JavaScript. */
function SelecteurAnnee({ annees, choisie }: { annees: number[]; choisie: number }) {
  return (
    <form method="get" className="flex items-center gap-2">
      <label htmlFor="annee" className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
        Année
      </label>
      <select
        id="annee"
        name="annee"
        defaultValue={String(choisie)}
        className="rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink"
      >
        {annees.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-pill border border-line bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-ink-2 hover:text-ink">
        Afficher
      </button>
    </form>
  );
}

/** Un histogramme mensuel générique (12 barres jan→déc). */
function BarresMensuelles({
  valeurs,
  couleur,
  format,
}: {
  valeurs: number[];
  couleur: string;
  format: (v: number) => string;
}) {
  const max = Math.max(1, ...valeurs);
  return (
    <div className="flex h-[130px] items-end gap-1.5">
      {valeurs.map((v, i) => (
        <div
          key={i}
          className="flex flex-1 flex-col items-center justify-end gap-1"
          title={`${MOIS_COURTS[i]} : ${format(v)}`}
        >
          <span className="text-[9px] font-semibold text-ink-2">{v > 0 ? format(v) : ""}</span>
          <div
            className="w-full rounded-t-[3px]"
            style={{ height: `${Math.round((v / max) * 96)}px`, background: couleur, minHeight: v > 0 ? 3 : 0 }}
          />
          <span className="text-[9.5px] text-ink-3">{MOIS_COURTS[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function HistoriqueBloc({
  synthese,
  annee,
  annees,
  choisie,
}: {
  synthese: SyntheseAnnee[];
  annee: AnneeHistorique;
  annees: number[];
  choisie: number;
}) {
  const visites = annee.mois.map((m) => m.visites);
  const pages = annee.mois.map((m) => m.pagesVues);
  const revenus = annee.mois.map((m) => m.revenus);
  const rienCetteAnnee = annee.totalVisites === 0 && annee.totalPagesVues === 0 && annee.totalRevenus === 0;

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold">Historique</h2>
        <SelecteurAnnee annees={annees} choisie={choisie} />
      </div>

      {/* Historique annuel : une ligne par année */}
      <div className="mb-6 overflow-x-auto rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        <div className="grid min-w-[520px] grid-cols-[80px_1fr_1fr_1fr] gap-3 border-b border-line bg-surface-2 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
          <span>Année</span><span className="text-right">Visites</span><span className="text-right">Pages vues</span><span className="text-right">Revenus</span>
        </div>
        {synthese.map((s) => (
          <div
            key={s.annee}
            className={`grid min-w-[520px] grid-cols-[80px_1fr_1fr_1fr] items-center gap-3 border-b border-line-2 px-5 py-2.5 last:border-b-0 ${
              s.annee === choisie ? "bg-surface-2/50" : ""
            }`}
          >
            <span className="font-serif text-[16px] font-semibold">{s.annee}</span>
            <span className="text-right text-[13px] font-semibold">{nf.format(s.visites)}</span>
            <span className="text-right text-[13px] font-semibold">{nf.format(s.pagesVues)}</span>
            <span className="text-right text-[13px] font-bold text-green">{formatXOF(s.revenus)}</span>
          </div>
        ))}
        {synthese.length === 0 ? (
          <p className="px-5 py-6 text-center text-[13px] text-ink-3">Aucune donnée pour l&apos;instant.</p>
        ) : null}
      </div>

      {rienCetteAnnee ? (
        <p className="rounded-[12px] border border-dashed border-line bg-surface-2 px-5 py-8 text-center text-[13px] text-ink-3">
          Rien à afficher pour {choisie}. La mesure d&apos;audience a démarré le 17 juillet 2026.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-bold">Visites par mois — {choisie}</h3>
              <span className="text-[12px] text-ink-3">{nf.format(annee.totalVisites)} au total</span>
            </div>
            <BarresMensuelles valeurs={visites} couleur="var(--navy)" format={(v) => nf.format(v)} />
          </section>

          <section className="rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-bold">Pages vues par mois — {choisie}</h3>
              <span className="text-[12px] text-ink-3">{nf.format(annee.totalPagesVues)} au total</span>
            </div>
            <BarresMensuelles valeurs={pages} couleur="var(--orange)" format={(v) => nf.format(v)} />
          </section>

          <section className="rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)] lg:col-span-2">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-bold">Revenus encaissés par mois — {choisie}</h3>
              <span className="text-[12px] font-bold text-green">{formatXOF(annee.totalRevenus)} au total</span>
            </div>
            <BarresMensuelles valeurs={revenus} couleur="#0E8A5F" format={(v) => formatXOF(v)} />
          </section>
        </div>
      )}
    </section>
  );
}
