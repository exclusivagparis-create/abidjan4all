import type { AudienceMois } from "@/lib/stats-audience";

const nf = new Intl.NumberFormat("fr-FR");

const PAYS: Record<string, string> = {
  CI: "Côte d'Ivoire", FR: "France", US: "États-Unis", CA: "Canada", BE: "Belgique",
  SN: "Sénégal", ML: "Mali", BF: "Burkina Faso", GH: "Ghana", MA: "Maroc",
  GB: "Royaume-Uni", DE: "Allemagne", CM: "Cameroun", TG: "Togo", BJ: "Bénin",
};

function libelleMois(m: string): string {
  const [a, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(a!, mo! - 1, 1)).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Menu déroulant des mois — recharge la page via ?mois=AAAA-MM (sans JS). */
function SelecteurMois({ mois, choisi }: { mois: string[]; choisi: string }) {
  return (
    <form method="get" className="flex items-center gap-2">
      <label htmlFor="mois" className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
        Mois
      </label>
      <select
        id="mois"
        name="mois"
        defaultValue={choisi}
        className="rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink"
      >
        {mois.map((m) => (
          <option key={m} value={m}>
            {libelleMois(m)}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-pill border border-line bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-ink-2 hover:text-ink">
        Afficher
      </button>
    </form>
  );
}

function Chiffre({ valeur, libelle, note }: { valeur: number; libelle: string; note?: string }) {
  return (
    <div className="rounded-[12px] border border-line bg-surface px-4 py-3.5">
      <div className="text-[22px] font-extrabold leading-none tracking-tight">{nf.format(valeur)}</div>
      <div className="mt-1.5 text-[11.5px] font-semibold text-ink-2">{libelle}</div>
      {note ? <div className="mt-0.5 text-[10.5px] leading-tight text-ink-3">{note}</div> : null}
    </div>
  );
}

export function AudienceMoisBloc({
  data,
  mois,
  choisi,
}: {
  data: AudienceMois;
  mois: string[];
  choisi: string;
}) {
  const maxPages = Math.max(1, ...data.parJour.map((j) => j.pagesVues));
  const partMobile = data.visites > 0 ? Math.round((data.visitesMobiles / data.visites) * 100) : 0;
  const vide = data.pagesVues === 0;

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold">Audience — {libelleMois(choisi)}</h2>
        <SelecteurMois mois={mois} choisi={choisi} />
      </div>

      {vide ? (
        <p className="rounded-[12px] border border-dashed border-line bg-surface-2 px-5 py-8 text-center text-[13px] text-ink-3">
          Aucune visite enregistrée sur ce mois. La mesure a démarré le 17 juillet 2026 — les mois antérieurs
          resteront vides.
        </p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Chiffre valeur={data.visiteurs} libelle="Visiteurs" note="distincts, comptés par jour" />
            <Chiffre valeur={data.visites} libelle="Visites" note="30 min d'inactivité = nouvelle" />
            <Chiffre valeur={data.pagesVues} libelle="Pages vues" />
            <Chiffre valeur={data.visitesMobiles} libelle="Visites mobiles" note={`${partMobile} % du total`} />
            <Chiffre valeur={data.inscritsSite} libelle="Inscrits au site" note="nouveaux ce mois" />
            <Chiffre valeur={data.inscritsNewsletter} libelle="Inscrits newsletter" note="nouveaux ce mois" />
            <Chiffre valeur={data.videosVues} libelle="Vidéos vues" note="pages vidéo affichées" />
            <Chiffre valeur={data.podcastsVus} libelle="Podcasts vus" note="pages podcast affichées" />
          </div>

          {/* Histogramme par jour — pages vues (barre) + visites (barre foncée) */}
          <div className="rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
            <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] font-semibold text-ink-3">
              <span>Par jour</span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-[var(--orange)]" /> Pages vues
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-navy" /> Visites
              </span>
            </div>
            <div className="flex h-[150px] items-end gap-[3px] overflow-x-auto">
              {data.parJour.map((j) => (
                <div key={j.jour} className="flex min-w-[10px] flex-1 flex-col items-center justify-end gap-[2px]" title={`${j.jour} — ${nf.format(j.pagesVues)} pages vues, ${nf.format(j.visites)} visites`}>
                  <div className="flex w-full items-end justify-center gap-[1px]">
                    <span
                      className="w-1/2 rounded-t-[2px] bg-[var(--orange)]"
                      style={{ height: `${Math.round((j.pagesVues / maxPages) * 120)}px` }}
                    />
                    <span
                      className="w-1/2 rounded-t-[2px] bg-navy"
                      style={{ height: `${Math.round((j.visites / maxPages) * 120)}px` }}
                    />
                  </div>
                  <span className="text-[8.5px] text-ink-3">{Number(j.jour.slice(8, 10))}</span>
                </div>
              ))}
            </div>
          </div>

          {data.pays.length > 0 ? (
            <div className="mt-4 rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                Pays des visites
              </div>
              <div className="flex flex-col gap-2">
                {data.pays.map((p) => {
                  const part = data.visites > 0 ? Math.round((p.visites / data.visites) * 100) : 0;
                  return (
                    <div key={p.code} className="flex items-center gap-3">
                      <span className="w-[110px] flex-none truncate text-[12.5px] font-semibold">
                        {PAYS[p.code] ?? p.code}
                      </span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-pill bg-surface-2">
                        <span className="block h-full rounded-pill bg-green" style={{ width: `${Math.max(2, part)}%` }} />
                      </span>
                      <span className="w-[86px] flex-none text-right text-[12px] text-ink-3">
                        {nf.format(p.visites)} · {part} %
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
