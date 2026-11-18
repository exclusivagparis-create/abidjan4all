import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { auth, PUBLISH_ROLES, ADMIN_ROLES } from "@/auth";
import { exigerRole } from "@/lib/garde-role";
import { roleAdmis } from "@/lib/roles";
import { TARIFS_RECRUTEUR } from "@/lib/tarifs";
import { accorderRoleRecruteur, retirerRoleRecruteur } from "@/lib/actions/cvtheque-actions";

export const metadata: Metadata = { title: "CVthèque · Studio" };
export const dynamic = "force-dynamic";

const ERREURS: Record<string, string> = {
  email_vide: "Indiquez l'adresse e-mail du compte.",
  introuvable: "Aucun compte avec cette adresse. Le recruteur doit d'abord créer son compte sur le site.",
  deja: "Ce compte a déjà le rôle recruteur.",
  role_superieur:
    "Ce compte appartient à la rédaction ou à la régie. Lui donner « recruteur » le lui ferait perdre — à modifier depuis sa fiche si c'est voulu.",
};

function jour(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Jours restants avant l'échéance ; négatif une fois celle-ci passée. */
function joursRestants(d: Date): number {
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

/**
 * Suivi de la CVthèque.
 *
 * Deux populations s'y croisent et n'ont rien à voir : les candidats, qui
 * déposent leur CV gratuitement et en maîtrisent la visibilité, et les
 * recruteurs, qui paient pour voir leurs coordonnées.
 *
 * Cet écran existe pour la seconde. Personne ne savait jusqu'ici combien
 * d'accès étaient actifs ni quand ils expiraient — or un accès qui expire sans
 * que personne ne s'en aperçoive est un renouvellement perdu.
 *
 * Rien ne s'y modifie du côté des candidats : leur CV leur appartient, et
 * c'est ce que la page publique leur promet.
 */
export default async function AdminCvtheque({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const [{ erreur }, session] = await Promise.all([searchParams, auth()]);
  if (!(await exigerRole(PUBLISH_ROLES))) redirect("/admin");
  const estAdmin = roleAdmis(session?.user?.role, ADMIN_ROLES);

  const [profilsPublics, profilsMasques, acces, permanents] = await Promise.all([
    prisma.cvProfile.count({ where: { isPublic: true } }),
    prisma.cvProfile.count({ where: { isPublic: false } }),
    prisma.recruiterAccess.findMany({
      orderBy: { expiresAt: "desc" },
      take: 100,
      select: {
        id: true,
        tier: true,
        expiresAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "recruteur" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const actifs = acces.filter((a) => a.expiresAt > new Date());
  const bientot = actifs.filter((a) => joursRestants(a.expiresAt) <= 15);
  const inp = "rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]";

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">CVthèque</h1>
      <p className="mb-6 max-w-[72ch] text-[12.5px] text-ink-3">
        Les CV sont déposés par les candidats, qui en maîtrisent la visibilité — rien ne se modifie ici de leur
        côté. Ce que cet écran suit, c&apos;est l&apos;autre bout : qui a payé l&apos;accès aux coordonnées, et
        jusqu&apos;à quand.
      </p>

      {erreur && ERREURS[erreur] ? (
        <p className="mb-5 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
          {ERREURS[erreur]}
        </p>
      ) : null}

      <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Carte valeur={profilsPublics} libelle="CV publiés" detail="visibles dans la CVthèque" />
        <Carte valeur={profilsMasques} libelle="CV masqués" detail="retirés par leur auteur" />
        <Carte
          valeur={actifs.length}
          libelle="Accès payants actifs"
          detail={bientot.length > 0 ? `${bientot.length} expirent sous 15 jours` : "aucun n'expire sous 15 jours"}
        />
        <Carte valeur={permanents.length} libelle="Accès permanents" detail="rôle accordé à la main" />
      </div>

      <h2 className="mb-3 text-[15px] font-bold">Accès payants</h2>
      {acces.length === 0 ? (
        <p className="mb-8 rounded-[14px] border border-dashed border-line bg-surface-2 px-5 py-7 text-center text-[13px] text-ink-3">
          Aucun accès vendu pour l&apos;instant. La page{" "}
          <Link href="/recruteur" className="underline">
            /recruteur
          </Link>{" "}
          présente les trois paliers.
        </p>
      ) : (
        <div className="mb-8 overflow-hidden rounded-[14px] border border-line bg-surface">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                <th className="px-4 py-2.5">Recruteur</th>
                <th className="px-4 py-2.5">Palier</th>
                <th className="px-4 py-2.5">Échéance</th>
                <th className="px-4 py-2.5">État</th>
              </tr>
            </thead>
            <tbody>
              {acces.map((a) => {
                const restant = joursRestants(a.expiresAt);
                const palier = TARIFS_RECRUTEUR.find((t) => t.id === a.tier);
                return (
                  <tr key={a.id} className="border-b border-line-2 align-top last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${a.user.id}`} className="font-semibold text-ink hover:underline">
                        {a.user.name ?? "—"}
                      </Link>
                      <div className="text-[12px] text-ink-3">{a.user.email}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {palier?.label ?? a.tier}
                      {palier ? <div className="text-[12px] text-ink-3">{formatXOF(palier.prix)}</div> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-2">{jour(a.expiresAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {restant < 0 ? (
                        <span className="font-semibold text-ink-3">Expiré</span>
                      ) : restant <= 15 ? (
                        <span className="font-semibold text-orange">Expire dans {restant} j</span>
                      ) : (
                        <span className="font-semibold text-green">Actif — {restant} j</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-2 text-[15px] font-bold">Accès permanents</h2>
      <p className="mb-3 max-w-[72ch] text-[12.5px] text-ink-3">
        Le rôle « recruteur » ouvre les coordonnées sans échéance et sans paiement. À réserver aux partenaires et
        aux essais : c&apos;est ce que la régie vend {formatXOF(400000)} l&apos;année.
      </p>

      {estAdmin ? (
        <form action={accorderRoleRecruteur} className="mb-4 flex flex-wrap items-end gap-2.5">
          <label className="grid gap-1.5 text-xs font-semibold text-ink-2">
            Adresse e-mail du compte
            <input
              name="email"
              type="email"
              required
              placeholder="recruteur@entreprise.ci"
              className={`${inp} min-w-[280px]`}
            />
          </label>
          <button type="submit" className="rounded-[8px] bg-navy px-4 py-2 text-[13px] font-semibold text-white">
            Accorder le rôle
          </button>
        </form>
      ) : (
        <p className="mb-4 text-[12.5px] text-ink-3">
          Seule l&apos;administration peut accorder ou retirer ce rôle.
        </p>
      )}

      {permanents.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-line bg-surface-2 px-5 py-7 text-center text-[13px] text-ink-3">
          Aucun accès permanent accordé.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
          <table className="w-full text-[13px]">
            <tbody>
              {permanents.map((u) => (
                <tr key={u.id} className="border-b border-line-2 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="font-semibold text-ink hover:underline">
                      {u.name ?? "—"}
                    </Link>
                    <div className="text-[12px] text-ink-3">{u.email}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {estAdmin ? (
                      <form action={retirerRoleRecruteur}>
                        <input type="hidden" name="userId" value={u.id} />
                        <button
                          type="submit"
                          className="rounded-[8px] border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink"
                        >
                          Retirer
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Carte({ valeur, libelle, detail }: { valeur: number; libelle: string; detail: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
      <div className="font-serif text-[26px] font-bold leading-none text-ink">{valeur}</div>
      <div className="mt-1.5 text-[12.5px] font-semibold text-ink-2">{libelle}</div>
      <div className="text-[11.5px] text-ink-3">{detail}</div>
    </div>
  );
}
