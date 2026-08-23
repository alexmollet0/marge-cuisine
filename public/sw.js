// Service worker minimal (2026-08-23), uniquement pour satisfaire le critère d'installabilité de
// Chrome ("Installer l'application" dans le menu/l'omnibox n'apparaît que si un service worker
// avec un gestionnaire fetch est enregistré — confirmé manquant par un test réel de l'utilisateur
// sur Chrome juste après l'ajout du manifest). PAS de cache, PAS de mode hors-ligne, intentionnel :
// ce projet a déjà eu un vrai incident (2026-08) où un onglet restait bloqué sur un vieux bundle JS
// à cause du cache du navigateur (bfcache Safari iOS) — voir le mécanisme anti-cache dans
// src/main.jsx. Un service worker qui mettrait en cache des réponses réintroduirait exactement ce
// risque, en pire (un SW peut survivre encore plus longtemps qu'un onglet). Ce fichier ne doit
// JAMAIS appeler `event.respondWith(...)` avec une réponse mise en cache — laisser le navigateur
// gérer chaque requête normalement, comme si ce fichier n'existait pas.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Volontairement vide : présence du listener suffit pour l'installabilité, sans jamais
  // intercepter ni mettre en cache une seule requête.
});
