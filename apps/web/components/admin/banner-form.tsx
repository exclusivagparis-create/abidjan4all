import { PlaceholderMedia } from "@/components/placeholder-media";

type AdFormat = "leaderboard_728x90" | "mpu_300x250" | "native" | "interstitial";

const FORMAT_LABEL: Record<AdFormat, string> = {
  leaderboard_728x90: "Bandeau 728×90",
  mpu_300x250: "Pavé 300×250",
  native: "Natif",
  interstitial: "Interstitiel",
};

export type BannerInitial = {
  format: AdFormat;
  headline: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
};

const field = "rounded border border-line bg-bg px-2.5 py-2 text-[13px]";
const lbl = "grid gap-1 text-[11.5px] font-semibold text-ink-2";

/** Formulaire d'un créatif (bannière) : format, accroche, lien, visuel. */
export function BannerForm({
  action,
  initial,
  submitLabel,
  compact,
}: {
  action: (formData: FormData) => void;
  initial?: BannerInitial;
  submitLabel: string;
  compact?: boolean;
}) {
  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className={lbl}>
        Format
        <select name="format" defaultValue={initial?.format ?? "leaderboard_728x90"} className={field}>
          {(Object.keys(FORMAT_LABEL) as AdFormat[]).map((f) => (
            <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
          ))}
        </select>
      </label>
      <label className={lbl}>
        URL de destination
        <input name="linkUrl" type="url" defaultValue={initial?.linkUrl ?? ""} placeholder="https://…" className={field} />
      </label>
      <label className={`${lbl} sm:col-span-2`}>
        Accroche (repli si pas de visuel)
        <input name="headline" maxLength={120} defaultValue={initial?.headline ?? ""} placeholder="Abidjan–Paris dès 450 000 FCFA" className={field} />
      </label>

      <div className={`grid gap-1.5 text-[11.5px] font-semibold text-ink-2 sm:col-span-2`}>
        Visuel (JPG/PNG/WebP/GIF/SVG, 8 Mo max)
        {initial?.imageUrl ? (
          <div className="flex items-center gap-3">
            <PlaceholderMedia url={initial.imageUrl} alt="Visuel actuel" className="h-16 w-28 rounded border border-line" />
            <label className="flex items-center gap-1.5 text-[12px] font-normal text-ink-2">
              <input type="checkbox" name="removeImage" value="1" /> Retirer le visuel
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

      <div className={compact ? "sm:col-span-2" : "flex items-end sm:col-span-2"}>
        <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
