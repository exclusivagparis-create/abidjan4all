import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { deleteContactAction, toggleContactHandledAction } from "@/lib/actions/contact-actions";
import { formatDateFull } from "@/lib/format";

export const metadata: Metadata = { title: "Messages · Studio" };
export const dynamic = "force-dynamic";

export default async function AdminContact() {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const messages = await prisma.contactMessage.findMany({ orderBy: [{ handled: "asc" }, { createdAt: "desc" }], take: 100 });
  const pending = messages.filter((m) => !m.handled).length;

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">Messages de contact</h1>
      <p className="mb-6 text-[12.5px] text-ink-3">{pending} message(s) à traiter sur {messages.length}.</p>

      <div className="grid gap-3">
        {messages.map((m) => (
          <div key={m.id} className={`rounded-[14px] border bg-surface p-5 shadow-[var(--shadow-sm)] ${m.handled ? "border-line opacity-70" : "border-[rgba(232,100,26,0.4)]"}`}>
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-bold">{m.subject}</span>
              {!m.handled ? <span className="rounded-pill bg-[rgba(232,100,26,0.12)] px-2 py-0.5 text-[10px] font-bold uppercase text-orange">Nouveau</span> : null}
              <span className="ml-auto text-[11.5px] text-ink-3">{formatDateFull(m.createdAt)}</span>
            </div>
            <div className="mb-2 text-[12.5px] text-ink-3">
              De <b className="text-ink-2">{m.name}</b> ·{" "}
              <a href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`} className="text-blue underline">{m.email}</a>
            </div>
            <p className="whitespace-pre-wrap font-serif text-[14.5px] leading-relaxed text-ink">{m.body}</p>
            <div className="mt-3 flex gap-2">
              <a href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`} className="rounded-pill bg-brand-fill px-3.5 py-1.5 text-[11.5px] font-bold text-brand-on">Répondre</a>
              <form action={toggleContactHandledAction.bind(null, m.id)}>
                <button type="submit" className="rounded-pill border border-line bg-surface-2 px-3.5 py-1.5 text-[11.5px] font-semibold text-ink-2">
                  {m.handled ? "Rouvrir" : "Marquer traité"}
                </button>
              </form>
              <form action={deleteContactAction.bind(null, m.id)}>
                <button type="submit" className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface px-3.5 py-1.5 text-[11.5px] font-semibold text-red">Supprimer</button>
              </form>
            </div>
          </div>
        ))}
        {messages.length === 0 ? <p className="rounded-[14px] border border-line bg-surface px-5 py-8 text-center text-[13px] text-ink-3">Aucun message pour l&apos;instant.</p> : null}
      </div>
    </div>
  );
}
