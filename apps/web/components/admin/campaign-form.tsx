import { PlaceholderMedia } from "@/components/placeholder-media";

type AdFormat = "leaderboard_728x90" | "mpu_300x250" | "native" | "interstitial";

const FORMAT_LABEL: Record<AdFormat, string> = {
  leaderboard_728x90: "Bandeau 728×90",
  mpu_300x250: "Pavé 300×250",
  native: "Natif",
  interstitial: "Interstitiel",
};

export type CampaignInitial = {
  advertiser: string;
  format: AdFormat;
  cpm: number;
  headline: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  targeting: { rubriques?: string[]; geo?: string[] };
  startAt: string; // yyyy-mm-dd
  endAt: string;
};

/** Formulaire création/édition de campagne (rubriques cochables, visuel). */
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
      <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2">
        Annonceur
        <input name="advertiser" required maxLength={80} defaultValue={initial?.advertiser} placeholder="Air Côte d'Ivoire" className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]" />
      </label>
      <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2">
        Format
        <select name="format" defaultValue={initial?.format ?? "leaderboard_728x90"} className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]">
          {(Object.keys(FORMAT_LABEL) as AdFormat[]).map((f) => (
            <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2">
        CPM (XOF)
        <input name="cpm" type="number" min={1} required defaultValue={initial?.cpm ?? 1500} className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]" />
      </label>

      <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2 sm:col-span-2">
        Accroche (repli si pas de visuel)
        <input name="headline" maxLength={120} defaultValue={initial?.headline ?? ""} placeholder="Abidjan–Paris dès 450 000 FCFA" className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]" />
      </label>
      <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2">
        URL de destination
        <input name="linkUrl" type="url" defaultValue={initial?.linkUrl ?? ""} placeholder="https://…" className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]" />
      </label>

      <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2">
        Début
        <input name="startAt" type="date" required defaultValue={initial?.startAt} className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]" />
      </label>
      <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2">
        Fin
        <input name="endAt" type="date" required defaultValue={initial?.endAt} className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]" />
      </label>
      <label className="grid gap-1 text-[11.5px] font-semibold text-ink-2">
        Zones (codes, vide = monde)
        <input name="geo" defaultValue={geo} placeholder="CI, FR, CEDEAO" className="rounded border border-line bg-bg px-2.5 py-2 text-[13px]" />
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

      {/* Visuel : bandeau/pavé/natif — tout format image */}
      <div className="grid gap-1.5 text-[11.5px] font-semibold text-ink-2 sm:col-span-2 lg:col-span-3">
        Visuel (JPG/PNG/WebP/GIF/SVG, 8 Mo max — sinon l&apos;accroche est utilisée)
        {initial?.imageUrl ? (
          <div className="flex items-center gap-3">
            <PlaceholderMedia url={initial.imageUrl} alt="Visuel actuel" className="h-16 w-28 rounded border border-line" />
            <label className="flex items-center gap-1.5 text-[12px] font-normal text-ink-2">
              <input type="checkbox" name="removeImage" value="1" /> Retirer le visuel actuel
            </label>
          </div>
        ) : null}
        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          className="text-[12px] font-normal text-ink-2 file:mr-3 file:rounded-pill file:border file:border-line file:bg-surface file:px-4 file:py-2 file:text-xs file:font-semibold file:text-ink"
        />
      </div>

      <div className="flex items-end sm:col-span-2 lg:col-span-3">
        <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
