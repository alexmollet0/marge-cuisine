import React from "react";
import { logActivityOnce } from "./pricing.js";
import { deviceInfo, appVersion } from "./telemetry.js";

// Filet de sécurité (2026-11-19) : si l'application plante pendant l'affichage, on montre un message et un bouton « Recharger » au lieu d'un écran blanc
// (cas signalé le 2026-08-31 : écran blanc figé après « Voir la carte »), et le plantage est journalisé (« client_crash ») pour le tableau de bord admin.
// Les données ne sont pas touchées : elles sont enregistrées au fil de l'eau (useDebouncedSave). Textes indépendants du thème et de TR : ce composant
// doit pouvoir s'afficher même si le reste de l'application est cassé.
const MOTS = {
  fr: { titre: "Oups, un problème est survenu", texte: "Tes données sont enregistrées. Recharge la page pour continuer.", bouton: "Recharger" },
  es: { titre: "Vaya, ha ocurrido un problema", texte: "Tus datos están guardados. Recarga la página para continuar.", bouton: "Recargar" },
  en: { titre: "Oops, something went wrong", texte: "Your data is saved. Reload the page to continue.", bouton: "Reload" },
};

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { erreur: null };
  }

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur, info) {
    try {
      logActivityOnce(
        "client_crash",
        {
          message: String((erreur && erreur.message) || erreur).slice(0, 300),
          pile: String((erreur && erreur.stack) || "").slice(0, 600),
          composants: String((info && info.componentStack) || "").slice(0, 600),
          version: appVersion(),
          ...deviceInfo(),
        },
        "crash",
        60 * 1000
      );
    } catch (e) {
      /* le suivi ne doit jamais aggraver le plantage */
    }
  }

  render() {
    if (!this.state.erreur) return this.props.children;
    let lang = "fr";
    try {
      const nav = (navigator.language || "fr").slice(0, 2);
      if (MOTS[nav]) lang = nav;
    } catch (e) {}
    const m = MOTS[lang];
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#16130F", color: "#fff", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 10px" }}>{m.titre}</h1>
          <p style={{ fontSize: 14, margin: "0 0 20px", color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{m.texte}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ border: 0, borderRadius: 999, padding: "12px 28px", fontSize: 15, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #C9793B, #E0A050)", cursor: "pointer" }}
          >
            {m.bouton}
          </button>
        </div>
      </div>
    );
  }
}
