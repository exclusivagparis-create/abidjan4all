import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { PUBLISH_ROLES } from "@/auth";
import { exigerRole } from "@/lib/garde-role";
import { TARIFS_WHATSAPP } from "@/lib/tarifs";

export const metadata: Metadata = { title: "WhatsApp Club · Studio" };
export const dynamic = "force-dynamic";

function jour(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Jours restants avant l'échéance ; négatif une fois celle-ci passée. */
function joursRestants(d: Date): number {
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

/**
 * Suivi du WhatsApp Club.
 *
 * L'adhésion se vend au mois, au trimestre ou à l'année, et rien ne la
 * surveillait : ni le nombre de membres actifs, ni les échéances qui
 * approchent. Or un abonnement au mois se perd en silence — le membre ne
 * renouvelle pas, personne ne le relance, et il faut compter les entrées du
 * groupe WhatsApp pour s'en apercevoir.
 *
 * Écran de lecture seule. L'adhésion s'ouvre et se prolonge par le paiement,
 * sur /club ; la trafiquer ici reviendrait à offrir l'accès sans trace
 * comptable.
 */
export default async function AdminClub() {
  if (!(await exigerRole(PUBLISH_ROLES))) redirect("/admin");

  const membres = await prisma.whatsappMembership.findMany({
    orderBy: { expiresAt: "desc" },
    take: 200,
    select: {
      id: true,
      tier: true,
      expiresAt: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const maintenant = new Date();
  const actifs = membres.filter((m) => m.expiresAt > maintenant);
  const bientot = actifs.filter((m) => joursRestants(m.expiresAt) <= 7);
  const expires = membres.filter((m) => m.expiresAt <= maintenant);

  // Ce que rapporte le parc actif, au tarif de chaque palier. Approximation
  // assumée : c'est le prix de la dernière souscription, pas le réalisé.
  const valeur = actifs.reduce((somme, m) => {
    const palier = TARIFS_WHATSAPP.find((t) => t.id === m.tier);
    return somme + (palier?.prix ?? 0);
  }, 0);

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">WhatsApp Club</h1>
      <p className="mb-6 max-w-[72ch] text-[12.5px] text-ink-3">
        Les adhésions se prennent et se prolongent sur{" "}
        <Link href="/club" className="underline">
          /club
        </Link>
        , par paiement. Cet écran ne fait que les suivre — en particulier les échéances, qu&apos;un abonnement au
        mois franchit vite et sans bruit.
      </p>

      <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Carte valeur={String(actifs.length)} libelle="Membres actifs" detail="accès en cours de validité" />
        <Carte
          valeur={String(bientot.length)}
          libelle="À relancer"
          detail="échéance sous 7 jours"
          alerte={bientot.length > 0}
        />
        <Carte valeur={String(expires.length)} libelle="Expirés" detail="parmi les 200 derniers" />
        <Carte valeur={formatXOF(valeur)} libelle="Parc actif" detail="au tarif de la dernière souscription" />
      </div>

      {bientot.length > 0 ? (
        <p className="mb-5 rounded-md bg-[rgba(244,121,32,0.12)] px-4 py-3 text-[13px] text-ink-2">
          <strong>
            {bientot.length} adhésion{bientot.length > 1 ? "s" : ""} arrive{bientot.length > 1 ? "nt" : ""} à
            échéance sous 7 jours.
          </strong>{" "}
          Un mot dans le groupe avant la coupure vaut mieux qu&apos;une relance après.
        </p>
      ) : null}

      {membres.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-line bg-surface-2 px-5 py-8 text-center text-[13px] text-ink-3">
          Aucune adhésion pour l&apos;instant.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                <th className="px-4 py-2.5">Membre</th>
                <th className="px-4 py-2.5">Formule</th>
                <th className="px-4 py-2.5">Depuis</th>
                <th className="px-4 py-2.5">Échéance</th>
                <th className="px-4 py-2.5">État</th>
              </tr>
            </thead>
            <tbody>
              {membres.map((m) => {
                const restant = joursRestants(m.expiresAt);
                const palier = TARIFS_WHATSAPP.find((t) => t.id === m.tier);
                return (
                  <tr key={m.id} className="border-b border-line-2 align-top last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${m.user.id}`} className="font-semibold text-ink hover:underline">
                        {m.user.name ?? "—"}
                      </Link>
                      <div className="text-[12px] text-ink-3">{m.user.email}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {palier?.label ?? m.tier}
                      {palier ? <div className="text-[12px] text-ink-3">{formatXOF(palier.prix)}</div> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-3">{jour(m.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-2">{jour(m.expiresAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {restant < 0 ? (
                        <span className="font-semibold text-ink-3">Expiré</span>
                      ) : restant <= 7 ? (
                        <span className="font-semibold text-orange">
                          {restant <= 0 ? "Expire aujourd'hui" : `Expire dans ${restant} j`}
                        </span>
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
    </div>
  );
}

function Carte({
  valeur,
  libelle,
  detail,
  alerte = false,
}: {
  valeur: string;
  libelle: string;
  detail: string;
  alerte?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
      <div className={`font-serif text-[26px] font-bold leading-none ${alerte ? "text-orange" : "text-ink"}`}>
        {valeur}
      </div>
      <div className="mt-1.5 text-[12.5px] font-semibold text-ink-2">{libelle}</div>
      <div className="text-[11.5px] text-ink-3">{detail}</div>
    </div>
  );
}
