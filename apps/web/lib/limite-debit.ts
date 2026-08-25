/**
 * Limitation de débit.
 *
 * Le site n'en avait aucune : la page de connexion acceptait un nombre illimité
 * de tentatives, et les routes d'intelligence artificielle — qui coûtent de
 * l'argent à chaque appel — étaient ouvertes sans compte. Avant une ouverture
 * publique, ces deux portes doivent se refermer.
 *
 * Compteur EN MÉMOIRE, volontairement. L'application tourne dans un conteneur
 * unique derrière Caddy : un compteur partagé n'apporterait rien de plus, et
 * Redis, bien que déclaré dans l'environnement, n'a aucun client dans le code —
 * l'introduire pour cela ajouterait une dépendance et un mode de panne à la
 * veille du lancement. Le jour où l'application sera répliquée, c'est CE
 * fichier qu'il faudra changer, et lui seul.
 *
 * Limite : un redémarrage remet les compteurs à zéro. Un attaquant patient
 * pourrait en profiter ; il devra deviner le moment. Le rapport bénéfice/risque
 * penche largement du bon côté face à l'absence totale de limite.
 */

interface Seau {
  /** Nombre de coups dans la fenêtre courante. */
  coups: number;
  /** Fin de la fenêtre, en millisecondes. */
  finFenetre: number;
}

const seaux = new Map<string, Seau>();

/** Purge les entrées expirées — sans quoi la carte croîtrait indéfiniment. */
function purger(maintenant: number) {
  if (seaux.size < 5000) return;
  for (const [cle, s] of seaux) if (s.finFenetre <= maintenant) seaux.delete(cle);
}

export interface Verdict {
  /** L'appel est-il autorisé ? */
  autorise: boolean;
  /** Secondes à attendre avant un nouvel essai (0 si autorisé). */
  attendre: number;
}

/**
 * Consomme un jeton pour `cle`.
 *
 * @param cle      Ce qu'on limite : « connexion:<ip> », « ia:<ip> »…
 * @param max      Nombre d'appels autorisés dans la fenêtre.
 * @param fenetreS Durée de la fenêtre, en secondes.
 */
export function limiter(cle: string, max: number, fenetreS: number): Verdict {
  const maintenant = Date.now();
  purger(maintenant);

  const seau = seaux.get(cle);
  if (!seau || seau.finFenetre <= maintenant) {
    seaux.set(cle, { coups: 1, finFenetre: maintenant + fenetreS * 1000 });
    return { autorise: true, attendre: 0 };
  }

  seau.coups++;
  if (seau.coups > max) {
    return { autorise: false, attendre: Math.ceil((seau.finFenetre - maintenant) / 1000) };
  }
  return { autorise: true, attendre: 0 };
}

/**
 * Adresse de l'appelant, telle que Caddy la transmet.
 *
 * Le premier maillon de `x-forwarded-for` est la seule valeur qui vaille : les
 * suivantes sont ajoutées par les intermédiaires et peuvent être forgées par le
 * client. À défaut, tout le monde partage le seau « inconnu » — c'est
 * volontairement sévère : mieux vaut limiter trop que pas du tout.
 */
export function adresseAppelant(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "inconnu";
}

/** Réponse normalisée quand la limite est atteinte. */
export function reponseTropDeRequetes(attendre: number): Response {
  return Response.json(
    { error: "too_many_requests", message: `Trop de requêtes. Réessayez dans ${attendre} s.` },
    { status: 429, headers: { "Retry-After": String(attendre) } }
  );
}
