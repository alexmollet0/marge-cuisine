// Suivi technique léger (2026-11-19), pour que le tableau de bord admin sache ce qui marche et ce qui plante : appareil, mode installé (PWA),
// version de l'app, erreurs JavaScript. Rien de personnel : aucun contenu de recette, de facture ou de champ de saisie, jamais d'adresse IP.
// Les événements passent par logActivity (src/pricing.js, api/scan-events.js) : ils ne partent que pour un compte connecté.
import { logActivityOnce } from "./pricing.js";

// Appareil, en quelques mots : système, navigateur, installé sur l'écran d'accueil ou non, taille d'écran, langue.
export function deviceInfo() {
  try {
    const ua = navigator.userAgent || "";
    const standalone = !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
    const os = /iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : /Windows/.test(ua) ? "windows" : /Mac/.test(ua) ? "mac" : /Linux/.test(ua) ? "linux" : "autre";
    const browser = /EdgA?\//.test(ua) ? "edge" : /SamsungBrowser/.test(ua) ? "samsung" : /Firefox|FxiOS/.test(ua) ? "firefox" : /Chrome|CriOS/.test(ua) ? "chrome" : /Safari/.test(ua) ? "safari" : "autre";
    const w = window.innerWidth || 0;
    return { os, navigateur: browser, installee: standalone, ecran: w < 600 ? "mobile" : w < 1024 ? "tablette" : "ordinateur", langue: (navigator.language || "").slice(0, 5) };
  } catch (e) {
    return {};
  }
}

// Version du code que le navigateur exécute (nom du fichier JavaScript généré par Vite) : permet de voir si une erreur vient d'une ancienne version.
export function appVersion() {
  try {
    const src = document.querySelector('script[type="module"]')?.src || "";
    return (src.split("/").pop() || "").slice(0, 40);
  } catch (e) {
    return "";
  }
}

// Erreurs JavaScript non rattrapées : au plus 5 par chargement de page, une même erreur au plus une fois toutes les 5 minutes.
let envoyees = 0;
function envoyer(type, message, extra) {
  if (envoyees >= 5) return;
  const texte = String(message == null ? "" : message).slice(0, 300);
  if (!texte) return;
  envoyees++;
  logActivityOnce(type, { message: texte, version: appVersion(), ...deviceInfo(), ...extra }, texte.slice(0, 80), 5 * 60 * 1000);
}

export function installErrorCapture() {
  window.addEventListener("error", (e) => {
    const msg = e && e.message ? e.message : "";
    if (/ResizeObserver loop/i.test(msg)) return; // bruit sans conséquence du navigateur
    envoyer("client_error", msg, {
      fichier: String(e.filename || "").split("/").pop().slice(0, 60),
      ligne: Number.isFinite(e.lineno) ? e.lineno : null,
      colonne: Number.isFinite(e.colno) ? e.colno : null,
      pile: String((e.error && e.error.stack) || "").slice(0, 600),
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e && e.reason;
    envoyer("client_error", (r && r.message) || String(r), { promesse: true, pile: String((r && r.stack) || "").slice(0, 600) });
  });
}
