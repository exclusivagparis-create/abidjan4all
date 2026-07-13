import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { sendBreakingAlertAction } from "@/lib/actions/alert-actions";
import { pushConfigured } from "@/lib/push";

export const metadata: Metadata = { title: "Alertes push · Studio" };
export const dynamic = "force-dynamic";

export default async function AdminAlertes({ searchParams }: { searchParams: Promise<{ envoye?: string; erreur?: string }> }) {
  const [{ envoye, erreur }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const [subscribers, articles] = await Promise.all([
    prisma.pushSubscription.count(),
    prisma.article.findMany({
      where: { status: "published", hidden: false },
      orderBy: { publishedAt: "desc" },
      take: 10,
      select: { slug: true, title: true, rubrique: { select: { slug: true } } },
    }),
  ]);

  const inp = "w-full rounded-[8px] border border-line bg-bg px-3 py-2.5 text-[14px]";

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">Alertes push « Breaking news »</h1>
      <p className="mb-5 max-w-[70ch] text-[12.5px] text-ink-3">
        Envoie une notification à tous les navigateurs abonnés ({subscribers}). À réserver aux informations
        majeures — un usage trop fréquent fait fuir les abonnés.
      </p>

      {envoye ? <p className="mb-4 rounded-md bg-[rgba(14,138,95,0.1)] px-4 py-2.5 text-[13px] font-semibold text-green">✓ Alerte envoyée à {envoye} destinataire(s).</p> : null}
      {erreur === "1" ? <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">Titre et message requis.</p> : null}
      {erreur === "push" ? <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">Notifications push non configurées (clés VAPID manquantes).</p> : null}

      <form action={sendBreakingAlertAction} className="grid max-w-[560px] gap-4 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
        <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
          Titre (court)
          <input name="title" required maxLength={80} placeholder="🔴 Breaking" className={inp} />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
          Message
          <input name="body" required maxLength={160} placeholder="Ce qui vient de se passer en une phrase." className={inp} />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
          Destination au clic
          <input name="url" list="alert-articles" placeholder="/rubrique/mon-article (défaut : accueil)" className={inp} />
          <datalist id="alert-articles">
            {articles.map((a) => (
              <option key={a.slug} value={`/${a.rubrique.slug}/${a.slug}`}>{a.title}</option>
            ))}
          </datalist>
        </label>
        <button
          type="submit"
          disabled={!pushConfigured || subscribers === 0}
          className="justify-self-start rounded-pill bg-red px-6 py-2.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {pushConfigured ? `Envoyer à ${subscribers} abonné(s)` : "Push non configuré"}
        </button>
      </form>
    </div>
  );
}
