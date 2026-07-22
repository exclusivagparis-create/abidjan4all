type AdPriority = "basse" | "moyenne" | "haute";

const PRIORITE_LABEL: Record<AdPriority, string> = {
  basse: "Basse",
  moyenne: "Moyenne",
  haute: "Haute",
};

export type CampaignInitial = {
  advertiser: string;
  cpm: number;
  priority: AdPriority;
  permanent: boolean;
  capImpressions: number | null;
  capClicks: number | null;
  targeting: { rubriques?: string[]; geo?: string[] };
  startAt: string; // yyyy-mm-dd
  endAt: string;
};

const field = "rounded border border-line bg-bg px-2.5 py-2 text-[13px]";
const lbl = "grid gap-1 text-[11.5px] font-semibold text-ink-2";

/**
 * Formulaire de campagne (conteneur) : annonceur, tarif, priorité, période,
 * plafonds, ciblage. Les créatifs (bannières) se gèrent sur la fiche campagne.
 */
export function CampaignForm({
  action,
  rubriques,
  initial,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  rubriques: { slug: string; name: string }[];
  initial?: CampaignInitial;
  submitLabel: string;
}) {
  const targetRubriques = new Set(initial?.targeting?.rubriques ?? []);
  const geo = (initial?.targeting?.geo ?? []).join(", ");

  return (
    <form action={action} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      <label className={lbl}>
        Annonceur
        <input name="advertiser" required maxLength={80} defaultValue={initial?.advertiser} placeholder="Air Côte d'Ivoire" className={field} />
      </label>
      <label className={lbl}>
        CPM (XOF)
        <input name="cpm" type="number" min={1} required defaultValue={initial?.cpm ?? 1500} className={field} />
      </label>
      <label className={lbl}>
        Priorité d&apos;affichage
        <select name="priority" defaultValue={initial?.priority ?? "moyenne"} className={field}>
          {(Object.keys(PRIORITE_LABEL) as AdPriority[]).map((p) => (
            <option key={p} value={p}>{PRIORITE_LABEL[p]}</option>
          ))}
        </select>
      </label>

      <label className={lbl}>
        Début
        <input name="startAt" type="date" required defaultValue={initial?.startAt} className={field} />
      </label>
      <label className={lbl}>
        Fin
        <input name="endAt" type="date" defaultValue={initial?.endAt} className={field} />
      </label>
      <label className="flex items-end gap-2 pb-1 text-[12px] font-normal text-ink-2">
        <input type="checkbox" name="permanent" value="1" defaultChecked={initial?.permanent} />
        Diffusion permanente (ignore la date de fin)
      </label>

      <label className={lbl}>
        Plafond d&apos;affichages (vide = illimité)
        <input name="capImpressions" type="number" min={1} defaultValue={initial?.capImpressions ?? ""} placeholder="ex. 100000" className={field} />
      </label>
      <label className={lbl}>
        Plafond de clics (vide = illimité)
        <input name="capClicks" type="number" min={1} defaultValue={initial?.capClicks ?? ""} placeholder="ex. 500" className={field} />
      </label>
      <label className={lbl}>
        Zones (codes, vide = monde)
        <input name="geo" defaultValue={geo} placeholder="CI, FR, CEDEAO" className={field} />
      </label>

      {/* Ciblage rubriques : cases à cocher (plusieurs possibles) */}
      <div className="grid gap-1 text-[11.5px] font-semibold text-ink-2 sm:col-span-2 lg:col-span-3">
        Rubriques ciblées (aucune cochée = toutes)
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded border border-line bg-bg px-3 py-2.5">
          {rubriques.map((r) => (
            <label key={r.slug} className="flex items-center gap-1.5 text-[12px] font-normal text-ink">
              <input type="checkbox" name="rubriques" value={r.slug} defaultChecked={targetRubriques.has(r.slug)} />
              {r.name}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-end sm:col-span-2 lg:col-span-3">
        <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
