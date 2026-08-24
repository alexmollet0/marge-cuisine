import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AuthGate from "./Auth.jsx";
import SubscriptionGate from "./Billing.jsx";
import PublicMenu from "./PublicMenu.jsx";
import "./index.css";

// Carte digitale publique (2026-08) : seule route de l'app en dehors de "/" — accessible sans
// connexion, via le QR code généré dans Paramètres. Pas de vraie librairie de routage pour un
// unique chemin public ; voir vercel.json pour le rewrite serveur qui sert index.html sur /menu/*.
const menuMatch = window.location.pathname.match(/^\/menu\/([^/]+)/);

// Détection de bundle périmé (2026-08) : sur mobile (Safari iOS en particulier), un onglet
// laissé ouvert en arrière-plan peut continuer à exécuter une ancienne version du JS pendant des
// jours sans jamais refaire de vraie requête réseau (page restaurée depuis le bfcache), même
// après avoir "fermé la page"/retapé l'URL dans certains cas — cas réel trouvé en test (2026-08,
// correctif scanner invisible sur un téléphone alors que confirmé fonctionnel sur ordinateur avec
// le même déploiement). Un vrai client ne fera jamais les manipulations de contournement (fermer
// complètement le navigateur, navigation privée, vider le cache) : on détecte nous-mêmes la
// situation et on recharge automatiquement, sans action de sa part.
const currentScriptSrc = document.querySelector('script[type="module"]')?.src || "";
const checkForNewVersion = () => {
  if (document.visibilityState !== "visible" || !currentScriptSrc) return;
  // Ne jamais recharger pendant qu'un scan (facture/fiche recette) est ouvert dans App.jsx — sinon
  // le retour de focus après une photo prise avec l'appareil natif (le cas le plus fréquent sur
  // téléphone) efface la photo en attente sans prévenir. Le flag est mis à jour par App.jsx ; on
  // retentera simplement au prochain visibilitychange/focus, une fois le scan fermé.
  if (window.__chefupScanBusy) return;
  fetch("/", { cache: "no-store" })
    .then((res) => res.text())
    .then((html) => {
      const match = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/i);
      const latestSrc = match ? new URL(match[1], window.location.origin).href : "";
      if (latestSrc && latestSrc !== currentScriptSrc) window.location.reload();
    })
    .catch(() => {});
};
document.addEventListener("visibilitychange", checkForNewVersion);
window.addEventListener("focus", checkForNewVersion);

// Service worker minimal (2026-08-23), uniquement pour que Chrome propose "Installer
// l'application" (confirmé manquant par un test réel avant cet ajout — sans service worker actif,
// Chrome n'affiche jamais l'icône/le menu d'installation, sur bureau comme sur Android ; iOS Safari
// n'a pas cette contrainte, "Sur l'écran d'accueil" fonctionnait déjà). Voir public/sw.js : il ne
// met RIEN en cache, exprès, pour ne jamais interférer avec la détection de nouveau déploiement
// juste au-dessus.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Capture de l'invite d'installation Chrome/Edge (2026-08-23), pour un vrai bouton "Installer
// l'application" DANS l'app plutôt que de compter sur l'utilisateur pour trouver le menu du
// navigateur lui-même (demandé par l'utilisateur après un test réel où il ne trouvait rien).
// Chrome ne déclenche cet événement que si le site est jugé installable (manifest + service
// worker, voir plus haut) — d'où `window.__chefupInstallPrompt`, lu par le bouton dans App.jsx
// (accountMenuOpen). ⚠️ Sur iOS Safari, cet événement n'existe pas du tout — Apple interdit à
// n'importe quel site de déclencher "Sur l'écran d'accueil" par programme, seul le geste manuel
// (bouton Partager) fonctionne ; App.jsx affiche des instructions à la place dans ce cas.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__chefupInstallPrompt = e;
  window.dispatchEvent(new Event("chefup:install-available"));
});
window.addEventListener("appinstalled", () => {
  window.__chefupInstallPrompt = null;
  window.dispatchEvent(new Event("chefup:install-available"));
});
// Signal le plus direct d'une restauration depuis le bfcache : à ne jamais laisser passer sans
// vérifier, c'est exactement le scénario qui a caché le correctif du scanner sur un téléphone.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) checkForNewVersion();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {menuMatch ? (
      <PublicMenu menuId={menuMatch[1]} />
    ) : (
      <AuthGate>
        <SubscriptionGate>
          <App />
        </SubscriptionGate>
      </AuthGate>
    )}
  </React.StrictMode>
);
