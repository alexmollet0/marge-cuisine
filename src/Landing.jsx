import React, { useEffect, useState } from "react";
import { Receipt, Percent, Printer, Package, QrCode, Camera, Check } from "lucide-react";
import { Logo, BRAND_SOLID, BRAND_GRADIENT, BRAND_SHADOW, TR, PRICING, TIER_COLORS, marginTier } from "./App.jsx";
import { shouldAskConsent, grantConsent, denyConsent, initPixelIfConsented, trackAdEvent } from "./adPixel.js";

// TVA restauration sur place, valeur par défaut de l'app (settings.vatRate) : le calculateur de
// démonstration doit donner exactement le même résultat que l'app pour les mêmes chiffres, sinon
// le visiteur découvre un autre pourcentage une fois inscrit et perd confiance.
const DEMO_VAT_RATE = 10;
// Objectif de marge par défaut de l'app — décide du seuil vert/orange (voir marginTier).
const DEMO_TARGET_MARGIN = 75;

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

// Provenance de la visite (2026-08-26) : `?src=tiktok` dans le lien d'une campagne. Mémorisée
// pour la session (sessionStorage, pas localStorage) parce que le clic sur "Commencer" arrive
// souvent après une navigation qui a perdu le paramètre — mais elle ne doit pas coller à
// l'appareil pour toujours, sinon une visite organique du mois suivant serait encore comptée
// comme venant de la campagne.
const SRC_KEY = "chefup:src";

function campaignSource() {
  if (typeof window === "undefined") return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("src");
    if (fromUrl) {
      sessionStorage.setItem(SRC_KEY, fromUrl);
      return fromUrl;
    }
    return sessionStorage.getItem(SRC_KEY);
  } catch (e) {
    return new URLSearchParams(window.location.search).get("src");
  }
}

function logLandingEvent(event) {
  if (isTrackingDisabled()) return;
  fetch("/api/landing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, source: campaignSource() }),
  }).catch(() => {});
}

// [CORRECTION DE MESURE, 2026-08-27] Une visite n'est comptée que si la page a été RÉELLEMENT
// AFFICHÉE à un humain. Motif : la première campagne TikTok payante a produit 970 "visites" pour
// 1 seul clic (0,1%), un chiffre 20 à 100 fois inférieur à ce que donne même une mauvaise page —
// donc le dénominateur était faux, pas la page (vérifiée bonne : rendu correct, 416ms de
// chargement, formulaire fonctionnel). Les régies publicitaires préchargent la page de destination
// pendant que la vidéo défile, dans une vue web masquée : le JavaScript s'exécute, le composant se
// monte, l'événement partait — sans qu'aucun être humain n'ait rien vu ni cliqué.
// On attend donc que l'onglet soit visible. S'il ne l'est jamais, rien n'est envoyé.
function logViewWhenVisible() {
  if (typeof document === "undefined") return () => {};
  if (document.visibilityState === "visible") {
    logLandingEvent("view");
    return () => {};
  }
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      logLandingEvent("view");
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
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

// Accepte la virgule comme séparateur décimal : un restaurateur français tape "4,80", pas "4.80".
const parseAmount = (raw) => {
  const n = parseFloat(String(raw).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// Champ montant du calculateur. `text` plutôt que `number` : sur mobile, un input number refuse la
// virgule sur certains claviers et affiche des flèches inutiles. `inputMode="decimal"` fait quand
// même apparaître le pavé numérique. Taille de police à 16px minimum, sinon iOS zoome au focus et
// le visiteur se retrouve avec une page à moitié hors écran — abandon quasi garanti.
function AmountField({ value, onChange, suffix, ariaLabel }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg px-3 py-2.5" style={{ background: "rgba(0,0,0,0.25)" }}>
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 bg-transparent text-white text-base font-semibold outline-none text-right"
      />
      <span className="text-white/40 text-sm shrink-0">{suffix}</span>
    </div>
  );
}

// [CHANGEMENT MAJEUR, 2026-08-27] Calculateur de marge jouable SANS COMPTE, à la place de
// l'ancienne reconstitution statique d'une fiche recette.
// Motif : la première campagne payante a montré que personne ne franchissait l'étape "créer un
// compte" — or jusqu'ici, on ne pouvait strictement rien voir du produit avant de s'inscrire. La
// page décrivait une promesse ("connais ta marge") sans jamais la démontrer. Ici le visiteur entre
// ses propres chiffres et voit SA marge, avec la même couleur et le même calcul que dans l'app :
// la promesse devient vérifiable en quinze secondes, sans email, sans mot de passe.
function MarginCalculator({ t, lang, onEngage, onStart }) {
  const [cost, setCost] = useState("4,80");
  const [price, setPrice] = useState("21");

  const c = parseAmount(cost);
  const p = parseAmount(price);
  const priceHT = p !== null ? p / (1 + DEMO_VAT_RATE / 100) : null;
  const margin = priceHT !== null && priceHT > 0 && c !== null ? ((priceHT - c) / priceHT) * 100 : null;
  const tier = marginTier(margin, DEMO_TARGET_MARGIN);
  const color = tier ? TIER_COLORS[tier] : "rgba(255,255,255,0.3)";

  // Signale une seule fois qu'un visiteur a réellement manipulé le calculateur — c'est le signal
  // d'intérêt le plus fiable de toute la page, bien plus qu'une visite.
  const engaged = React.useRef(false);
  const touch = () => {
    if (!engaged.current) {
      engaged.current = true;
      onEngage();
    }
  };

  return (
    <div className="max-w-sm mx-auto rounded-2xl p-5 border border-white/10 mb-12" style={{ background: "#201B15" }}>
      <div className="text-center mb-4">
        <div className="font-display uppercase text-xs tracking-widest text-white/90">{t("calcTitle")}</div>
        <div className="text-white/40 text-[11px] mt-1">{t("calcSubtitle")}</div>
      </div>

      <label className="block text-white/50 text-[11px] mb-1">{t("calcCostLabel")}</label>
      <AmountField value={cost} onChange={(v) => { setCost(v); touch(); }} suffix="€" ariaLabel={t("calcCostLabel")} />

      <label className="block text-white/50 text-[11px] mb-1 mt-3">{t("calcPriceLabel")}</label>
      <AmountField value={price} onChange={(v) => { setPrice(v); touch(); }} suffix="€" ariaLabel={t("calcPriceLabel")} />

      <div className="mt-5 rounded-xl px-4 py-4 text-center" style={{ background: `${color}18`, border: `1px solid ${color}55` }}>
        <div className="text-white/45 text-[10px] uppercase tracking-widest">{t("calcResultLabel")}</div>
        <div className="font-display text-5xl leading-none mt-1" style={{ color }}>
          {margin === null ? "—" : `${Math.round(margin)}%`}
        </div>
        {margin !== null && (
          <div className="text-[11px] mt-2 font-semibold" style={{ color }}>
            {t(tier === "high" ? "calcVerdictHigh" : tier === "mid" ? "calcVerdictMid" : "calcVerdictLow")}
          </div>
        )}
      </div>

      <p className="text-white/30 text-[10px] mt-3 text-center leading-relaxed">{t("calcVatNote")(DEMO_VAT_RATE)}</p>

      {/* [AJOUT 2026-08-27] Sans ce bloc, le calculateur donne l'impression que l'app se résume à
          trois champs et une division — c'est-à-dire à quelque chose qu'on ferait aussi bien sur
          une calculatrice. Il faut donc dire, à l'endroit exact où le visiteur vient d'obtenir son
          résultat, ce que l'app fait EN PLUS : remplir ce coût toute seule, le tenir à jour, et
          tout ce qui en découle. C'est la contrepartie indispensable d'une démo volontairement
          simplifiée, surtout pour un visiteur qui ne défilera peut-être jamais plus bas. */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="text-white/70 text-[11px] font-semibold mb-2">{t("calcMoreTitle")}</div>
        <ul className="space-y-1.5">
          {["calcMore1", "calcMore2", "calcMore3"].map((key) => (
            <li key={key} className="flex items-start gap-2 text-white/50 text-[11px] leading-relaxed">
              <Check size={12} className="shrink-0 mt-0.5" style={{ color: BRAND_SOLID }} />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="w-full mt-4 py-3 rounded-full font-display uppercase text-[11px] tracking-wide font-semibold"
        style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
      >
        {t("calcCta")}
      </button>
    </div>
  );
}

// Écran d'accueil public, montré avant le formulaire de connexion tant que
// personne n'est authentifié (voir AuthGate). Purement présentationnel, ne
// touche à aucune donnée — onStart/onLogin ne font que basculer AuthGate sur
// le mode signup/login.
export default function Landing({ lang, LangSwitcher, onStart, onLogin }) {
  const t = (key) => TR[lang]?.[key] ?? TR.fr[key] ?? key;
  // L'anglais place le symbole avant le montant (€29), le français et l'espagnol après (29€).
  const money = (v) => (lang === "en" ? `€${v}` : `${v}€`);
  // Offre de lancement. Volontairement CACHÉE par défaut : elle ne s'affiche que si le serveur
  // confirme explicitement qu'elle est active (`enabled`), c'est-à-dire que le prix fondateur
  // existe bien côté Stripe. Sans cette prudence, un simple appel raté afficherait 29€ à un
  // visiteur qui serait en réalité prélevé au tarif normal. `spots` à null = offre active mais
  // compteur indisponible : on affiche l'offre sans le chiffre. `spots` à 0 = places épuisées,
  // l'offre disparaît et le tarif normal reprend sa place — jamais de rareté qui ne serait plus vraie.
  const [offer, setOffer] = useState(null);
  const spots = offer ? offer.remaining : null;
  const launchOfferOpen = !!offer && (spots === null || spots > 0);
  // Bannière de consentement publicitaire : uniquement pour un visiteur venu d'une campagne, et
  // uniquement s'il n'a encore rien décidé. Voir src/adPixel.js pour le raisonnement complet.
  const [askConsent, setAskConsent] = useState(false);

  useEffect(() => {
    initPixelIfConsented();
    setAskConsent(shouldAskConsent(campaignSource()));
    const stopWatchingVisibility = logViewWhenVisible();
    // Deuxième mesure, plus exigeante : quelqu'un qui reste 3 secondes sur la page l'a vraiment
    // regardée. Comparer "visites" et "3s+" dit immédiatement si le trafic d'une campagne est
    // composé d'êtres humains ou de simples chargements — un écart énorme entre les deux est le
    // signe d'un trafic qui ne vaut rien, quelle que soit la qualité de la page.
    const engagedTimer = setTimeout(() => {
      if (document.visibilityState === "visible") logLandingEvent("engaged");
    }, 3000);
    fetch("/api/landing?spots=1")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.enabled) setOffer({ remaining: typeof d.remaining === "number" ? d.remaining : null });
      })
      .catch(() => {});
    return () => {
      stopWatchingVisibility();
      clearTimeout(engagedTimer);
    };
  }, []);

  function handleStart() {
    logLandingEvent("start_click");
    // `ClickButton` est l'événement standard TikTok le plus proche d'un "il a commencé le
    // parcours". La vraie conversion (`CompleteRegistration`) est envoyée depuis src/Auth.jsx,
    // une fois le compte réellement créé.
    trackAdEvent("ClickButton", { content_name: "start_signup" });
    onStart();
  }

  function handleLogin() {
    logLandingEvent("login_click");
    onLogin();
  }

  return (
    <div className="min-h-screen font-body" style={{ background: "#16130F" }}>
      {/* Bandeau de consentement publicitaire — volontairement en BAS et non bloquant : il ne
          masque ni le titre, ni le bouton principal, ni le calculateur. Un visiteur qui l'ignore
          peut faire tout le parcours normalement, simplement sans être mesuré côté régie. */}
      {askConsent && (
        <div
          className="fixed bottom-0 inset-x-0 z-50 px-4 py-3 border-t"
          style={{ background: "rgba(38,34,28,0.97)", borderColor: "rgba(255,255,255,0.12)" }}
        >
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-white/60 text-[11px] leading-relaxed flex-1">
              {t("consentText")}{" "}
              <a href="/confidentialite.html" className="underline hover:text-white/80">
                {t("landingPrivacy")}
              </a>
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => { denyConsent(); setAskConsent(false); }}
                className="px-4 py-2 rounded-full text-[11px] font-semibold border border-white/15 text-white/70"
              >
                {t("consentRefuse")}
              </button>
              <button
                type="button"
                onClick={() => { grantConsent(); setAskConsent(false); }}
                className="px-4 py-2 rounded-full text-[11px] font-semibold text-white"
                style={{ background: BRAND_GRADIENT }}
              >
                {t("consentAccept")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-16">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Logo size={34} />
            <h1 className="font-display text-white text-xl tracking-wide uppercase">Chefup</h1>
          </div>
          {/* [RESTRUCTURATION 2026-08-27, refonte conversion] "J'ai déjà un compte" était un
              deuxième bouton de même poids visuel que le CTA principal, juste sous le titre — pour
              un visiteur froid venu de pub (99% des cas), c'est une hésitation gratuite : il n'a
              jamais eu de compte. Redescendu en simple lien discret, toujours là pour qui revient
              sur le lien une 2e fois, mais qui ne dispute plus l'attention du CTA principal. */}
          <button type="button" onClick={handleLogin} className="text-[11px] text-white/40 hover:text-white/70 shrink-0">
            {t("landingCtaLogin")}
          </button>
        </div>
        {LangSwitcher}

        {/* [RESTRUCTURATION 2026-08-27, refonte conversion] Mesuré sur la 1re semaine de campagne :
            203 visiteurs restés 3s+ ("engaged") sur la page, mais seulement 3 clics sur "Commencer"
            et 0 (zéro) utilisation du calculateur — alors que le calculateur, lui, était placé APRÈS
            un long titre+sous-titre+2 boutons+bandeau d'offre+citation. Pour du trafic pub froid,
            chaque bloc avant la démonstration de valeur est une occasion de repartir. Le calculateur
            devient donc la toute première chose vue après le titre : aucune promesse à croire sur
            parole avant de voir un résultat, aucun choix à faire, un seul geste possible (essayer). */}
        <div className="text-center max-w-xl mx-auto mt-6 mb-8">
          <h2 className="font-display text-white text-2xl sm:text-3xl tracking-wide leading-snug mb-3">
            {t("landingHeroTitle")}
          </h2>
          <p className="text-white/60 text-sm sm:text-base leading-relaxed">{t("landingHeroSubtitle")}</p>
        </div>

        {/* Remplace la reconstitution statique d'une fiche recette (2026-08-19 → 2026-08-27) :
            elle décrivait le produit sans jamais le faire essayer. Voir MarginCalculator. */}
        <MarginCalculator
          t={t}
          lang={lang}
          onEngage={() => {
            logLandingEvent("calc_used");
            // Signal d'intérêt intermédiaire, envoyé au pixel : avec zéro inscription, une régie
            // n'a rien à apprendre d'un événement "compte créé". Un événement atteignable en
            // volume comme celui-ci lui donne au moins de quoi optimiser.
            trackAdEvent("ViewContent", { content_name: "margin_calculator" });
          }}
          onStart={handleStart}
        />
        <p className="text-emerald-400/90 text-xs font-semibold text-center -mt-8 mb-12">{t("landingPricingTrial")}</p>

        {/* [RESTRUCTURATION 2026-08-27] Bandeau d'offre déplacé APRÈS le calculateur (avant : juste
            sous le titre, donc lu avant toute preuve de valeur). Un engagement mensuel affiché en
            premier, à un visiteur froid qui n'a encore rien vu, augmente le réflexe de fuite — voir
            CLAUDE.md pour le raisonnement complet. Ici, il arrive comme la récompense/la bonne
            surprise juste après que le visiteur a déjà vu SA marge, pas comme la première chose
            qu'on lui demande de croire. Contenu et logique inchangés, seul l'emplacement change. */}
        {launchOfferOpen && (
          <div
            className="max-w-md mx-auto mb-12 rounded-2xl border-2 px-5 py-4 text-center"
            style={{ borderColor: BRAND_SOLID, background: `${BRAND_SOLID}14` }}
          >
            <div className="font-display uppercase text-[11px] tracking-widest mb-2" style={{ color: BRAND_SOLID }}>
              {t("launchBadge")}
            </div>
            <div className="flex items-end justify-center gap-2 flex-wrap">
              <span className="text-white/35 text-xl line-through">{money(PRICING.standard)}</span>
              <span className="text-white font-display text-5xl leading-none">{money(PRICING.founding)}</span>
              <span className="text-white/60 text-sm mb-1">{t("landingPricingPerMonth")}</span>
            </div>
            <div className="font-display uppercase text-sm tracking-wide mt-2" style={{ color: BRAND_SOLID }}>
              {t("launchForLife")}
            </div>
            {typeof spots === "number" && (
              <div className="text-white text-sm font-bold mt-3">{t("launchSpotsLeft")(spots)}</div>
            )}
            <p className="text-white/50 text-[11px] mt-2 leading-relaxed">{t("launchCondition")}</p>
            <button
              type="button"
              onClick={handleStart}
              className="w-full sm:w-auto px-8 py-2.5 mt-4 rounded-full font-display uppercase text-xs tracking-wide font-semibold"
              style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
            >
              {t("landingCtaStart")}
            </button>
          </div>
        )}

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

        {/* [AJOUT 2026-08-28] Carte digitale mise en avant comme un second point d'entrée, pas
            juste une ligne parmi 5 dans la grille de fonctionnalités plus bas — demandé par
            l'utilisateur. Placée après "Comment ça marche" plutôt qu'en haut de page : le
            calculateur reste LE premier geste demandé au visiteur (voir la refonte du 2026-08-27,
            un seul CTA avant toute preuve de valeur) ; ceci n'est qu'une porte de sortie alternative
            pour qui n'a pas encore de facture/coût sous la main mais veut un résultat concret tout
            de suite. Même bouton `handleStart` que le reste de la page — ce n'est pas un second
            produit, juste un autre point d'entrée dans le même parcours d'inscription. */}
        <div
          className="max-w-2xl mx-auto mb-12 rounded-2xl border border-white/10 px-5 py-5 sm:py-6 flex flex-col sm:flex-row items-center gap-4"
          style={{ background: "#201B15" }}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${BRAND_SOLID}22`, color: BRAND_SOLID }}>
            <QrCode size={22} />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-white font-display uppercase text-xs tracking-wide mb-1">{t("landingMenuCalloutTitle")}</h3>
            <p className="text-white/50 text-xs leading-relaxed">{t("landingMenuCalloutDesc")}</p>
          </div>
          <button
            type="button"
            onClick={handleStart}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full font-display uppercase text-[11px] tracking-wide font-semibold shrink-0"
            style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
          >
            {t("landingMenuCalloutCta")}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {FEATURES.map(({ icon: Icon, titleKey, descKey }) => (
            <div key={titleKey} className="rounded-2xl p-5 border border-white/10" style={{ background: "#201B15" }}>
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

        {/* Citation du fondateur (2026-08-27) : redescendue ici depuis le haut de la page — un
            trust-signal a plus de poids juste avant le moment où on demande vraiment un
            engagement (la carte de prix) que tout en haut, avant que le visiteur sache même de
            quoi il s'agit. */}
        <p className="text-white/40 text-xs italic text-center mb-6 max-w-md mx-auto">{t("billingFounderStory")}</p>

        <div
          className="max-w-sm mx-auto rounded-2xl p-6 border-2 text-center"
          style={{ background: "#201B15", borderColor: BRAND_SOLID }}
        >
          <h3 className="font-display uppercase text-white text-sm tracking-wide mb-3">{t("landingPricingTitle")}</h3>
          {launchOfferOpen && (
            <div
              className="inline-block rounded-full px-3 py-1 mb-2 font-display uppercase text-[10px] tracking-wide"
              style={{ background: `${BRAND_SOLID}22`, color: BRAND_SOLID }}
            >
              {t("launchBadge")}
              {typeof spots === "number" ? ` · ${t("launchSpotsLeft")(spots)}` : ""}
            </div>
          )}
          <div className="flex items-end justify-center gap-1.5 mb-1">
            {/* Le tarif normal reste affiché à côté du tarif fondateur : c'est le prix réellement
                facturé à tout compte hors des 50 places, pas un prix barré fictif. */}
            {launchOfferOpen && (
              <span className="text-white/35 text-lg line-through mb-1">{money(PRICING.standard)}</span>
            )}
            <span className="text-white font-display text-4xl">
              {money(launchOfferOpen ? PRICING.founding : PRICING.standard)}
            </span>
            <span className="text-white/50 text-sm mb-1">{t("landingPricingPerMonth")}</span>
          </div>
          {launchOfferOpen && (
            <p className="text-xs font-semibold mb-1" style={{ color: BRAND_SOLID }}>
              {t("launchLifetimeLock")}
            </p>
          )}
          <p className="text-emerald-400/90 text-xs font-semibold mb-1">{t("landingPricingTrial")}</p>
          {launchOfferOpen && <p className="text-white/40 text-[11px] mb-4">{t("launchCondition")}</p>}
          {!launchOfferOpen && <div className="mb-4" />}

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
