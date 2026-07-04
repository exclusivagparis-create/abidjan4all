import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { joinGroupAction, leaveGroupAction } from "@/lib/actions/community-actions";

export const metadata: Metadata = { title: "Groupes" };
export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("fr-FR");

export default async function GroupesPage() {
  const session = await auth();
  const [groups, memberships] = await Promise.all([
    prisma.group.findMany({ orderBy: { membersCount: "desc" } }),
    session?.user
      ? prisma.group.findMany({ where: { members: { some: { id: session.user.id } } }, select: { id: true } })
      : Promise.resolve([]),
  ]);
  const memberOf = new Set(memberships.map((g) => g.id));

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[860px] px-8 pb-16 pt-10">
        <div className="mb-3 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="h-[5px] w-[34px] rounded-[3px] bg-green" />
          <h1 className="font-serif text-[40px] font-medium leading-none">Groupes</h1>
        </div>
        <p className="mb-8 font-serif text-[15px] text-ink-2">
          Rejoignez la communauté Abidjan4All : entraide, débats et rencontres entre lecteurs, d&apos;Abidjan à la
          diaspora.
        </p>

        <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
          {groups.map((g) => {
            const isMember = memberOf.has(g.id);
            return (
              <div key={g.id} className="flex flex-wrap items-center gap-4 border-b border-line-2 px-6 py-4 last:border-b-0">
                <span
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] text-[17px] text-white"
                  style={{ background: g.color }}
                >
                  ◉
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{g.name}</div>
                  <div className="text-[11.5px] text-ink-3">{nf.format(g.membersCount)} membres</div>
                </div>
                {!session?.user ? (
                  <Link
                    href="/login?next=/groupes"
                    className="rounded-pill border border-line bg-surface-2 px-3.5 py-1.5 text-xs font-semibold text-ink"
                  >
                    Rejoindre
                  </Link>
                ) : isMember ? (
                  <form action={leaveGroupAction.bind(null, g.slug)} className="flex items-center gap-2">
                    <span className="rounded-pill bg-[rgba(14,138,95,0.1)] px-3 py-1.5 text-xs font-semibold text-green">
                      Membre
                    </span>
                    <button
                      type="submit"
                      className="rounded-pill border border-line bg-surface-2 px-3.5 py-1.5 text-xs font-semibold text-ink-3"
                    >
                      Quitter
                    </button>
                  </form>
                ) : (
                  <form action={joinGroupAction.bind(null, g.slug)}>
                    <button
                      type="submit"
                      className="cursor-pointer rounded-pill border border-line bg-surface-2 px-3.5 py-1.5 text-xs font-semibold text-ink"
                    >
                      Rejoindre
                    </button>
                  </form>
                )}
              </div>
            );
          })}
          {groups.length === 0 ? (
            <p className="py-16 text-center font-serif text-lg text-ink-3">Les premiers groupes ouvrent bientôt.</p>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
