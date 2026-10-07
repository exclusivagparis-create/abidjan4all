import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma, type Role } from "@a4a/db";
import { ADMIN_ROLES } from "@/auth";
import { exigerRole } from "@/lib/garde-role";
import { emailConfigured } from "@/lib/email";
import {
  sendPasswordLinkAction,
  setUserRoleAction,
  toggleVerifiedAction,
  updateUserIdentityAction,
} from "@/lib/actions/user-admin-actions";
import { UserDeleteButton } from "@/components/admin/user-forms";
import { formatDate, initials } from "@/lib/format";

export const metadata: Metadata = { title: "Fiche compte · Studio" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<Role, string> = {
  reader: "Lecteur",
  member: "Membre",
  journalist: "Journaliste",
  editor: "Rédaction en chef",
  admin: "Administration",
  partner: "Partenaire",
  ad_manager: "Gestionnaire Régie",
};
const ROLES = Object.keys(ROLE_LABEL) as Role[];

const MESSAGES: Record<string, { texte: string; ton: "ok" | "erreur" }> = {
  identite: { texte: "Compte corrigé.", ton: "ok" },
  lien: { texte: "Lien de mot de passe envoyé au titulaire. Il est valable 7 jours.", ton: "ok" },
  nom: { texte: "Nom trop court — deux caractères au minimum.", ton: "erreur" },
  email: { texte: "Adresse e-mail invalide.", ton: "erreur" },
  occupe: { texte: "Un autre compte utilise déjà cette adresse.", ton: "erreur" },
  smtp: { texte: "Aucun serveur d'envoi configuré : impossible d'expédier le lien.", ton: "erreur" },
  envoi: { texte: "L'envoi a échoué. Vérifiez l'adresse et le serveur d'envoi.", ton: "erreur" },
};

export default async function FicheCompte({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const [{ id }, { ok, erreur }, moi] = await Promise.all([params, searchParams, exigerRole(ADMIN_ROLES)]);
  if (!moi) redirect("/admin");

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      verified: true,
      emailVerified: true,
      country: true,
      createdAt: true,
      badges: { select: { label: true } },
      subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
      _count: { select: { comments: true, articles: true, listings: true, orders: true } },
      passwordSetTokens: {
        where: { usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { expiresAt: "desc" },
        take: 1,
        select: { expiresAt: true },
      },
    },
  });
  if (!user) notFound();

  const soi = user.id === moi.id;
  const message = MESSAGES[ok ?? erreur ?? ""];
  const inp = "w-full rounded-[8px] border border-line bg-bg px-3 py-2.5 text-[14px]";
  const lab = "grid gap-1.5 text-xs font-semibold text-ink-2";

  return (
    <div>
      <Link href="/admin/users" className="mb-4 inline-flex text-[13px] font-semibold text-ink-3 hover:text-ink">‹ Utilisateurs</Link>

      <div className="mb-6 flex flex-wrap items-center gap-3.5">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-pill bg-[linear-gradient(135deg,#2E5AAC,#0E8A5F)] text-[15px] font-bold text-white">
          {initials(user.name)}
        </span>
        <div>
          <h1 className="text-lg font-bold">{user.name}{soi ? <span className="ml-2 text-[11px] font-semibold text-ink-3">(votre compte)</span> : null}</h1>
          <div className="text-[12.5px] text-ink-3">
            {ROLE_LABEL[user.role]} · inscrit le {formatDate(user.createdAt)}
            {user.country ? ` · ${user.country}` : ""}
          </div>
        </div>
      </div>

      {message ? (
        <p
          className={`mb-5 rounded-md px-4 py-2.5 text-[13px] font-semibold ${
            message.ton === "ok" ? "bg-[rgba(14,138,95,0.1)] text-green" : "bg-[rgba(214,40,45,0.1)] text-red"
          }`}
        >
          {message.texte}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Identité</h2>
          <p className="mb-4 text-[12.5px] text-ink-3">
            Corriger l&apos;adresse e-mail d&apos;un compte le remet entre les mains de son titulaire : sans cela, il
            ne reçoit ni confirmation ni lien de mot de passe. L&apos;adresse corrigée est tenue pour vérifiée.
          </p>
          <form action={updateUserIdentityAction.bind(null, user.id)} className="grid gap-4">
            <label className={lab}>Nom affiché<input name="name" defaultValue={user.name} required maxLength={80} className={inp} /></label>
            <label className={lab}>
              Adresse e-mail
              <input name="email" type="email" defaultValue={user.email} required maxLength={160} className={inp} />
            </label>
            <div>
              <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">
                Enregistrer
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-line-2 pt-5">
            <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Mot de passe</h2>
            <p className="mb-3 text-[12.5px] text-ink-3">
              Le titulaire reçoit un lien pour en choisir un nouveau, valable sept jours. Son mot de passe actuel reste
              valable tant qu&apos;il ne s&apos;en sert pas, et la rédaction n&apos;en voit jamais aucun.
              {user.passwordSetTokens.length > 0 ? (
                <> Un lien est déjà en attente, valable jusqu&apos;au {formatDate(user.passwordSetTokens[0]!.expiresAt)} ; en envoyer un nouveau annulera le précédent.</>
              ) : null}
            </p>
            <form action={sendPasswordLinkAction.bind(null, user.id)}>
              <button
                type="submit"
                disabled={!emailConfigured}
                className="rounded-pill border border-line bg-surface-2 px-4 py-2.5 text-xs font-bold text-ink disabled:opacity-50"
              >
                ✉ Envoyer un lien de mot de passe
              </button>
            </form>
            {!emailConfigured ? (
              <p className="mt-2 text-[12px] text-red">Serveur d&apos;envoi non configuré : le bouton est inopérant.</p>
            ) : null}
          </div>
        </section>

        <div className="grid gap-5">
          <section className="rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">État du compte</h2>
            <dl className="grid gap-2 text-[13px]">
              <div className="flex justify-between gap-3 border-b border-line-2 pb-2">
                <dt className="text-ink-3">Adresse confirmée</dt>
                <dd className={user.emailVerified ? "font-semibold text-green" : "font-semibold text-orange"}>
                  {user.emailVerified ? formatDate(user.emailVerified) : "non confirmée"}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line-2 pb-2">
                <dt className="text-ink-3">Abonnement</dt>
                <dd className="font-semibold">
                  {user.subscription && user.subscription.plan !== "free"
                    ? `${user.subscription.plan} (${user.subscription.status})`
                    : "aucun"}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line-2 pb-2">
                <dt className="text-ink-3">Activité</dt>
                <dd className="font-semibold">
                  {user._count.articles} art. · {user._count.comments} comm. · {user._count.listings} ann.
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Badges</dt>
                <dd className="font-semibold">{user.badges.map((b) => b.label).join(", ") || "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Rôle et profil</h2>
            {soi ? (
              <p className="text-[12.5px] text-ink-3">
                On ne modifie ni ne supprime son propre compte depuis ici — une rétrogradation par mégarde fermerait le
                Studio à son auteur.
              </p>
            ) : (
              <div className="grid gap-3">
                <form action={setUserRoleAction.bind(null, user.id)} className="flex flex-wrap items-end gap-2">
                  <label className={lab}>
                    Rôle
                    <select name="role" defaultValue={user.role} className={inp}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </label>
                  <button type="submit" className="rounded-pill border border-line bg-surface-2 px-4 py-2.5 text-xs font-bold text-ink">
                    Appliquer
                  </button>
                </form>
                <form action={toggleVerifiedAction.bind(null, user.id)}>
                  <button type="submit" className="rounded-pill border border-line bg-surface-2 px-4 py-2 text-[11.5px] font-bold text-ink">
                    {user.verified ? "Retirer la coche « vérifié »" : "Marquer comme vérifié"}
                  </button>
                </form>
                <div className="border-t border-line-2 pt-3">
                  <UserDeleteButton id={user.id} name={user.name} />
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
