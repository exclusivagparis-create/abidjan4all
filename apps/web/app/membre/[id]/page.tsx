import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatDateFull, initials } from "@/lib/format";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  journalist: "Journaliste",
  editor: "Rédaction",
  admin: "Rédaction",
};

const regionNames = new Intl.DisplayNames(["fr"], { type: "region" });
const nf = new Intl.NumberFormat("fr-FR");

/** Profil public : uniquement des champs non sensibles — jamais l'email ni le rôle brut. */
async function getProfile(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      country: true,
      bio: true,
      verified: true,
      role: true,
      createdAt: true,
      badges: true,
      groups: { orderBy: { membersCount: "desc" } },
      _count: {
        select: { comments: { where: { status: "approved" } }, articles: { where: { status: "published" } } },
      },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await getProfile((await params).id);
  return { title: user ? `${user.name} — Profil` : "Profil" };
}

export default async function MembrePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getProfile((await params).id);
  if (!user) notFound();

  const roleLabel = ROLE_LABEL[user.role];
  const country = user.country ? regionNames.of(user.country) : null;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[860px] px-4 sm:px-6 lg:px-8 pb-20 pt-10">
        <div className="mb-8 flex items-start gap-5 border-b-2 border-ink pb-6">
          <div className="flex h-16 w-16 flex-none items-center justify-center rounded-pill bg-[linear-gradient(135deg,#2E5AAC,#0E8A5F)] text-xl font-bold text-white">
            {initials(user.name)}
          </div>
          <div className="min-w-0">
            <h1 className="font-serif text-[24px] sm:text-[28px] lg:text-[32px] font-medium leading-tight">
              {user.name}
              {user.verified ? (
                <span className="ml-2 align-middle text-[18px] text-blue" title="Profil vérifié">
                  ✔
                </span>
              ) : null}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
              {roleLabel ? <span className="font-bold uppercase tracking-[0.05em] text-red">{roleLabel}</span> : null}
              {country ? <span>{country}</span> : null}
              <span>Membre depuis {formatDateFull(user.createdAt)}</span>
            </div>
            {user.bio ? <p className="mt-3 font-serif text-[15px] leading-relaxed text-ink-2">{user.bio}</p> : null}
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-[14px] border border-line bg-surface px-6 py-5 shadow-[var(--shadow-sm)]">
            <div className="font-serif text-[24px] sm:text-[28px] lg:text-[32px] font-medium">{nf.format(user._count.comments)}</div>
            <div className="mt-0.5 text-[12.5px] text-ink-3">Commentaires publiés</div>
          </div>
          <div className="rounded-[14px] border border-line bg-surface px-6 py-5 shadow-[var(--shadow-sm)]">
            <div className="font-serif text-[24px] sm:text-[28px] lg:text-[32px] font-medium">{nf.format(user.groups.length)}</div>
            <div className="mt-0.5 text-[12.5px] text-ink-3">Groupes</div>
          </div>
          {user._count.articles > 0 ? (
            <div className="rounded-[14px] border border-line bg-surface px-6 py-5 shadow-[var(--shadow-sm)]">
              <div className="font-serif text-[24px] sm:text-[28px] lg:text-[32px] font-medium text-orange">{nf.format(user._count.articles)}</div>
              <div className="mt-0.5 text-[12.5px] text-ink-3">Articles signés</div>
            </div>
          ) : null}
        </div>

        {user.badges.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-3.5 font-serif text-[22px] font-semibold">Badges</h2>
            <div className="flex flex-wrap gap-2.5">
              {user.badges.map((b) => (
                <span
                  key={b.id}
                  className="rounded-pill border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.05em] text-ink-2 shadow-[var(--shadow-sm)]"
                >
                  {b.label}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="mb-3.5 font-serif text-[22px] font-semibold">Groupes</h2>
          {user.groups.length === 0 ? (
            <p className="text-[13px] text-ink-3">Aucun groupe pour l&apos;instant.</p>
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
              {user.groups.map((g) => (
                <Link
                  key={g.id}
                  href="/groupes"
                  className="flex items-center gap-3.5 border-b border-line-2 px-5 py-3.5 last:border-b-0 hover:bg-surface-2"
                >
                  <span
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] text-[15px] text-white"
                    style={{ background: g.color }}
                  >
                    ◉
                  </span>
                  <span className="flex-1 text-sm font-bold">{g.name}</span>
                  <span className="text-[11.5px] text-ink-3">{nf.format(g.membersCount)} membres</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
