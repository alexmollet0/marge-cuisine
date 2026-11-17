import React, { useState } from "react";
import { BRAND_SOLID, BRAND_GRADIENT, BRAND_SHADOW } from "./brand.js";

// Ce qui s'échappe chaque mois (2026-11-18, remplace le diagnostic de marge par plat : retiré car
// une personne qui avait bien saisi ses plats ne voyait rien de nouveau dedans).
// Tout se calcule à partir des réponses de la personne, sans table externe ni appel serveur.
// Hypothèse VISIBLE à l'écran : la hausse touche la totalité des achats du mois. Le montant est
// présenté comme ce qui se passe si une hausse passe inaperçue, jamais comme une promesse.
const SEMAINES_PAR_MOIS = 4.33;
const MINUTES_PAR_LIGNE = 1;
const LOCALES = { fr: "fr-FR", es: "es-ES", en: "en-GB" };

const entier = (v) => parseInt(String(v).replace(/\D/g, ""), 10) || 0;

export default function Diagnostic({ t, lang, onEvent, onStart }) {
  const [step, setStep] = useState(0);
  const [ca, setCa] = useState(30000);
  const [partAchats, setPartAchats] = useState(30);
  const [hausse, setHausse] = useState(5);
  const [lignes, setLignes] = useState(40);
  const [aDemarre, setADemarre] = useState(false);

  const locale = LOCALES[lang] || "fr-FR";
  const euros = (v) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  const nombre = (v, decimales = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: decimales }).format(v);

  const achatsMois = (ca * partAchats) / 100;
  const perteMois = (achatsMois * hausse) / 100;
  const perteAn = perteMois * 12;
  const heuresMois = (lignes * SEMAINES_PAR_MOIS * MINUTES_PAR_LIGNE) / 60;

  function modifier(setter) {
    return (valeur) => {
      if (!aDemarre) {
        setADemarre(true);
        onEvent("diag_start");
      }
      setter(valeur);
    };
  }

  function voirResultat() {
    setStep(1);
    onEvent("diag_result");
  }

  function creerCompte() {
    onEvent("diag_signup_click");
    onStart();
  }

  const champ = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30";
  const boutonPrincipal = "w-full py-3 rounded-full font-display uppercase text-xs tracking-wide font-semibold text-white";
  const style = { background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW };

  if (step === 0) {
    return (
      <section className="max-w-md mx-auto rounded-2xl p-5 border border-white/10 mb-8" style={{ background: "#201B15" }}>
        <h3 className="text-white font-display uppercase text-sm tracking-wide mb-1">{t("diagTitle")}</h3>
        <p className="text-white/50 text-xs mb-4">{t("diagIntro")}</p>
        <div className="space-y-3 mb-5">
          <label className="block text-white/60 text-[11px]">
            {t("diagRevenue")}
            <input className={`${champ} mt-1`} inputMode="numeric" value={ca} onChange={(e) => modifier(setCa)(entier(e.target.value))} />
          </label>
          <label className="block text-white/60 text-[11px]">
            {t("diagPurchasesShare")}
            <input className={`${champ} mt-1`} inputMode="numeric" value={partAchats} onChange={(e) => modifier(setPartAchats)(Math.min(100, entier(e.target.value)))} />
          </label>
          <label className="block text-white/60 text-[11px]">
            {t("diagIncrease")}
            <input className={`${champ} mt-1`} inputMode="numeric" value={hausse} onChange={(e) => modifier(setHausse)(Math.min(100, entier(e.target.value)))} />
          </label>
          <label className="block text-white/60 text-[11px]">
            {t("diagLines")}
            <input className={`${champ} mt-1`} inputMode="numeric" value={lignes} onChange={(e) => modifier(setLignes)(entier(e.target.value))} />
          </label>
        </div>
        <button type="button" onClick={voirResultat} className={boutonPrincipal} style={style}>
          {t("diagSee")}
        </button>
      </section>
    );
  }

  return (
    <section className="max-w-md mx-auto rounded-2xl p-5 border border-white/10 mb-8" style={{ background: "#201B15" }}>
      <div className="text-white/50 text-[11px] uppercase tracking-widest mb-3">{t("diagLossLabel")}</div>
      <div className="rounded-xl p-5 text-center mb-4" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
        <div className="font-display text-4xl text-white leading-none">{euros(perteMois)}</div>
        <div className="text-white/80 text-sm mt-1">{t("diagLossPerMonth")(euros(perteMois))}</div>
        <div className="font-bold text-base mt-3" style={{ color: "#f87171" }}>{t("diagLossPerYear")(euros(perteAn))}</div>
      </div>
      <p className="text-white/70 text-sm mb-2">{t("diagLossExplain")(nombre(hausse), euros(achatsMois))}</p>
      <p className="text-white/70 text-sm mb-4">{t("diagHours")(nombre(heuresMois, 1))}</p>
      <p className="text-white/30 text-[10px] mb-5">{t("diagDisclaimer")}</p>
      <button type="button" onClick={creerCompte} className={boutonPrincipal} style={style}>
        {t("diagCta")}
      </button>
      <p className="text-white/40 text-[11px] text-center mt-2">{t("diagCtaNote")}</p>
      <button type="button" onClick={() => setStep(0)} className="w-full mt-3 text-[11px] text-white/40 hover:text-white/70">
        {t("diagBack")}
      </button>
    </section>
  );
}
