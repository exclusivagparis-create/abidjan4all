/**
 * Planificateur A4A — processus dédié.
 *
 * Ces tâches tournaient dans le serveur web, démarrées par instrumentation.ts
 * à chaque boot. Tant qu'une seule instance web tournait, cela fonctionnait.
 * Mais chaque instance tenait son propre `setInterval` : passer à deux
 * instances aurait envoyé deux relances d'échéance à chaque abonné, et publié
 * deux fois les articles programmés.
 *
 * Ce processus est l'unique exécutant. Le service Compose qui le lance ne doit
 * jamais dépasser une réplique — c'est la garantie, et elle est suffisante ici
 * parce que les trois tâches sont déjà idempotentes : la publication filtre
 * sur `status`, la relance mémorise l'échéance déjà traitée, les rapports
 * annonceurs comptent un envoi par période. Un verrou distribué serait du
 * décor tant que ce service reste seul.
 *
 * Le jour où plusieurs répliques deviendraient nécessaires, c'est ici qu'il
 * faudrait poser un verrou — pas dans les tâches elles-mêmes.
 */
import { prisma } from "@a4a/db";
import { INTERVALLE_MS, executerTachesPlanifiees } from "../lib/scheduler";

let enCours = false;
let arretDemande = false;

/**
 * Un tour. Le drapeau `enCours` protège du chevauchement : si une passe
 * dépasse l'intervalle — SMTP lent, base chargée — le tour suivant passe son
 * tour au lieu de s'empiler sur le précédent.
 */
async function tour(): Promise<void> {
  if (enCours || arretDemande) return;
  enCours = true;
  try {
    await executerTachesPlanifiees();
  } catch (e) {
    // executerTachesPlanifiees ne devrait jamais lever ; ce filet évite qu'une
    // exception inattendue tue le processus et laisse les échéances en plan.
    console.error("[planificateur] passe interrompue :", e);
  } finally {
    enCours = false;
  }
}

async function principal(): Promise<void> {
  console.log(`[planificateur] démarré — une passe toutes les ${INTERVALLE_MS / 1000} s`);

  const minuterie = setInterval(() => {
    void tour();
  }, INTERVALLE_MS);

  await tour(); // ne pas attendre le premier intervalle au démarrage

  /**
   * Arrêt propre. Sans cela, `docker compose down` couperait le processus au
   * milieu d'un envoi : un courriel parti sans que `relancePourEcheance` soit
   * écrit, et l'abonné serait relancé une seconde fois au redémarrage.
   */
  const arreter = async (signal: string) => {
    if (arretDemande) return;
    arretDemande = true;
    console.log(`[planificateur] ${signal} reçu — arrêt après la passe en cours`);
    clearInterval(minuterie);

    const limite = Date.now() + 30_000;
    while (enCours && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 200));
    }
    if (enCours) console.warn("[planificateur] passe encore active après 30 s — arrêt forcé");

    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void arreter("SIGTERM"));
  process.on("SIGINT", () => void arreter("SIGINT"));
}

principal().catch(async (e) => {
  console.error("[planificateur] démarrage impossible :", e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
