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
