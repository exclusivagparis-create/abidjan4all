import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type Role } from "@a4a/db";
import { auth } from "@/auth";
import { setUserRoleAction, toggleVerifiedAction } from "@/lib/actions/user-admin-actions";
import { formatDate, initials } from "@/lib/format";

export const metadata: Metadata = { title: "Utilisateurs · Studio" };
export const dynamic = "force-dynamic";

const ROLE_META: Record<Role, { label: string; color: string }> = {
  reader: { label: "Lecteur", color: "var(--ink-3)" },
  member: { label: "Membre", color: "var(--blue)" },
  journalist: { label: "Journaliste", color: "var(--green)" },
  editor: { label: "Rédaction en chef", color: "var(--orange)" },
  admin: { label: "Administration", color: "var(--red)" },
  partner: { label: "Partenaire", color: "var(--navy)" },
};
const ROLES = Object.keys(ROLE_META) as Role[];

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const [{ role }, session] = await Promise.all([searchParams, auth()]);
  if (session?.user?.role !== "admin") redirect("/admin");
  const myId = session.user.id;

  const roleFilter = ROLES.includes(role as Role) ? (role as Role) : undefined;
  const [users, counts, verifiedCount] = await Promise.all([
    prisma.user.findMany({
      where: roleFilter ? { role: roleFilter } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        verified: true,
        createdAt: true,
        badges: { select: { label: true } },
        _count: { select: { comments: true, articles: true } },
      },
    }),
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.user.count({ where: { verified: true } }),
  ]);
  const total = counts.reduce((s, c) => s + c._count, 0);
  const countByRole = new Map(counts.map((c) => [c.role, c._count]));

  return (
    <div>
      <h1 className="mb-6 text-lg font-bold">Utilisateurs</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(
          [
            [String(total), "Comptes au total"],
            [String(countByRole.get("member") ?? 0), "Membres inscrits"],
            [String((countByRole.get("journalist") ?? 0) + (countByRole.get("editor") ?? 0)), "Rédaction"],
            [String(verifiedCount), "Profils vérifiés"],
          ] as const
        ).map(([value, label]) => (
          <div key={label} className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
            <div className="font-serif text-[28px] font-medium">{value}</div>
            <div className="mt-0.5 text-[12px] text-ink-3">{label}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <a
          href="/admin/users"
          className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold ${!roleFilter ? "bg-navy text-white" : "border border-line bg-surface text-ink-2"}`}
        >
          Tous
        </a>
        {ROLES.map((r) => (
          <a
            key={r}
            href={`/admin/users?role=${r}`}
            className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold ${roleFilter === r ? "bg-navy text-white" : "border border-line bg-surface text-ink-2"}`}
          >
            {ROLE_META[r].label} {countByRole.get(r) ?? 0}
          </a>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">
              <th className="px-5 py-3">Compte</th>
              <th className="px-3 py-3">Rôle</th>
              <th className="px-3 py-3">Badges</th>
              <th className="px-3 py-3">Activité</th>
              <th className="px-3 py-3">Inscrit le</th>
              <th className="px-3 py-3">Vérifié</th>
              <th className="px-3 py-3">Changer le rôle</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const meta = ROLE_META[u.role];
              const self = u.id === myId;
              return (
                <tr key={u.id} className="border-b border-line-2 last:border-b-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-[linear-gradient(135deg,#2E5AAC,#0E8A5F)] text-[11px] font-bold text-white">
                        {initials(u.name)}
                      </span>
                      <div>
                        <div className="font-bold">
                          {u.name}
                          {self ? <span className="ml-1.5 text-[10px] font-semibold text-ink-3">(vous)</span> : null}
                        </div>
                        <div className="text-[11.5px] text-ink-3">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: meta.color }}>
                      <span className="h-[7px] w-[7px] rounded-pill" style={{ background: meta.color }} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[11.5px] text-ink-3">
                    {u.badges.map((b) => b.label).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-3 text-[11.5px] text-ink-3">
                    {u._count.articles > 0 ? `${u._count.articles} art. · ` : ""}
                    {u._count.comments} comm.
                  </td>
                  <td className="px-3 py-3 text-ink-2">{formatDate(u.createdAt)}</td>
                  <td className="px-3 py-3">
                    <form action={toggleVerifiedAction.bind(null, u.id)}>
                      <button
                        type="submit"
                        title={u.verified ? "Retirer la coche" : "Vérifier ce profil"}
                        className={`rounded-pill px-2.5 py-1 text-[11px] font-bold ${
                          u.verified ? "bg-[rgba(46,90,172,0.12)] text-blue" : "border border-line bg-surface-2 text-ink-3"
                        }`}
                      >
                        {u.verified ? "✔ Vérifié" : "Non"}
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-3">
                    {self ? (
                      <span className="text-[11px] text-ink-3">— votre compte —</span>
                    ) : (
                      <form action={setUserRoleAction.bind(null, u.id)}>
                        <RoleButtons current={u.role} />
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Un bouton par rôle cible : le name/value du bouton cliqué part dans le FormData. */
function RoleButtons({ current }: { current: Role }) {
  return (
    <span className="flex flex-wrap gap-1">
      {ROLES.filter((r) => r !== current).map((r) => (
        <button
          key={r}
          type="submit"
          name="role"
          value={r}
          title={`Passer ${ROLE_META[r].label}`}
          className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-2 hover:bg-surface-3"
        >
          {ROLE_META[r].label.split(" ")[0]}
        </button>
      ))}
    </span>
  );
}
