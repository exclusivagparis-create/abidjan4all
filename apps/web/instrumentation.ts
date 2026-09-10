/**
 * Point d'entrée d'instrumentation Next.
 *
 * Le planificateur démarrait ici, à chaque boot du serveur web. Il vit
 * désormais dans son propre processus — `scripts/planificateur.ts`, lancé par
 * le service `scheduler` de docker-compose.prod.yml.
 *
 * La raison n'est pas cosmétique : chaque instance web tenait son propre
 * `setInterval`. Passer à deux instances aurait envoyé deux relances
 * d'échéance à chaque abonné et publié deux fois les articles programmés.
 * Le code le signalait lui-même depuis le début.
 *
 * Ce fichier reste : Next l'appelle au démarrage, et c'est ici qu'irait une
 * initialisation qui appartient vraiment au serveur web (traçage, métriques).
 */
export async function register() {
  // Rien à initialiser côté web pour l'instant.
}
