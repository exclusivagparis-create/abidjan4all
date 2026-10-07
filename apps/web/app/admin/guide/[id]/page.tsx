import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { exigerRole } from "@/lib/garde-role";
import { deleteFicheAction, updateFicheAction } from "@/lib/actions/guide-actions";
import { GuideSectionsEditor } from "@/components/admin/guide-sections-editor";
import { IDENTITE, REGIONS, avancement } from "@/lib/guide";

export const metadata: Metadata = { title: "Fiche du Guide · Studio" };
export const dynamic = "force-dynamic";

const ERREURS: Record<string, string> = {
  titre: "Titre requis — deux caractères au minimum.",
  chapo: "Pour publier, écrivez d'abord le chapô : c'est ce que lisent le sommaire et les moteurs de recherche.",
};

export default async function EditFiche({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const [{ id }, { ok, erreur }, session] = await Promise.all([params, searchParams, auth()]);
  if (!(await exigerRole(PUBLISH_ROLES))) redirect("/admin");

  const fiche = await prisma.guideFiche.findUnique({ where: { id } });
  if (!fiche) notFound();

  const inp = "rounded-[8px] border border-line bg-bg px-3 py-2.5 text-[14px]";
  const lab = "grid gap-1.5 text-xs font-semibold text-ink-2";
  const part = avancement(fiche);

  return (
    <div>
      <Link href="/admin/guide" className="mb-4 inline-flex text-[13px] font-semibold text-ink-3 hover:text-ink">‹ Guide de l&apos;Afrique</Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">{fiche.title}</h1>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-[12.5px] text-ink-3">
            <span className="h-1.5 w-[70px] overflow-hidden rounded-pill bg-line">
              <span className="block h-full rounded-pill bg-green" style={{ width: `${part}%` }} />
            </span>
            {part}% rempli
          </span>
          <Link href={`/guide/${fiche.slug}`} target="_blank" className="text-[12.5px] font-semibold text-blue">Voir la fiche ↗</Link>
        </div>
      </div>

      {ok ? <p className="mb-4 rounded-md bg-[rgba(14,138,95,0.1)] px-4 py-2.5 text-[13px] font-semibold text-green">Fiche enregistrée.</p> : null}
      {erreur && ERREURS[erreur] ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">{ERREURS[erreur]}</p>
      ) : null}

      <form action={updateFicheAction.bind(null, fiche.id)} className="grid gap-5">
        <section className="grid gap-4 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
            <label className={lab}>Titre<input name="title" defaultValue={fiche.title} required maxLength={120} className={inp} /></label>
            <label className={lab}>
              Type
              <select name="kind" defaultValue={fiche.kind} className={inp}>
                <option value="pays">Pays</option>
                <option value="theme">Thème</option>
              </select>
            </label>
            <label className={lab}>
              Région
              <select name="region" defaultValue={fiche.region ?? ""} className={inp}>
                <option value="">—</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>
          <div className="text-[12px] text-ink-3">Adresse : <code>/guide/{fiche.slug}</code> (non modifiable — préserve les liens et le référencement)</div>
          <label className={lab}>
            Chapô
            <textarea
              name="summary"
              defaultValue={fiche.summary}
              rows={3}
              maxLength={600}
              placeholder="Deux ou trois phrases : ce que le lecteur retiendra s'il ne lit que cela."
              className={`${inp} resize-y`}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <label className={lab}>Image de couverture (adresse)<input name="coverUrl" defaultValue={fiche.coverUrl ?? ""} maxLength={300} placeholder="/uploads/…" className={inp} /></label>
            <label className={lab}>Rang dans le sommaire<input name="order" type="number" defaultValue={fiche.order} className={inp} /></label>
          </div>
        </section>

        {/* Encadré d'identité : des cases courtes, toujours les mêmes, qui
            rendent deux fiches comparables d'un coup d'œil. */}
        <section className="grid gap-4 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
          <div className="text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Encadré d&apos;identité</div>
          <p className="-mt-2 text-[12px] text-ink-3">
            Laissez vide ce qui ne s&apos;applique pas : une fiche thématique n&apos;a ni capitale ni monnaie, et les
            lignes vides ne s&apos;affichent pas.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {IDENTITE.map((champ) => (
              <label key={champ.cle} className={lab}>
                {champ.label}
                <input
                  name={champ.cle}
                  defaultValue={(fiche as unknown as Record<string, string | null>)[champ.cle] ?? ""}
                  maxLength={160}
                  placeholder={champ.exemple}
                  className={inp}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="grid gap-3">
          <div className="text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Sections rédigées</div>
          <GuideSectionsEditor valeurs={fiche} />
        </section>

        <div className="flex flex-wrap items-center gap-4 rounded-[14px] border border-line bg-surface p-5">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
            <input type="checkbox" name="published" defaultChecked={fiche.published} /> Publiée
          </label>
          <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">Enregistrer</button>
          <button
            type="submit"
            formAction={deleteFicheAction.bind(null, fiche.id)}
            className="ml-auto rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-4 py-2.5 text-xs font-semibold text-red"
          >
            Supprimer
          </button>
        </div>
      </form>
    </div>
  );
}
