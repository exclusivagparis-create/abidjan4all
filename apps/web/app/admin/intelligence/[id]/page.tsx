import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type BriefKind } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import {
  updateSerieAction,
  deleteSerieAction,
  createEditionAction,
  updateEditionAction,
  setEditionPubliedAction,
  deleteEditionAction,
  accorderAbonnementAction,
  retirerAbonnementAction,
} from "@/lib/actions/intelligence-actions";
import { KIND_LABEL } from "@/lib/intelligence";
import { formatFCFA } from "@/lib/tarifs";
import { formatDateFull } from "@/lib/format";

export const metadata: Metadata = { title: "Publication · Studio" };
export const dynamic = "force-dynamic";

const field = "w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-ink-3";
const lbl = "grid gap-1 text-[11px] font-semibold text-ink-3";
const btn = "rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-[11.5px] font-semibold text-ink-2 hover:text-ink";

const ERREURS: Record<string, string> = {
  edition: "Édition invalide — le repère, le titre et le résumé sont obligatoires.",
  doublon: "Ce repère d'édition existe déjà dans cette publication.",
  pdf: "PDF refusé — fichier PDF de 25 Mo maximum.",
  image: "Visuel refusé — format image de 8 Mo maximum.",
  abonnes: "Cette publication a des abonnés — retirez-la de la vente plutôt que de la supprimer.",
  abonne: "Accès non accordé — adresse e-mail inconnue ou durée invalide.",
  "1": "Publication invalide — vérifiez le titre, l'accroche, le prix et la durée.",
};

export default async function EditSerie({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string; abonne?: string }>;
}) {
  const [{ id }, { erreur, abonne }, session] = await Promise.all([params, searchParams, auth()]);
  if (!PUBLISH_ROLES.includes(session?.user?.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const serie = await prisma.briefSerie.findUnique({
    where: { id },
    include: {
      editions: { orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }] },
      abonnements: {
        orderBy: { expiresAt: "desc" },
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });
  if (!serie) notFound();

  const now = new Date();

  return (
    <div>
      <Link href="/admin/intelligence" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-ink-3 hover:text-ink">
        ‹ Retour à A4A Intelligence
      </Link>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">{serie.title}</h1>
        <a href={`/intelligence/${serie.slug}`} target="_blank" rel="noreferrer" className={btn}>
          👁 Voir la fiche publique
        </a>
      </div>
      <p className="mb-5 text-[12.5px] text-ink-3">
        {KIND_LABEL[serie.kind]} · {formatFCFA(serie.prixAnnuel)} / {serie.dureeMois} mois · {serie.editions.length}{" "}
        édition(s) · {serie.abonnements.filter((a) => a.expiresAt > now).length} abonné(s) actif(s)
      </p>

      {erreur ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
          {ERREURS[erreur] ?? "Une erreur est survenue."}
        </p>
      ) : null}
      {abonne ? (
        <p className="mb-4 rounded-md bg-[rgba(26,107,60,0.1)] px-4 py-2.5 text-[13px] font-semibold text-[#1A6B3C]">
          Accès accordé.
        </p>
      ) : null}

      {/* Réglages de la publication */}
      <section className="mb-6 rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 text-sm font-bold">Réglages</h2>
        <form action={updateSerieAction.bind(null, serie.id)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <label className={`${lbl} lg:col-span-4`}>
            Titre
            <input name="title" defaultValue={serie.title} required maxLength={140} className={field} />
          </label>
          <label className={`${lbl} lg:col-span-3`}>
            Nature
            <select name="kind" defaultValue={serie.kind} className={field}>
              {(Object.keys(KIND_LABEL) as BriefKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={`${lbl} lg:col-span-2`}>
            Rythme
            <input name="rythme" defaultValue={serie.rythme} maxLength={40} className={field} />
          </label>
          <label className={`${lbl} lg:col-span-2`}>
            Prix (FCFA)
            <input name="prixAnnuel" type="number" min={1} step={1} defaultValue={serie.prixAnnuel} required className={field} />
          </label>
          <label className={`${lbl} lg:col-span-1`}>
            Mois
            <input name="dureeMois" type="number" min={1} step={1} defaultValue={serie.dureeMois} required className={field} />
          </label>
          <label className={`${lbl} sm:col-span-2 lg:col-span-6`}>
            Accroche (vitrine)
            <input name="pitch" defaultValue={serie.pitch} required maxLength={300} className={field} />
          </label>
          <label className={`${lbl} sm:col-span-2 lg:col-span-5`}>
            Destinataires
            <input name="cible" defaultValue={serie.cible} maxLength={160} className={field} />
          </label>
          <label className={`${lbl} lg:col-span-1`}>
            Ordre
            <input name="ordre" type="number" step={1} defaultValue={serie.ordre} className={field} />
          </label>
          <label className={`${lbl} sm:col-span-2 lg:col-span-12`}>
            Description complète
            <textarea name="description" defaultValue={serie.description} rows={3} maxLength={2000} className={field} />
          </label>
          <label className={`${lbl} sm:col-span-2 lg:col-span-6`}>
            Visuel de couverture (optionnel)
            <input type="file" name="cover" accept="image/jpeg,image/png,image/webp" className="text-[12px] text-ink-2 file:mr-3 file:rounded-pill file:border file:border-line file:bg-surface-2 file:px-3 file:py-1.5 file:text-[11.5px] file:font-semibold file:text-ink" />
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-12">
            <button type="submit" className="rounded-pill bg-red px-5 py-2.5 text-[13px] font-bold text-white">
              Enregistrer
            </button>
          </div>
        </form>
        <div className="mt-3 border-t border-line-2 pt-3">
          <form action={deleteSerieAction.bind(null, serie.id)}>
            <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-red">
              Supprimer la publication
            </button>
          </form>
        </div>
      </section>

      {/* Éditions */}
      <section className="mb-6 rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-1 text-sm font-bold">Éditions</h2>
        <p className="mb-4 text-[12.5px] text-ink-3">
          Le <b>résumé</b> est public (il donne envie de s&apos;abonner) ; le <b>PDF</b> n&apos;est servi qu&apos;aux
          abonnés à jour, par une adresse qui vérifie leur accès à chaque téléchargement.
        </p>

        <div className="mb-5 grid gap-3">
          {serie.editions.map((e) => {
            const publiee = e.publishedAt && e.publishedAt <= now;
            return (
              <div key={e.id} className="rounded-[10px] border border-line-2 bg-surface-2 px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center gap-2.5">
                  <span className="rounded-[3px] border border-line bg-surface px-2 py-0.5 text-[11px] font-bold">{e.numero}</span>
                  <span className="text-[13.5px] font-semibold">{e.title}</span>
                  {e.fileUrl ? <span className="text-[11px] font-bold text-[#0E5A8A]">PDF</span> : null}
                  <span
                    className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] font-bold"
                    style={{ color: publiee ? "var(--green)" : "var(--ink-3)" }}
                  >
                    <span className="h-[6px] w-[6px] rounded-pill" style={{ background: publiee ? "var(--green)" : "var(--ink-3)" }} />
                    {publiee ? `Publiée le ${formatDateFull(e.publishedAt)}` : "Brouillon"}
                  </span>
                </div>
                <form action={updateEditionAction.bind(null, e.id)} className="grid gap-2.5 sm:grid-cols-12">
                  <label className={`${lbl} sm:col-span-2`}>
                    Repère
                    <input name="numero" defaultValue={e.numero} required maxLength={40} className={field} />
                  </label>
                  <label className={`${lbl} sm:col-span-6`}>
                    Titre
                    <input name="title" defaultValue={e.title} required maxLength={180} className={field} />
                  </label>
                  <label className={`${lbl} sm:col-span-4`}>
                    Remplacer le PDF
                    <input type="file" name="pdf" accept="application/pdf" className="text-[11.5px] text-ink-2 file:mr-2 file:rounded-pill file:border file:border-line file:bg-surface file:px-2.5 file:py-1 file:text-[11px] file:font-semibold file:text-ink" />
                  </label>
                  <label className={`${lbl} sm:col-span-12`}>
                    Résumé public
                    <textarea name="resume" defaultValue={e.resume} rows={2} required maxLength={1200} className={field} />
                  </label>
                  <div className="flex flex-wrap items-center gap-2 sm:col-span-12">
                    <button type="submit" className="rounded-pill bg-ink px-4 py-1.5 text-[11.5px] font-bold text-bg">
                      Enregistrer
                    </button>
                    {e.fileUrl ? (
                      <label className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
                        <input type="checkbox" name="removePdf" value="1" /> retirer le PDF
                      </label>
                    ) : null}
                  </div>
                </form>
                <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-2.5">
                  <form action={setEditionPubliedAction.bind(null, e.id)}>
                    <input type="hidden" name="publier" value={publiee ? "0" : "1"} />
                    <button type="submit" className={btn}>
                      {publiee ? "Dépublier" : "Publier"}
                    </button>
                  </form>
                  <a href={`/intelligence/${serie.slug}/${encodeURIComponent(e.numero)}`} target="_blank" rel="noreferrer" className={btn}>
                    👁 Aperçu
                  </a>
                  <form action={deleteEditionAction.bind(null, e.id)}>
                    <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-red">
                      Supprimer
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
          {serie.editions.length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-line bg-surface-2 px-4 py-6 text-center text-[13px] text-ink-3">
              Aucune édition — ajoutez la première ci-dessous.
            </p>
          ) : null}
        </div>

        <div className="rounded-[10px] border border-dashed border-line bg-surface-2 px-4 py-4">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">Nouvelle édition</div>
          <form action={createEditionAction.bind(null, serie.id)} className="grid gap-2.5 sm:grid-cols-12">
            <label className={`${lbl} sm:col-span-2`}>
              Repère
              <input name="numero" required maxLength={40} placeholder="2026-08" className={field} />
            </label>
            <label className={`${lbl} sm:col-span-6`}>
              Titre
              <input name="title" required maxLength={180} placeholder="Cacao & Café — août 2026" className={field} />
            </label>
            <label className={`${lbl} sm:col-span-4`}>
              PDF (25 Mo max)
              <input type="file" name="pdf" accept="application/pdf" className="text-[11.5px] text-ink-2 file:mr-2 file:rounded-pill file:border file:border-line file:bg-surface file:px-2.5 file:py-1 file:text-[11px] file:font-semibold file:text-ink" />
            </label>
            <label className={`${lbl} sm:col-span-12`}>
              Résumé public
              <textarea name="resume" rows={2} required maxLength={1200} className={field} />
            </label>
            <div className="sm:col-span-12">
              <button type="submit" className="rounded-pill bg-red px-5 py-2 text-[12.5px] font-bold text-white">
                Ajouter l&apos;édition
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Abonnés */}
      <section className="rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-1 text-sm font-bold">Abonnés</h2>
        <p className="mb-4 text-[12.5px] text-ink-3">
          Les abonnements payés en ligne apparaissent ici automatiquement. Vous pouvez aussi ouvrir un accès à la main
          pour une vente conclue hors ligne (contrat, convention, gratuité).
        </p>

        <div className="mb-4 overflow-x-auto rounded-[10px] border border-line">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">
                <th className="px-4 py-2.5">Compte</th>
                <th className="px-3 py-2.5">Depuis</th>
                <th className="px-3 py-2.5">Échéance</th>
                <th className="px-3 py-2.5">État</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {serie.abonnements.map((a) => {
                const actif = a.expiresAt > now;
                return (
                  <tr key={a.id} className="border-b border-line-2 last:border-b-0">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold">{a.user.name}</div>
                      <div className="text-[11px] text-ink-3">{a.user.email}</div>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-ink-2">{formatDateFull(a.startAt)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-ink-2">{formatDateFull(a.expiresAt)}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[11.5px] font-bold" style={{ color: actif ? "var(--green)" : "var(--ink-3)" }}>
                        {actif ? "Actif" : "Expiré"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <form action={retirerAbonnementAction.bind(null, a.id)}>
                        <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-2.5 py-1 text-[11px] font-semibold text-red">
                          Retirer
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {serie.abonnements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[13px] text-ink-3">
                    Aucun abonné pour l&apos;instant.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <form action={accorderAbonnementAction.bind(null, serie.id)} className="flex flex-wrap items-end gap-3">
          <label className={`${lbl} min-w-[240px]`}>
            Adresse e-mail du compte
            <input name="email" type="email" required placeholder="direction@entreprise.ci" className={field} />
          </label>
          <label className={`${lbl} w-[120px]`}>
            Durée (mois)
            <input name="mois" type="number" min={1} step={1} defaultValue={serie.dureeMois} required className={field} />
          </label>
          <button type="submit" className="rounded-pill border border-ink px-5 py-2 text-[12.5px] font-bold text-ink">
            Accorder l&apos;accès
          </button>
        </form>
      </section>
    </div>
  );
}
