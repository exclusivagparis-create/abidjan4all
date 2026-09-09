import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { emailLayout, sendEmail } from "@/lib/email";
import { joursAvant } from "@/lib/periode";
import { prixDu } from "@/lib/offres";

/**
 * Suivi des échéances d'abonnement.
 *
 * Le renouvellement n'est pas automatique : aucun prélèvement récurrent n'est
 * en place côté prestataire. L'abonné doit donc repayer, et jusqu'ici rien ne
 * l'en avertissait — son accès s'interrompait sans préavis, du jour au
 * lendemain. Ces deux passes comblent ce trou : prévenir avant, constater après.
 */

/** Fenêtre de relance, en jours avant l'échéance. */
const JOURS_AVANT_RELANCE = 7;

/**
 * Prévient les abonnés dont la période se termine sous huit jours.
 *
 * Une relance par période grâce à `relancePourEcheance` : le planificateur
 * passe toutes les 60 secondes, un simple « déjà envoyé aujourd'hui » aurait
 * laissé filer des doublons au changement de jour.
 */
export async function relancerEcheancesProches(maintenant: Date = new Date()): Promise<number> {
  const limite = new Date(maintenant.getTime() + JOURS_AVANT_RELANCE * 86_400_000);

  const echeances = await prisma.subscription.findMany({
    where: {
      status: "active",
      plan: { not: "free" },
      currentPeriodEnd: { gt: maintenant, lte: limite },
    },
    include: {
      user: { select: { email: true, name: true } },
      offer: true,
    },
  });

  let envoyees = 0;
  for (const sub of echeances) {
    const echeance = sub.currentPeriodEnd;
    if (!echeance) continue;
    // Déjà relancé pour CETTE échéance : on passe.
    if (sub.relancePourEcheance && sub.relancePourEcheance.getTime() === echeance.getTime()) continue;
    if (!sub.user.email) continue;

    const jours = joursAvant(echeance, maintenant);
    const prix = prixDu(sub.offer, maintenant).prix;
    const quand = echeance.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    const corps = `
      <p>Bonjour${sub.user.name ? ` ${sub.user.name}` : ""},</p>
      <p>Votre abonnement <b>A4A+ ${sub.offer.name}</b> arrive à échéance le <b>${quand}</b>,
      soit dans ${jours} jour${jours > 1 ? "s" : ""}.</p>
      <p>Le renouvellement n'est pas automatique : sans nouveau règlement, votre accès aux articles
      premium et aux archives s'interrompra à cette date. Renouveler prend moins d'une minute,
      au tarif de ${formatXOF(prix)} par mois.</p>
      <p>Si vous avez déjà renouvelé, ce message ne vous concerne plus.</p>
    `;

    const envoye = await sendEmail({
      to: sub.user.email,
      subject: `Votre abonnement A4A+ expire le ${quand}`,
      html: emailLayout("Votre abonnement arrive à échéance", corps, {
        label: "Renouveler mon abonnement",
        url: "/abonnement",
      }),
    });

    // L'échéance n'est mémorisée que si le courriel est réellement parti :
    // sinon une panne SMTP passagère priverait l'abonné de toute relance.
    if (envoye) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { relancePourEcheance: echeance },
      });
      envoyees++;
    }
  }
  return envoyees;
}

/**
 * Bascule en `past_due` les abonnements dont la période est passée.
 *
 * L'accès était déjà refusé — `hasActiveSubscription` compare l'échéance à
 * l'instant présent — mais le statut restait « actif » en base : la liste des
 * abonnés et le MRR comptaient des abonnements qui ne payaient plus.
 *
 * Les abonnements `canceled` ne sont pas touchés : leur statut dit déjà ce
 * qu'il faut, et leur accès s'éteint seul à l'échéance.
 */
export async function marquerEcheancesDepassees(maintenant: Date = new Date()): Promise<number> {
  const { count } = await prisma.subscription.updateMany({
    where: {
      status: "active",
      plan: { not: "free" },
      currentPeriodEnd: { lt: maintenant },
    },
    data: { status: "past_due" },
  });
  return count;
}
