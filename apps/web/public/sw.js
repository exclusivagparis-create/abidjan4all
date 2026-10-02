/* Service worker Abidjan4All — notifications Web Push (DF-04) et application
   installable. */

/**
 * Nom du cache. Il porte un numéro : le changer à la prochaine modification de
 * ce fichier suffit à purger l'ancien contenu chez tous les lecteurs.
 */
const CACHE = "a4a-v1";

/** Le strict nécessaire pour afficher quelque chose sans réseau. */
const COQUILLE = ["/hors-ligne", "/logo-web-dark.png", "/logo-web-light.png"];

self.addEventListener("install", (event) => {
  // `skipWaiting` : sans lui, une version corrigée du service worker attendrait
  // que tous les onglets soient fermés pour entrer en service — ce qui, sur un
  // téléphone, peut prendre des semaines.
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

/**
 * Réseau d'abord, repli hors ligne ensuite.
 *
 * Un média doit servir l'information fraîche : mettre les pages en cache pour
 * les resservir plus vite afficherait des titres de la veille à des lecteurs
 * qui viennent justement voir ce qui se passe. Le cache ne sert donc qu'au cas
 * où le réseau manque — fréquent en mobilité, et pas seulement à Abidjan.
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/hors-ligne").then((r) => r ?? Response.error())));
    return;
  }

  // Images et polices : le cache évite de les retélécharger à chaque page, et
  // une image d'hier reste une image juste.
  if (req.destination === "image" || req.destination === "font") {
    event.respondWith(
      caches.match(req).then(
        (enCache) =>
          enCache ??
          fetch(req).then((reponse) => {
            if (reponse.ok) {
              const copie = reponse.clone();
              caches.open(CACHE).then((c) => c.put(req, copie));
            }
            return reponse;
          })
      )
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Abidjan4All", {
      body: data.body || "",
      icon: "/icone-192.png",
      badge: "/icone-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      const existing = tabs.find((t) => t.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        return existing.navigate(url);
      }
      return clients.openWindow(url);
    })
  );
});
