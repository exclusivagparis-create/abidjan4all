import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type EventKind, type EventStatus } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { createEventAction, setEventStatusAction } from "@/lib/actions/event-actions";
import { EVENT_KIND_LABEL } from "@/lib/events";
import { formatFCFA } from "@/lib/tarifs";
import { formatDateFull } from "@/lib/format";

export const metadata: Metadata = { title: "Événements · Studio" };
export const dynamic = "force-dynamic";

const field = "w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-ink-3";
const lbl = "grid gap-1 text-[11px] font-semibold text-ink-3";

const STATUS_META: Record<EventStatus, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "var(--ink-3)" },
  published: { label: "Publié", color: "var(--green)" },
  ended: { label: "Terminé", color: "var(--ink-3)" },
  cancelled: { label: "Annulé", color: "var(--red)" },
};

export default async function AdminEvenements({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  if (!PUBLISH_ROLES.includes(session?.user?.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const events = await prisma.event.findMany({
    orderBy: { startAt: "desc" },
    include: {
      tickets: true,
      _count: { select: { registrations: true } },
    },
  });

  // Recettes billetterie : seules les inscriptions confirmées sont encaissées.
  const confirmees = await prisma.eventRegistration.findMany({
    where: { status: "confirmed" },
    select: { ticket: { select: { prix: true } } },
  });
  const recettes = confirmees.reduce((s, r) => s + r.ticket.prix, 0);
  const now = new Date();

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">Événements</h1>
      <p className="mb-6 max-w-[72ch] text-[12.5px] text-ink-3">
        Forums, cérémonies, conférences et webinaires (pilier 7 du business model). Chaque événement propose une ou
        plusieurs <b>catégories de billets</b> ; chaque inscrit reçoit un <b>code d&apos;entrée</b> unique.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(
          [
            [String(events.filter((e) => e.status === "published" && e.startAt >= now).length), "À venir"],
            [String(events.length), "Événements"],
            [String(confirmees.length), "Inscriptions confirmées"],
            [formatFCFA(recettes), "Recettes billetterie"],
          ] as const
        ).map(([value, label]) => (
          <div key={label} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
            <div className="font-serif text-[24px] font-medium">{value}</div>
            <div className="mt-0.5 text-[12px] text-ink-3">{label}</div>
          </div>
        ))}
      </div>

      {erreur ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
          Événement invalide — vérifiez le titre, l&apos;accroche et les dates.
        </p>
      ) : null}

      <div className="mb-6 grid gap-3">
        {events.map((e) => {
          const meta = STATUS_META[e.status];
          const prixMin = e.tickets.length ? Math.min(...e.tickets.map((t) => t.prix)) : null;
          return (
            <div key={e.id} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-[3px] bg-[#8A5A2B] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                  {EVENT_KIND_LABEL[e.kind]}
                </span>
                <Link href={`/admin/evenements/${e.id}`} className="font-serif text-[16px] font-bold hover:underline">
                  {e.title}
                </Link>
                <span className="text-[12px] text-ink-3">{formatDateFull(e.startAt)}</span>
                <span className="text-[12px] text-ink-3">
                  {e.enLigne ? "En ligne" : e.ville || "lieu à préciser"} ·{" "}
                  {e.tickets.length} catégorie(s)
                  {prixMin !== null ? ` · dès ${prixMin > 0 ? formatFCFA(prixMin) : "gratuit"}` : ""}
                </span>
                <span className="text-[12px] font-semibold text-ink-2">{e._count.registrations} inscrit(s)</span>
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: meta.color }}>
                  <span className="h-[7px] w-[7px] rounded-pill" style={{ background: meta.color }} />
                  {meta.label}
                </span>
                <form action={setEventStatusAction.bind(null, e.id)} className="flex gap-1.5">
                  {e.status !== "published" ? (
                    <button type="submit" name="status" value="published" className="rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-[11.5px] font-semibold text-ink-2 hover:text-ink">
                      Publier
                    </button>
                  ) : (
                    <button type="submit" name="status" value="draft" className="rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-[11.5px] font-semibold text-ink-2 hover:text-ink">
                      Dépublier
                    </button>
                  )}
                </form>
              </div>
            </div>
          );
        })}
        {events.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-line bg-surface-2 px-5 py-8 text-center text-[13px] text-ink-3">
            Aucun événement — créez le premier ci-dessous.
          </p>
        ) : null}
      </div>

      <section className="rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
        <h2 className="mb-1 text-sm font-bold">Nouvel événement</h2>
        <p className="mb-4 text-[12.5px] text-ink-3">
          Créez la fiche, puis ajoutez-y les catégories de billets et les partenaires. Il reste invisible du public
          jusqu&apos;à sa publication.
        </p>
        <form action={createEventAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <label className={`${lbl} lg:col-span-5`}>
            Titre
            <input name="title" required maxLength={160} placeholder="Forum Diaspora 2027" className={field} />
          </label>
          <label className={`${lbl} lg:col-span-3`}>
            Nature
            <select name="kind" className={field}>
              {(Object.keys(EVENT_KIND_LABEL) as EventKind[]).map((k) => (
                <option key={k} value={k}>
                  {EVENT_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={`${lbl} lg:col-span-2`}>
            Début
            <input name="startAt" type="datetime-local" required className={field} />
          </label>
          <label className={`${lbl} lg:col-span-2`}>
            Fin (optionnel)
            <input name="endAt" type="datetime-local" className={field} />
          </label>
          <label className={`${lbl} sm:col-span-2 lg:col-span-12`}>
            Accroche
            <input name="pitch" required maxLength={300} className={field} />
          </label>
          <label className={`${lbl} lg:col-span-4`}>
            Lieu
            <input name="lieu" maxLength={160} placeholder="Sofitel Abidjan Hôtel Ivoire" className={field} />
          </label>
          <label className={`${lbl} lg:col-span-3`}>
            Ville
            <input name="ville" maxLength={80} placeholder="Abidjan" className={field} />
          </label>
          <label className={`${lbl} lg:col-span-2`}>
            Jauge (optionnel)
            <input name="capacite" type="number" min={1} step={1} className={field} />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-[12px] font-semibold text-ink-2 lg:col-span-3">
            <input type="checkbox" name="enLigne" value="1" /> Événement en ligne
          </label>
          <label className={`${lbl} sm:col-span-2 lg:col-span-12`}>
            Programme / description
            <textarea name="description" rows={4} maxLength={4000} className={field} />
          </label>
          <div className="sm:col-span-2 lg:col-span-12">
            <button type="submit" className="rounded-pill bg-red px-5 py-2.5 text-[13px] font-bold text-white">
              Créer l&apos;événement
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
