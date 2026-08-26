import React, { useEffect } from "react";
import { Receipt, Percent, Printer, Package, QrCode, Camera } from "lucide-react";
import { Logo, BRAND_SOLID, BRAND_GRADIENT, BRAND_SHADOW, TR } from "./App.jsx";

// Même vert que TIER_COLORS.high (src/App.jsx, marge "haute") — dupliqué ici plutôt qu'exporté
// pour ne pas élargir la surface exportée d'App.jsx pour une seule couleur déjà stable.
const MARGIN_HIGH_COLOR = "#10B981";

// Fire-and-forget, jamais bloquant pour le visiteur — voir api/landing.js (POST).
// `?notrack=1` dans l'URL désactive le comptage (2026-08-19) : demandé par l'utilisateur qui
// consulte souvent son propre site (téléphone + ordinateur) et voulait ne plus fausser ses propres
// statistiques — utile aussi pour Claude, qui vérifie régulièrement le site après un déploiement.
// Mettre ce lien en favori (`https://getchefup.com/?notrack=1`) sur chaque appareil utilisé pour
// se contrôler soi-même.
// Amélioration 2026-08-26 : `?notrack=1` ne valait que pour LA visite en cours, donc il fallait
// penser à passer par le lien en favori à chaque fois — en pratique, une visite sur deux comptait
// quand même et gonflait les chiffres. Le choix est désormais mémorisé durablement sur l'appareil :
// une seule ouverture de `getchefup.com/?notrack=1` suffit, ensuite toutes les visites depuis ce
// téléphone/ordinateur sont ignorées, quelle que soit l'URL utilisée. `?notrack=0` fait marche
// arrière si besoin (par exemple pour tester que le comptage fonctionne toujours).
const NOTRACK_KEY = "chefup:notrack";

function isTrackingDisabled() {
  if (typeof window === "undefined") return false;
  try {
    const param = new URLSearchParams(window.location.search).get("notrack");
    if (param === "1") {
      localStorage.setItem(NOTRACK_KEY, "1");
      return true;
    }
    if (param === "0") {
      localStorage.removeItem(NOTRACK_KEY);
      return false;
    }
    return localStorage.getItem(NOTRACK_KEY) === "1";
  } catch (e) {
    // Navigation privée / stockage bloqué : on retombe simplement sur le comportement d'avant.
    return new URLSearchParams(window.location.search).get("notrack") === "1";
  }
}

function logLandingEvent(event) {
  if (isTrackingDisabled()) return;
  fetch("/api/landing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => {});
}

const FEATURES = [
  { icon: Receipt, titleKey: "landingFeatureScanTitle", descKey: "landingFeatureScanDesc" },
  { icon: Percent, titleKey: "landingFeatureMarginTitle", descKey: "landingFeatureMarginDesc" },
  { icon: QrCode, titleKey: "landingFeatureMenuTitle", descKey: "landingFeatureMenuDesc" },
  { icon: Printer, titleKey: "landingFeaturePrintTitle", descKey: "landingFeaturePrintDesc" },
  { icon: Package, titleKey: "landingFeaturePantryTitle", descKey: "landingFeaturePantryDesc" },
];

const PRICING_FEATURE_KEYS = [
  "landingPricingFeature1",
  "landingPricingFeature2",
  "landingPricingFeature3",
  "landingPricingFeature4",
  "landingPricingFeature5",
];

const STEPS = [
  { icon: Camera, titleKey: "landingStep1Title", descKey: "landingStep1Desc" },
  { icon: Percent, titleKey: "landingStep2Title", descKey: "landingStep2Desc" },
  { icon: QrCode, titleKey: "landingStep3Title", descKey: "landingStep3Desc" },
];

// Écran d'accueil public, montré avant le formulaire de connexion tant que
// personne n'est authentifié (voir AuthGate). Purement présentationnel, ne
// touche à aucune donnée — onStart/onLogin ne font que basculer AuthGate sur
// le mode signup/login.
export default function Landing({ lang, LangSwitcher, onStart, onLogin }) {
  const t = (key) => TR[lang]?.[key] ?? TR.fr[key] ?? key;

  useEffect(() => {
    logLandingEvent("view");
  }, []);

  function handleStart() {
    logLandingEvent("start_click");
    onStart();
  }

  function handleLogin() {
    logLandingEvent("login_click");
    onLogin();
  }

  return (
    <div className="min-h-screen font-body" style={{ background: "#1B1815" }}>
      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-16">
        <div className="flex items-center gap-2 justify-center mb-2">
          <Logo size={34} />
          <h1 className="font-display text-white text-xl tracking-wide uppercase">Chefup</h1>
        </div>
        {LangSwitcher}

        <div className="text-center max-w-xl mx-auto mt-6 mb-10">
          <h2 className="font-display text-white text-2xl sm:text-3xl tracking-wide leading-snug mb-4">
            {t("landingHeroTitle")}
          </h2>
          <p className="text-white/60 text-sm sm:text-base leading-relaxed">{t("landingHeroSubtitle")}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-7">
            <button
              type="button"
              onClick={handleStart}
              className="w-full sm:w-auto px-8 py-3 rounded-full font-display uppercase text-xs tracking-wide font-semibold"
              style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
            >
              {t("landingCtaStart")}
            </button>
            <button
              type="button"
              onClick={handleLogin}
              className="w-full sm:w-auto px-8 py-3 rounded-full text-xs font-semibold border border-white/15 text-white/80 hover:bg-white/5"
            >
              {t("landingCtaLogin")}
            </button>
          </div>
          <p className="text-emerald-400/90 text-xs font-semibold mt-3">{t("landingPricingTrial")}</p>
          <p className="text-white/40 text-xs italic mt-5 max-w-md mx-auto">{t("billingFounderStory")}</p>
        </div>

        {/* Aperçu illustratif (2026-08-19) : pas une vraie capture d'écran (indisponible dans cet
            environnement), mais une reconstitution simplifiée d'une fiche recette pour donner un
            avant-goût concret plutôt que de tout décrire en texte — demandé par l'utilisateur pour
            améliorer la conversion d'un trafic froid (TikTok) qui ne connaît pas encore l'app. */}
        <div
          className="max-w-xs mx-auto rounded-2xl p-4 border border-white/10 mb-12"
          style={{ background: "#26221C" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-display uppercase text-xs tracking-wide">{t("landingPreviewDish")}</span>
            <span
              className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold shrink-0"
              style={{ background: `${MARGIN_HIGH_COLOR}22`, color: MARGIN_HIGH_COLOR }}
            >
              75% {t("landingPreviewMarginLabel")}
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-white/50">
              <span>{t("landingPreviewCost")}</span>
              <span className="text-white/80">4,80 €</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>{t("landingPreviewPrice")}</span>
              <span className="text-white/80">21 €</span>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-center font-display text-white/90 uppercase text-xs tracking-widest mb-6">
            {t("landingHowItWorksTitle")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STEPS.map(({ icon: Icon, titleKey, descKey }, i) => (
              <div key={titleKey} className="text-center px-2">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 font-display text-sm relative"
                  style={{ background: `${BRAND_SOLID}22`, color: BRAND_SOLID }}
                >
                  <Icon size={18} />
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] flex items-center justify-center text-white font-semibold"
                    style={{ background: BRAND_GRADIENT }}
                  >
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-white font-display uppercase text-xs tracking-wide mb-1.5">{t(titleKey)}</h3>
                <p className="text-white/50 text-xs leading-relaxed">{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {FEATURES.map(({ icon: Icon, titleKey, descKey }) => (
            <div key={titleKey} className="rounded-2xl p-5 border border-white/10" style={{ background: "#26221C" }}>
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{ background: `${BRAND_SOLID}22`, color: BRAND_SOLID }}
              >
                <Icon size={18} />
              </div>
              <h3 className="text-white font-display uppercase text-xs tracking-wide mb-1.5">{t(titleKey)}</h3>
              <p className="text-white/50 text-xs leading-relaxed">{t(descKey)}</p>
            </div>
          ))}
        </div>

        <div
          className="max-w-sm mx-auto rounded-2xl p-6 border-2 text-center"
          style={{ background: "#26221C", borderColor: BRAND_SOLID }}
        >
          <h3 className="font-display uppercase text-white text-sm tracking-wide mb-3">{t("landingPricingTitle")}</h3>
          <div className="flex items-end justify-center gap-1 mb-1">
            <span className="text-white font-display text-4xl">39€</span>
            <span className="text-white/50 text-sm mb-1">{t("landingPricingPerMonth")}</span>
          </div>
          <p className="text-emerald-400/90 text-xs font-semibold mb-5">{t("landingPricingTrial")}</p>

          <ul className="text-left space-y-2 mb-6">
            {PRICING_FEATURE_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-2 text-white/70 text-xs">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: BRAND_SOLID }} />
                {t(key)}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={handleStart}
            className="w-full py-3 rounded-full font-display uppercase text-xs tracking-wide font-semibold"
            style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
          >
            {t("landingPricingCta")}
          </button>
        </div>

        <div className="text-center mt-10 text-[11px] text-white/30">
          <a href="/mentions-legales.html" className="hover:text-white/60">{t("landingLegalNotice")}</a>
          {" · "}
          <a href="/cgv.html" className="hover:text-white/60">{t("landingTerms")}</a>
          {" · "}
          <a href="/confidentialite.html" className="hover:text-white/60">{t("landingPrivacy")}</a>
        </div>
      </div>
    </div>
  );
}
