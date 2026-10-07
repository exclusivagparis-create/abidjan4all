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
 * On lit le premier maillon de `x-forwarded-for`, et cela ne vaut QUE parce
 * que le Caddyfile remplace cet en-tête par l'adresse du pair
 * (`header_up X-Forwarded-For {remote_host}`) au lieu de s'y ajouter.
 *
 * Ce commentaire affirmait l'inverse — que les maillons suivants étaient les
 * forgeables — et c'était faux dans les deux sens : avec un proxy qui ajoute,
 * c'est le premier maillon qui vient du client, donc l'appelant choisissait son
 * propre seau et toutes les limites de ce fichier tombaient.
 *
 * À défaut d'en-tête, tout le monde partage le seau « inconnu » — c'est
 * volontairement sévère : mieux vaut limiter trop que pas du tout.
 */
export function adresseAppelant(request: Request): string {
  return adresseDesEntetes(request.headers);
}

/**
 * Même lecture, depuis des en-têtes seuls.
 *
 * Les actions serveur ne reçoivent pas d'objet `Request` : elles obtiennent
 * leurs en-têtes par `headers()`. Sans cette variante, les formulaires
 * publics — contact, inscription, mot de passe oublié — n'avaient aucun
 * plafond possible, et c'est pour cela qu'ils n'en avaient aucun.
 */
export function adresseDesEntetes(entetes: Headers): string {
  const xff = entetes.get("x-forwarded-for");
  if (xff) {
    const premiere = xff.split(",")[0]?.trim();
    if (premiere) return premiere;
  }
  return entetes.get("x-real-ip")?.trim() || "inconnu";
}

/** Réponse normalisée quand la limite est atteinte. */
export function reponseTropDeRequetes(attendre: number): Response {
  return Response.json(
    { error: "too_many_requests", message: `Trop de requêtes. Réessayez dans ${attendre} s.` },
    { status: 429, headers: { "Retry-After": String(attendre) } }
  );
}
