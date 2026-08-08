import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF, planById } from "@a4a/payments";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { logout } from "@/lib/actions/auth-actions";
import { cancelSubscriptionAction } from "@/lib/actions/billing-actions";
import { updateProfileAction } from "@/lib/actions/community-actions";
import { PushOptIn } from "@/components/push-optin";
import { mesAbonnements } from "@/lib/intelligence";
import { mesInscriptions } from "@/lib/events";
import { annulerMonInscriptionAction } from "@/lib/actions/event-actions";
import { formatDateFull, initials } from "@/lib/format";

export const metadata: Metadata = { title: "Espace membre" };
export const dynamic = "force-dynamic";

const SUB_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: "Actif", color: "var(--green)" },
  past_due: { label: "Paiement en retard", color: "var(--orange)" },
  canceled: { label: "Résilié (accès jusqu'à échéance)", color: "var(--ink-3)" },
};

/** Cartes badges de la maquette Espace Membre (icône, tuile, description). */
const BADGE_META: Record<string, { icon: string; tile: string; desc: string }> = {
  diaspora: { icon: "◈", tile: "#2E5AAC", desc: "Profil confirmé hors CI" },
  expert_cacao: { icon: "★", tile: "#8A5A2B", desc: "Contributions reconnues" },
  journalist: { icon: "✎", tile: "#364152", desc: "Rédaction Abidjan4All" },
};

const nf = new Intl.NumberFormat("fr-FR");

export default async function EspaceMembrePage({
  searchParams,
}: {
  searchParams: Promise<{ bienvenue?: string }>;
}) {
  const [{ bienvenue }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user) redirect("/login?next=/espace-membre");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      badges: true,
      groups: { orderBy: { membersCount: "desc" } },
      _count: {
        select: {
          favorites: true,
          comments: { where: { status: "approved" } },
          enrollments: true,
        },
      },
      subscription: {
        include: {
          payments: {
            where: { status: "succeeded" },
            orderBy: { createdAt: "desc" },
            take: 12,
            include: { invoice: true },
          },
        },
      },
    },
  });
  if (!user) redirect("/login");

  const [briefs, inscriptions] = await Promise.all([mesAbonnements(user.id), mesInscriptions(user.id)]);
  const sub = user.subscription;
  const plan = sub ? planById(sub.plan) : undefined;
  const paying = sub && sub.plan !== "free";
  const status = sub ? SUB_STATUS[sub.status] : undefined;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[860px] px-4 sm:px-6 lg:px-8 pb-20 pt-10">
        {bienvenue ? (
          <p className="mb-6 rounded-md bg-[rgba(14,138,95,0.12)] px-4 py-3 text-[13.5px] font-semibold text-green">
            🎉 Bienvenue dans A4A+ — votre abonnement est actif, les articles premium sont débloqués.
          </p>
        ) : null}

        <div className="mb-8 flex items-center gap-4 border-b-2 border-ink pb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-pill bg-[linear-gradient(135deg,#2E5AAC,#0E8A5F)] text-lg font-bold text-white">
            {initials(user.name)}
          </div>
          <div>
            <h1 className="font-serif text-[24px] sm:text-[28px] lg:text-[32px] font-medium leading-none">{user.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
              {user.email}
              {user.badges.map((b) => (
                <span key={b.id} className="rounded-pill border border-line bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink-3">
                  {b.label}
                </span>
              ))}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {user.role === "partner" ? (
              <Link
                href="/espace-annonceur"
                className="rounded-pill bg-[#1A6B3C] px-4 py-2 text-xs font-bold text-white"
              >
                📊 Espace annonceur
              </Link>
            ) : null}
            {briefs.length > 0 ? (
              <Link href="/intelligence" className="rounded-pill bg-[#0E5A8A] px-4 py-2 text-xs font-bold text-white">
                ◲ A4A Intelligence
              </Link>
            ) : null}
            <Link
              href={`/membre/${user.id}`}
              className="rounded-pill border border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-ink"
            >
              Voir mon profil public
            </Link>
            <Link
              href="/espace-membre/cv"
              className="rounded-pill border border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-ink"
            >
              📄 Mon CV en ligne
            </Link>
            <Link
              href="/parametres"
              className="rounded-pill border border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-ink"
            >
              ⚙ Paramètres
            </Link>
            {/* Il n'existait AUCUNE déconnexion hors du Studio : un membre
                pouvait entrer mais jamais sortir — problème sur un appareil
                partagé (famille, cybercafé). */}
            <form action={logout}>
              <button
                type="submit"
                className="rounded-pill border border-[rgba(214,40,45,0.4)] bg-surface-2 px-4 py-2 text-xs font-semibold text-red"
              >
                Se déconnecter
              </button>
            </form>
          </div>
        </div>

        {/* Stats (maquette : cartes chiffres) */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              [user._count.favorites, "Favoris"],
              [user._count.comments, "Commentaires publiés"],
              [user.groups.length, "Groupes"],
              [user._count.enrollments, "Formations suivies"],
            ] as const
          ).map(([n, label]) => (
            <div key={label} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
              <div className="font-serif text-[24px] sm:text-[28px] lg:text-[32px] font-medium">{nf.format(n)}</div>
              <div className="mt-0.5 text-[12.5px] text-ink-3">{label}</div>
            </div>
          ))}
        </div>

        {/* Badges (maquette : tuiles icône + description) */}
        <section className="mb-8">
          <h2 className="mb-3.5 font-serif text-[22px] font-semibold">Badges</h2>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {user.badges.map((b) => {
              const meta = BADGE_META[b.slug];
              return (
                <div key={b.id} className="flex items-center gap-3.5 rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
                  <span
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] text-xl text-white"
                    style={{ background: meta?.tile ?? "var(--navy)" }}
                  >
                    {meta?.icon ?? "◈"}
                  </span>
                  <div>
                    <div className="text-sm font-bold">{b.label}</div>
                    {meta ? <div className="text-[11.5px] text-ink-3">{meta.desc}</div> : null}
                  </div>
                </div>
              );
            })}
            {paying ? (
              <div className="flex items-center gap-3.5 rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,#F5C24B,#E8641A)] text-xl text-[#16181D]">
                  ★
                </span>
                <div>
                  <div className="text-sm font-bold">Membre A4A+</div>
                  <div className="text-[11.5px] text-ink-3">Abonné depuis {formatDateFull(sub!.since)}</div>
                </div>
              </div>
            ) : null}
            {/* Badge à débloquer (maquette) */}
            <div className="flex items-center gap-3.5 rounded-[14px] border border-line bg-surface px-5 py-4 opacity-50 shadow-[var(--shadow-sm)]">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] bg-surface-2 text-xl text-ink-3">
                ◎
              </span>
              <div>
                <div className="text-sm font-bold text-ink-2">Ambassadeur</div>
                <div className="text-[11.5px] text-ink-3">Parrainez 5 membres</div>
              </div>
            </div>
          </div>
        </section>

        {/* Mes événements — billets et codes d'entrée (pilier 7). */}
        {inscriptions.length > 0 ? (
          <section className="mb-8">
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="font-serif text-[22px] font-semibold">Mes événements</h2>
              <Link href="/evenements" className="text-xs font-semibold text-blue">
                Tous les événements →
              </Link>
            </div>
            <div className="grid gap-3">
              {inscriptions.map((r) => (
                <div key={r.id} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
                  <div className="mb-1 flex flex-wrap items-center gap-2.5">
                    <Link href={`/evenements/${r.event.slug}`} className="text-[15px] font-semibold hover:underline">
                      {r.event.title}
                    </Link>
                    <span
                      className="text-[11.5px] font-bold"
                      style={{ color: r.status === "confirmed" ? "var(--green)" : "var(--orange)" }}
                    >
                      {r.status === "confirmed" ? "Confirmé" : "En attente de paiement"}
                    </span>
                  </div>
                  <p className="mb-2 text-[12.5px] text-ink-3">
                    {formatDateFull(r.event.startAt)} ·{" "}
                    {r.event.enLigne ? "En ligne" : [r.event.lieu, r.event.ville].filter(Boolean).join(", ") || "lieu à préciser"}{" "}
                    · billet {r.ticket.label}
                  </p>
                  {r.status === "confirmed" ? (
                    <p className="mb-2 text-[13px]">
                      Code d&apos;entrée : <b className="font-mono tracking-wider">{r.code}</b>
                    </p>
                  ) : null}
                  <form action={annulerMonInscriptionAction.bind(null, r.id)}>
                    <button type="submit" className="text-[11.5px] font-semibold text-ink-3 underline hover:text-red">
                      Annuler mon inscription
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* A4A Intelligence — publications B2B souscrites (pilier 4). */}
        {briefs.length > 0 ? (
          <section className="mb-8">
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="font-serif text-[22px] font-semibold">Mes publications A4A Intelligence</h2>
              <Link href="/intelligence" className="text-xs font-semibold text-blue">
                Toutes les publications →
              </Link>
            </div>
            <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
              {briefs.map((a) => (
                <Link
                  key={a.id}
                  href={`/intelligence/${a.serie.slug}`}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-line-2 px-5 py-3.5 last:border-b-0 hover:bg-surface-2"
                >
                  <span className="text-[14px] font-semibold">{a.serie.title}</span>
                  <span className="text-[12px] text-ink-3">Accès jusqu&apos;au {formatDateFull(a.expiresAt)}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* Mes groupes (maquette : liste + accès catalogue) */}
        <section className="mb-8">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="font-serif text-[22px] font-semibold">Mes groupes</h2>
            <Link href="/groupes" className="text-xs font-semibold text-blue">
              Tous les groupes →
            </Link>
          </div>
          {user.groups.length === 0 ? (
            <p className="rounded-[14px] border border-line bg-surface px-5 py-4 text-[13px] text-ink-3 shadow-[var(--shadow-sm)]">
              Vous n&apos;avez rejoint aucun groupe — <Link href="/groupes" className="font-semibold text-blue">découvrez la communauté</Link>.
            </p>
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
              {user.groups.map((g) => (
                <div key={g.id} className="flex items-center gap-3.5 border-b border-line-2 px-5 py-3.5 last:border-b-0">
                  <span
                    className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] text-[17px] text-white"
                    style={{ background: g.color }}
                  >
                    ◉
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-bold">{g.name}</div>
                    <div className="text-[11.5px] text-ink-3">{nf.format(g.membersCount)} membres</div>
                  </div>
                  <span className="rounded-pill bg-[rgba(14,138,95,0.1)] px-3 py-1.5 text-xs font-semibold text-green">
                    Membre
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Alertes Web Push (DF-04) */}
        <PushOptIn />

        {/* Profil public : édition bio + pays */}
        <section className="mb-8 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.06em] text-ink-3">Mon profil public</h2>
          <form action={updateProfileAction} className="grid gap-4">
            <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
              Bio (affichée sur votre profil public)
              <textarea
                name="bio"
                defaultValue={user.bio ?? ""}
                maxLength={400}
                rows={3}
                placeholder="Parlez de vous à la communauté…"
                className="resize-y rounded-md border border-line bg-bg px-3.5 py-2.5 font-serif text-[14px] text-ink outline-none focus:border-ink-3"
              />
            </label>
            <label className="grid max-w-[220px] gap-1.5 text-xs font-semibold text-ink-2">
              Pays (code à 2 lettres — CI, FR, CA…)
              <input
                name="country"
                defaultValue={user.country ?? ""}
                maxLength={2}
                placeholder="CI"
                className="rounded-md border border-line bg-bg px-3.5 py-2.5 text-[14px] uppercase text-ink outline-none focus:border-ink-3"
              />
            </label>
            <button
              type="submit"
              className="justify-self-start rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on"
            >
              Enregistrer
            </button>
          </form>
        </section>

        {/* Abonnement */}
        <section className="mb-6 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.06em] text-ink-3">Mon abonnement</h2>
            {paying && status ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: status.color }}>
                <span className="h-[7px] w-[7px] rounded-pill" style={{ background: status.color }} />
                {status.label}
              </span>
            ) : null}
          </div>

          {paying && plan ? (
            <>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-[linear-gradient(135deg,#F5C24B,#E8641A)] px-[13px] py-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#16181D]">
                  ★ A4A+ {plan.name}
                </span>
                {plan.price ? (
                  <span className="text-lg font-extrabold">
                    {formatXOF(plan.price)}
                    <span className="text-xs font-semibold text-ink-3"> / mois</span>
                  </span>
                ) : null}
              </div>
              <div className="mt-3 text-[13px] text-ink-2">
                {sub.methodMask ? <>Moyen de paiement : <b>{sub.methodMask}</b> · </> : null}
                {sub.currentPeriodEnd ? (
                  <>Période en cours jusqu&apos;au <b>{formatDateFull(sub.currentPeriodEnd)}</b> · </>
                ) : null}
                Membre depuis {formatDateFull(sub.since)}
              </div>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {sub.plan === "essentiel" && sub.status === "active" ? (
                  <Link href="/abonnement" className="rounded-pill bg-brand-fill px-4 py-2.5 text-xs font-bold text-brand-on">
                    Passer à Pro
                  </Link>
                ) : null}
                {sub.status === "active" ? (
                  <form action={cancelSubscriptionAction}>
                    <button type="submit" className="rounded-pill border border-line bg-surface-2 px-4 py-2.5 text-xs font-semibold text-ink">
                      Résilier
                    </button>
                  </form>
                ) : (
                  <Link href="/abonnement" className="rounded-pill bg-red px-4 py-2.5 text-xs font-bold text-white">
                    Se réabonner
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-serif text-[15px] text-ink-2">
                Vous n&apos;avez pas encore d&apos;abonnement A4A+ — les enquêtes premium vous attendent.
              </p>
              <Link href="/abonnement" className="rounded-pill bg-red px-5 py-2.5 text-[13px] font-bold text-white">
                Découvrir A4A+
              </Link>
            </div>
          )}
        </section>

        {/* Factures */}
        <section className="rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.06em] text-ink-3">Mes factures</h2>
          {!sub || sub.payments.length === 0 ? (
            <p className="text-[13px] text-ink-3">Aucune facture pour l&apos;instant.</p>
          ) : (
            sub.payments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-line-2 py-3 text-[13px] last:border-b-0">
                {p.invoice ? (
                  <a href={p.invoice.url} target="_blank" rel="noreferrer" className="font-mono font-semibold underline decoration-line underline-offset-2 hover:decoration-ink" title="Télécharger la facture (PDF)">
                    {p.invoice.number}
                  </a>
                ) : (
                  <span className="font-mono font-semibold">{p.providerRef}</span>
                )}
                <span className="text-ink-3">{formatDateFull(p.createdAt)}</span>
                <span className="ml-auto font-bold">{formatXOF(p.amount)}</span>
                <span className="rounded-pill bg-[rgba(14,138,95,0.12)] px-2.5 py-0.5 text-[11px] font-bold text-green">
                  Payée
                </span>
              </div>
            ))
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
