import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type EventKind } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import {
  updateEventAction,
  deleteEventAction,
  createTicketAction,
  updateTicketAction,
  setTicketActifAction,
  deleteTicketAction,
  createSponsorAction,
  deleteSponsorAction,
  confirmerInscriptionAction,
  annulerInscriptionAction,
} from "@/lib/actions/event-actions";
import { EVENT_KIND_LABEL } from "@/lib/events";
import { formatFCFA } from "@/lib/tarifs";
import { formatDateFull } from "@/lib/format";

export const metadata: Metadata = { title: "Événement · Studio" };
export const dynamic = "force-dynamic";

const field = "w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-ink-3";
const lbl = "grid gap-1 text-[11px] font-semibold text-ink-3";
const btn = "rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-[11.5px] font-semibold text-ink-2 hover:text-ink";

const ERREURS: Record<string, string> = {
  billet: "Catégorie invalide — libellé obligatoire, prix entier positif ou nul.",
  "billet-utilise": "Des inscrits ont ce billet — fermez-le à la vente plutôt que de le supprimer.",
  sponsor: "Partenaire invalide — nom obligatoire, lien en http(s).",
  image: "Visuel refusé — format image de 8 Mo maximum.",
  inscrits: "Cet événement a des inscrits — annulez-le plutôt que de le supprimer.",
  "1": "Événement invalide — vérifiez le titre, l'accroche et les dates.",
};

/** `datetime-local` attend « AAAA-MM-JJTHH:MM » en heure locale. */
function pourInput(d: Date | null): string {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function EditEvent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  const [{ id }, { erreur }, session] = await Promise.all([params, searchParams, auth()]);
  if (!PUBLISH_ROLES.includes(session?.user?.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const ev = await prisma.event.findUnique({
    where: { id },
    include: {
      tickets: { orderBy: { ordre: "asc" }, include: { _count: { select: { registrations: true } } } },
      sponsors: { orderBy: { ordre: "asc" } },
      registrations: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true } }, ticket: { select: { label: true, prix: true } } },
      },
    },
  });
  if (!ev) notFound();

  const confirmees = ev.registrations.filter((r) => r.status === "confirmed");
  const recettes = confirmees.reduce((s, r) => s + r.ticket.prix, 0);

  return (
    <div>
      <Link href="/admin/evenements" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-ink-3 hover:text-ink">
        ‹ Retour aux événements
      </Link>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">{ev.title}</h1>
        <a href={`/evenements/${ev.slug}`} target="_blank" rel="noreferrer" className={btn}>
          👁 Voir la page publique
        </a>
        <a href={`/admin/evenements/${ev.id}/export`} className={btn}>
          ⭳ Export des inscrits (CSV)
        </a>
      </div>
      <p className="mb-5 text-[12.5px] text-ink-3">
        {EVENT_KIND_LABEL[ev.kind]} · {formatDateFull(ev.startAt)} · {confirmees.length} confirmé(s) sur{" "}
        {ev.registrations.length} inscription(s) · recettes {formatFCFA(recettes)}
      </p>

      {erreur ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
          {ERREURS[erreur] ?? "Une erreur est survenue."}
        </p>
      ) : null}

      {/* Fiche */}
      <section className="mb-6 rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 text-sm font-bold">Fiche de l&apos;événement</h2>
        <form action={updateEventAction.bind(null, ev.id)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <label className={`${lbl} lg:col-span-5`}>
            Titre
            <input name="title" defaultValue={ev.title} required maxLength={160} className={field} />
          </label>
          <label className={`${lbl} lg:col-span-3`}>
            Nature
            <select name="kind" defaultValue={ev.kind} className={field}>
              {(Object.keys(EVENT_KIND_LABEL) as EventKind[]).map((k) => (
                <option key={k} value={k}>
                  {EVENT_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={`${lbl} lg:col-span-2`}>
            Début
            <input name="startAt" type="datetime-local" defaultValue={pourInput(ev.startAt)} required className={field} />
          </label>
          <label className={`${lbl} lg:col-span-2`}>
            Fin
            <input name="endAt" type="datetime-local" defaultValue={pourInput(ev.endAt)} className={field} />
          </label>
          <label className={`${lbl} sm:col-span-2 lg:col-span-12`}>
            Accroche
            <input name="pitch" defaultValue={ev.pitch} required maxLength={300} className={field} />
          </label>
          <label className={`${lbl} lg:col-span-4`}>
            Lieu
            <input name="lieu" defaultValue={ev.lieu ?? ""} maxLength={160} className={field} />
          </label>
          <label className={`${lbl} lg:col-span-2`}>
            Ville
            <input name="ville" defaultValue={ev.ville ?? ""} maxLength={80} className={field} />
          </label>
          <label className={`${lbl} lg:col-span-2`}>
            Jauge
            <input name="capacite" type="number" min={1} step={1} defaultValue={ev.capacite ?? ""} className={field} />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-[12px] font-semibold text-ink-2 lg:col-span-2">
            <input type="checkbox" name="enLigne" value="1" defaultChecked={ev.enLigne} /> En ligne
          </label>
          <label className={`${lbl} sm:col-span-2 lg:col-span-6`}>
            Lien de connexion (réservé aux inscrits confirmés)
            <input name="accessUrl" type="url" defaultValue={ev.accessUrl ?? ""} placeholder="https://…" className={field} />
          </label>
          <label className={`${lbl} sm:col-span-2 lg:col-span-6`}>
            Visuel de couverture
            <input type="file" name="cover" accept="image/jpeg,image/png,image/webp" className="text-[12px] text-ink-2 file:mr-3 file:rounded-pill file:border file:border-line file:bg-surface-2 file:px-3 file:py-1.5 file:text-[11.5px] file:font-semibold file:text-ink" />
          </label>
          <label className={`${lbl} sm:col-span-2 lg:col-span-12`}>
            Programme / description
            <textarea name="description" defaultValue={ev.description} rows={5} maxLength={4000} className={field} />
          </label>
          <div className="sm:col-span-2 lg:col-span-12">
            <button type="submit" className="rounded-pill bg-red px-5 py-2.5 text-[13px] font-bold text-white">
              Enregistrer
            </button>
          </div>
        </form>
        <div className="mt-3 border-t border-line-2 pt-3">
          <form action={deleteEventAction.bind(null, ev.id)}>
            <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-red">
              Supprimer l&apos;événement
            </button>
          </form>
        </div>
      </section>

      {/* Billets */}
      <section className="mb-6 rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-1 text-sm font-bold">Catégories de billets</h2>
        <p className="mb-4 text-[12.5px] text-ink-3">
          Un prix à <b>0</b> crée un billet gratuit : l&apos;inscription est confirmée immédiatement, sans paiement.
        </p>

        <div className="mb-5 grid gap-3">
          {ev.tickets.map((t) => (
            <div key={t.id} className="rounded-[10px] border border-line-2 bg-surface-2 px-4 py-3">
              <div className="mb-2 flex flex-wrap items-center gap-2.5">
                <span className="text-[13.5px] font-semibold">{t.label}</span>
                <span className="font-serif text-[15px] font-bold text-[#8A5A2B]">
                  {t.prix > 0 ? formatFCFA(t.prix) : "Gratuit"}
                </span>
                <span className="text-[12px] text-ink-3">
                  {t._count.registrations} inscrit(s){t.quota ? ` / ${t.quota} places` : ""}
                </span>
                <span
                  className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] font-bold"
                  style={{ color: t.actif ? "var(--green)" : "var(--ink-3)" }}
                >
                  <span className="h-[6px] w-[6px] rounded-pill" style={{ background: t.actif ? "var(--green)" : "var(--ink-3)" }} />
                  {t.actif ? "En vente" : "Fermé"}
                </span>
              </div>
              <form action={updateTicketAction.bind(null, t.id)} className="grid gap-2.5 sm:grid-cols-12">
                <label className={`${lbl} sm:col-span-3`}>
                  Libellé
                  <input name="label" defaultValue={t.label} required maxLength={80} className={field} />
                </label>
                <label className={`${lbl} sm:col-span-2`}>
                  Prix (FCFA)
                  <input name="prix" type="number" min={0} step={1} defaultValue={t.prix} required className={field} />
                </label>
                <label className={`${lbl} sm:col-span-2`}>
                  Quota
                  <input name="quota" type="number" min={1} step={1} defaultValue={t.quota ?? ""} className={field} />
                </label>
                <label className={`${lbl} sm:col-span-1`}>
                  Ordre
                  <input name="ordre" type="number" step={1} defaultValue={t.ordre} className={field} />
                </label>
                <label className={`${lbl} sm:col-span-4`}>
                  Description
                  <input name="description" defaultValue={t.description} maxLength={300} className={field} />
                </label>
                <div className="flex flex-wrap items-center gap-2 sm:col-span-12">
                  <button type="submit" className="rounded-pill bg-ink px-4 py-1.5 text-[11.5px] font-bold text-bg">
                    Enregistrer
                  </button>
                </div>
              </form>
              <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-2.5">
                <form action={setTicketActifAction.bind(null, t.id)}>
                  <input type="hidden" name="actif" value={t.actif ? "0" : "1"} />
                  <button type="submit" className={btn}>
                    {t.actif ? "Fermer à la vente" : "Rouvrir à la vente"}
                  </button>
                </form>
                <form action={deleteTicketAction.bind(null, t.id)}>
                  <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-red">
                    Supprimer
                  </button>
                </form>
              </div>
            </div>
          ))}
          {ev.tickets.length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-line bg-surface-2 px-4 py-6 text-center text-[13px] text-ink-3">
              Aucune catégorie — sans billet, personne ne peut s&apos;inscrire.
            </p>
          ) : null}
        </div>

        <div className="rounded-[10px] border border-dashed border-line bg-surface-2 px-4 py-4">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">Nouvelle catégorie</div>
          <form action={createTicketAction.bind(null, ev.id)} className="grid gap-2.5 sm:grid-cols-12">
            <label className={`${lbl} sm:col-span-3`}>
              Libellé
              <input name="label" required maxLength={80} placeholder="Standard" className={field} />
            </label>
            <label className={`${lbl} sm:col-span-2`}>
              Prix (FCFA)
              <input name="prix" type="number" min={0} step={1} required defaultValue={0} className={field} />
            </label>
            <label className={`${lbl} sm:col-span-2`}>
              Quota
              <input name="quota" type="number" min={1} step={1} className={field} />
            </label>
            <label className={`${lbl} sm:col-span-1`}>
              Ordre
              <input name="ordre" type="number" step={1} defaultValue={0} className={field} />
            </label>
            <label className={`${lbl} sm:col-span-4`}>
              Description
              <input name="description" maxLength={300} className={field} />
            </label>
            <div className="sm:col-span-12">
              <button type="submit" className="rounded-pill bg-red px-5 py-2 text-[12.5px] font-bold text-white">
                Ajouter la catégorie
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Partenaires */}
      <section className="mb-6 rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-1 text-sm font-bold">Partenaires &amp; sponsors</h2>
        <p className="mb-4 text-[12.5px] text-ink-3">
          Affichés en bas de la page publique. Le sponsoring d&apos;édition est une recette du pilier événementiel.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {ev.sponsors.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-[10px] border border-line bg-surface-2 px-3 py-2">
              {s.logoUrl ? <img src={s.logoUrl} alt="" className="h-6 object-contain" /> : null}
              <span className="text-[12.5px] font-semibold">{s.name}</span>
              <span className="text-[11px] text-ink-3">{s.niveau}</span>
              <form action={deleteSponsorAction.bind(null, s.id)}>
                <button type="submit" className="text-[11px] font-bold text-red">
                  ✕
                </button>
              </form>
            </div>
          ))}
          {ev.sponsors.length === 0 ? <p className="text-[13px] text-ink-3">Aucun partenaire.</p> : null}
        </div>
        <form action={createSponsorAction.bind(null, ev.id)} className="grid gap-2.5 sm:grid-cols-12">
          <label className={`${lbl} sm:col-span-3`}>
            Nom
            <input name="name" required maxLength={80} className={field} />
          </label>
          <label className={`${lbl} sm:col-span-3`}>
            Niveau
            <input name="niveau" maxLength={60} placeholder="Partenaire officiel" className={field} />
          </label>
          <label className={`${lbl} sm:col-span-3`}>
            Lien
            <input name="linkUrl" type="url" placeholder="https://…" className={field} />
          </label>
          <label className={`${lbl} sm:col-span-2`}>
            Logo
            <input type="file" name="logo" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="text-[11.5px] text-ink-2 file:mr-2 file:rounded-pill file:border file:border-line file:bg-surface file:px-2.5 file:py-1 file:text-[11px] file:font-semibold file:text-ink" />
          </label>
          <label className={`${lbl} sm:col-span-1`}>
            Ordre
            <input name="ordre" type="number" step={1} defaultValue={0} className={field} />
          </label>
          <div className="sm:col-span-12">
            <button type="submit" className="rounded-pill border border-ink px-5 py-2 text-[12.5px] font-bold text-ink">
              Ajouter le partenaire
            </button>
          </div>
        </form>
      </section>

      {/* Inscrits */}
      <section className="rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-1 text-sm font-bold">Inscrits</h2>
        <p className="mb-4 text-[12.5px] text-ink-3">
          Le <b>code d&apos;entrée</b> est présenté à l&apos;accueil le jour J. Une inscription « en attente » est un
          billet payant dont le règlement n&apos;a pas abouti — vous pouvez la confirmer à la main (paiement reçu
          autrement) ou l&apos;annuler pour libérer la place.
        </p>
        <div className="overflow-x-auto rounded-[10px] border border-line">
          <table className="w-full min-w-[700px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">
                <th className="px-4 py-2.5">Participant</th>
                <th className="px-3 py-2.5">Billet</th>
                <th className="px-3 py-2.5">Code</th>
                <th className="px-3 py-2.5">État</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {ev.registrations.map((r) => (
                <tr key={r.id} className="border-b border-line-2 last:border-b-0">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold">{r.user.name}</div>
                    <div className="text-[11px] text-ink-3">{r.user.email}</div>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-ink-2">
                    {r.ticket.label}
                    {r.ticket.prix > 0 ? ` · ${formatFCFA(r.ticket.prix)}` : ""}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11.5px] tracking-wider">{r.code}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className="text-[11.5px] font-bold"
                      style={{
                        color:
                          r.status === "confirmed" ? "var(--green)" : r.status === "pending" ? "var(--orange)" : "var(--ink-3)",
                      }}
                    >
                      {r.status === "confirmed" ? "Confirmé" : r.status === "pending" ? "En attente" : "Annulé"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {r.status === "pending" ? (
                        <form action={confirmerInscriptionAction.bind(null, r.id)}>
                          <button type="submit" className="rounded-pill bg-[#1A6B3C] px-2.5 py-1 text-[11px] font-bold text-white">
                            Confirmer
                          </button>
                        </form>
                      ) : null}
                      {r.status !== "cancelled" ? (
                        <form action={annulerInscriptionAction.bind(null, r.id)}>
                          <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-2.5 py-1 text-[11px] font-semibold text-red">
                            Annuler
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {ev.registrations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[13px] text-ink-3">
                    Aucune inscription pour l&apos;instant.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
