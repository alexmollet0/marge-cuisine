import React, { useEffect, useState } from "react";
import { Percent, Eye, Camera, Check, TrendingUp } from "lucide-react";
import { Logo, BRAND_SOLID, BRAND_GRADIENT, BRAND_SHADOW, TR, PRICING, TIER_COLORS } from "./App.jsx";
import { PROMO_CODE, PROMO_PERCENT, PROMO_END } from "./brand.js";
import { usePromoCountdown } from "./pricing.js";
import { shouldAskConsent, grantConsent, denyConsent, initPixelIfConsented, trackAdEvent } from "./adPixel.js";
import Diagnostic from "./Diagnostic.jsx";

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
  { icon: Eye, titleKey: "landingStep3Title", descKey: "landingStep3Desc" },
];

// [CHANGEMENT MAJEUR, 2026-09-16] Remplace MarginCalculator (calculateur manuel jouable sans
// compte, livré le 2026-08-27) — mesuré sur une semaine de vraie campagne payante : 203 visiteurs
// engagés (3s+), 0 (ZÉRO) utilisation du calculateur alors qu'il était la toute première chose vue
// après le titre. Retour direct de l'utilisateur, qui n'a jamais aimé ce bloc : "il faudrait une
// vidéo super intuitive" à la place — quelque chose qui montre la valeur SANS demander au visiteur
// de taper quoi que ce soit. Reprend la même trame que la démo "wow" du tuto d'inscription
// (src/adminAndOnboarding.jsx, TutorialWowScan) — scan → résultat détaillé → un prix qui augmente →
// impact direct sur une recette — mais en boucle AUTOMATIQUE (aucun tap requis, un visiteur froid
// ne clique presque jamais) et avec un CTA "Commencer gratuitement" TOUJOURS visible en dessous
// (jamais caché derrière la fin d'un cycle) pour ne perdre aucune conversion possible pendant que
// l'animation tourne. Dupliqué ici plutôt qu'importé depuis adminAndOnboarding.jsx : ce fichier est
// chargé AVANT toute authentification, il ne doit dépendre d'aucun module réservé à l'app connectée.
const LANDING_WOW_ITEMS = [
  { name: "Bœuf haché", price: "11,90€/kg" },
  { name: "Oignons", price: "1,80€/kg" },
  { name: "Crème fraîche", price: "3,20€/L" },
  { name: "Carottes", price: "1,50€/kg" },
  { name: "Tomates", price: "2,40€/kg" },
];
const LANDING_WOW_LINE_TOPS = [36, 56, 76, 96, 116, 136, 156];

function LandingWowInvoice({ scanning }) {
  return (
    <div className="relative w-32 h-44 rounded-xl overflow-hidden shrink-0 mx-auto shadow-xl" style={{ background: "rgba(255,255,255,0.96)" }}>
      <style>{`@keyframes chefupLandingScan { 0% { top: 10%; opacity: .95; } 90% { top: 85%; opacity: .95; } 100% { top: 85%; opacity: 0; } }`}</style>
      <div className="absolute inset-x-4 top-4 h-2 rounded-full bg-black/25 w-2/3" />
      <div className="absolute inset-x-4 top-7 h-1.5 rounded-full bg-black/10 w-1/2" />
      {LANDING_WOW_LINE_TOPS.map((top, i) => (
        <div key={top} className="absolute inset-x-4 h-1 rounded-full bg-black/10" style={{ top: top * 0.8, width: i % 2 === 0 ? "72%" : "50%" }} />
      ))}
      <div className="absolute inset-x-4 bottom-5 h-1.5 rounded-full bg-black/20 w-1/2" />
      {scanning && (
        <div
          className="absolute inset-x-0 h-1"
          style={{ background: BRAND_SOLID, boxShadow: `0 0 10px ${BRAND_SOLID}`, animation: "chefupLandingScan 1.5s ease-in-out infinite" }}
        />
      )}
    </div>
  );
}

function LandingWowDemo({ t, onEngage, onStart, showCta = true }) {
  // idle -> scanning -> result -> priceUp -> recipeImpact -> (pause) -> idle (boucle infinie,
  // aucune interaction requise — un visiteur froid ne clique presque jamais, voir commentaire ci-
  // dessus). Signale UNE fois qu'un visiteur a vu la démo tourner au moins un cycle complet (même
  // logique de signal d'intérêt que l'ancien calculateur, `onEngage`).
  const [phase, setPhase] = useState("idle");
  const [reveal, setReveal] = useState(0);
  const [marginValue, setMarginValue] = useState(78);
  const [priceFlipped, setPriceFlipped] = useState(false);
  const engaged = React.useRef(false);

  useEffect(() => {
    let timers = [];
    if (phase === "idle") timers.push(setTimeout(() => { setReveal(0); setPhase("scanning"); }, 1200));
    else if (phase === "scanning") {
      if (reveal >= LANDING_WOW_ITEMS.length) timers.push(setTimeout(() => setPhase("result"), 500));
      else timers.push(setTimeout(() => setReveal((r) => r + 1), 550));
    } else if (phase === "result") timers.push(setTimeout(() => setPhase("priceUp"), 2800));
    else if (phase === "priceUp") {
      timers.push(setTimeout(() => setPriceFlipped(true), 900));
      timers.push(setTimeout(() => setPhase("recipeImpact"), 3600));
    } else if (phase === "recipeImpact") {
      timers.push(setTimeout(() => setMarginValue(71), 300));
      timers.push(
        setTimeout(() => {
          if (!engaged.current) { engaged.current = true; onEngage(); }
          setMarginValue(78);
          setPriceFlipped(false);
          setPhase("idle");
        }, 3400)
      );
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reveal]);

  return (
    <div className="max-w-sm mx-auto rounded-2xl p-5 border border-white/10 mb-8" style={{ background: "#201B15" }}>
      <div className="flex flex-col items-center justify-center text-center gap-3 min-h-[280px]">
        {(phase === "idle" || phase === "scanning") && (
          <>
            <LandingWowInvoice scanning={phase === "scanning"} />
            {phase === "idle" ? (
              <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: BRAND_SOLID }}>
                {t("landingWowScanning")}
              </span>
            ) : (
              <div className="flex flex-col gap-1.5 w-full max-w-[220px]">
                {LANDING_WOW_ITEMS.map((it, i) => (
                  <div
                    key={it.name}
                    className="flex items-center gap-2 text-xs transition-all duration-500"
                    style={{ opacity: reveal > i ? 1 : 0, transform: reveal > i ? "translateY(0)" : "translateY(4px)" }}
                  >
                    <Check size={12} style={{ color: "#10B981" }} className="shrink-0" />
                    <span className="text-white/80 flex-1 text-left">{it.name}</span>
                    <span className="text-white/40 font-mono">{it.price}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {(phase === "result" || phase === "priceUp") && (
          <>
            <h3 className="font-display uppercase text-white text-sm tracking-wide max-w-xs">
              {phase === "result" ? t("landingWowResultBanner") : t("landingWowLater")}
            </h3>
            {phase === "result" && <p className="text-white/45 text-[11px]">{t("landingWowSupplier")}</p>}
            <div className="w-full rounded-xl border border-white/10 overflow-hidden" style={{ background: "#16130F" }}>
              {LANDING_WOW_ITEMS.map((it, i) => {
                const isBoeuf = i === 0;
                const highlighting = phase === "priceUp" && isBoeuf;
                const flagged = highlighting && priceFlipped;
                return (
                  <div
                    key={it.name}
                    className="flex items-center gap-2 px-3 py-2 text-xs transition-all duration-300"
                    style={{
                      borderBottom: i < LANDING_WOW_ITEMS.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                      background: highlighting ? "rgba(239,68,68,0.08)" : "transparent",
                      boxShadow: highlighting && !flagged ? "inset 0 0 0 1.5px rgba(239,68,68,0.5)" : "none",
                    }}
                  >
                    <Check size={11} style={{ color: "#10B981" }} className="shrink-0" />
                    <span className="text-white/85 flex-1 text-left">{it.name}</span>
                    <span className="font-mono font-semibold transition-colors duration-500" style={{ color: flagged ? "#EF4444" : "rgba(255,255,255,0.6)" }}>
                      {flagged ? "13,50€/kg" : it.price}
                    </span>
                    {flagged && <TrendingUp size={13} style={{ color: "#EF4444" }} className="shrink-0" />}
                  </div>
                );
              })}
            </div>
            {phase === "result" && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "#10B981" }}>
                <Check size={12} /> {t("landingWowResultConfirm")}
              </div>
            )}
            {phase === "priceUp" && priceFlipped && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "#EF4444" }}>
                <TrendingUp size={12} /> +13%
              </div>
            )}
          </>
        )}

        {phase === "recipeImpact" && (
          <>
            <h3 className="font-display uppercase text-white text-sm tracking-wide max-w-xs">{t("landingWowRecipeIntro")}</h3>
            <div className="w-full rounded-xl border border-white/10 p-3.5 flex items-center gap-3" style={{ background: "#16130F" }}>
              <div className="relative w-14 h-14 shrink-0">
                <svg width="56" height="56" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="23" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                  <circle
                    cx="28" cy="28" r="23" fill="none"
                    stroke={marginValue >= 75 ? TIER_COLORS.high : TIER_COLORS.mid}
                    strokeWidth="5" strokeLinecap="round"
                    strokeDasharray="144.5"
                    strokeDashoffset={144.5 * (1 - marginValue / 100)}
                    transform="rotate(-90 28 28)"
                    style={{ transition: "stroke-dashoffset 0.9s ease, stroke 0.9s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-xs font-display font-black">{marginValue}%</span>
                </div>
              </div>
              <div className="text-left">
                <div className="text-white text-sm font-semibold">Bœuf bourguignon</div>
                <div className="text-white/40 text-[11px] mt-0.5">{t("marginLabel")}</div>
              </div>
            </div>
            <p className="text-white/55 text-[11px] leading-relaxed max-w-xs">{t("landingWowRecipeOutro")}</p>
          </>
        )}
      </div>

      {/* CTA TOUJOURS visible, jamais gagné en attendant la fin d'un cycle — l'ancien calculateur
          n'avait qu'un seul chemin de conversion (après avoir tapé des chiffres) ; ici le visiteur
          peut s'inscrire à tout moment pendant que la démo tourne, sans attendre. */}
      {showCta && (
        <button
          type="button"
          onClick={onStart}
          className="w-full mt-4 py-3 rounded-full font-display uppercase text-[11px] tracking-wide font-semibold"
          style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
        >
          {t("landingCtaStart")}
        </button>
      )}
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
  // Offre flash (2026-09-04, voir PROMO_CODE/PROMO_END dans brand.js) — prend le relais visuel
  // de l'offre de lancement une fois celle-ci fermée (`!launchOfferOpen`, vrai dès que les 7
  // places fondateur sont prises) : jamais les deux en même temps, un seul message d'urgence à
  // la fois. Se cache elle-même après PROMO_END (`promo.expired`), rien à retirer à la main.
  const promo = usePromoCountdown(PROMO_END);
  const promoActive = !launchOfferOpen && !promo.expired;
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
    // Adresse courte TikTok (`getchefup.com/test`, rewrite dans vercel.json) : même page, mais
    // on amène directement le visiteur sur le diagnostic au lieu de le laisser scroller.
    if (window.location.pathname === "/test") {
      setTimeout(() => document.getElementById("diagnostic")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    }
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

  // Le test « Ce qui t'échappe chaque mois » (Diagnostic) n'est plus sur la page d'accueil : il garde son adresse
  // getchefup.com/test (rewrite dans vercel.json) — voir la simplification du 2026-11-19.
  const isTestPage = typeof window !== "undefined" && window.location.pathname === "/test";

  return (
    <div className="min-h-screen font-body" style={{ background: "#16130F" }}>
      {/* Bandeau de consentement publicitaire — volontairement en BAS et non bloquant : il ne
          masque ni le titre, ni le bouton principal, ni la démo. Un visiteur qui l'ignore
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
            <div className="font-display text-white text-xl tracking-wide uppercase">Chefup</div>
          </div>
          {/* "J'ai déjà un compte" : simple lien discret, pour qui revient sur le lien une 2e fois ;
              il ne dispute pas l'attention du bouton principal (voir la refonte du 2026-08-27). */}
          <button type="button" onClick={handleLogin} className="text-[11px] text-white/40 hover:text-white/70 shrink-0">
            {t("landingCtaLogin")}
          </button>
        </div>
        {LangSwitcher}

        {/* [SIMPLIFICATION 2026-11-19 — « gros travaux » demandés par Alex après le message d'un
            spectateur : « proposition de valeur difficile à comprendre, trop d'informations d'un coup,
            on a du mal à accrocher »] La page passe de 10 blocs et 6 boutons à 5 blocs et 2 boutons :
            1) une promesse en une phrase + comment (le titre dit CE QUE FAIT Chefup, pas seulement un
            problème), 2) UN bouton d'essai et la condition d'essai juste dessous, 3) la démo animée
            (une seule), 4) les 3 étapes, 5) le prix. Retirés de l'accueil : le test « Ce qui t'échappe »
            (reste sur /test), l'offre de lancement et l'offre flash en bandeaux (elles restent dans la
            carte de prix), le bloc « carte digitale », la grille de 5 fonctionnalités (les points forts
            sont dans la carte de prix) et la citation du fondateur. Le bloc « carte digitale » et la
            grille affirmaient aussi « le prix se met à jour tout seul » : faux pour les recettes depuis
            le 2026-08-30 (voir CLAUDE.md), il n'y a donc plus rien à corriger côté marketing. */}
        <div className="text-center max-w-xl mx-auto mt-6 mb-6">
          <h1 className="font-display text-white text-2xl sm:text-3xl tracking-wide leading-snug mb-3">
            {t("landingHeroTitle")}{" "}
            <span style={{ color: BRAND_SOLID }}>{t("landingHeroPlus")}</span>
          </h1>
          <p className="text-white/60 text-sm sm:text-base leading-relaxed">{t("landingHeroSubtitle")}</p>
        </div>

        <div className="max-w-sm mx-auto text-center mb-8">
          <button
            type="button"
            onClick={handleStart}
            className="w-full sm:w-auto px-10 py-3 rounded-full font-display uppercase text-xs tracking-wide font-semibold"
            style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
          >
            {t("landingCtaStart")}
          </button>
          <p className="text-emerald-400/90 text-xs font-semibold mt-3">{t("landingPricingTrial")}</p>
        </div>

        {/* Diagnostic « Ce qui t'échappe chaque mois » : seulement sur getchefup.com/test (2026-11-19). */}
        {isTestPage && (
          <div id="diagnostic">
            <Diagnostic
              t={t}
              lang={lang}
              onEvent={(name) => logLandingEvent(name)}
              onStart={handleStart}
            />
          </div>
        )}

        <LandingWowDemo
          t={t}
          showCta={false}
          onEngage={() => {
            logLandingEvent("calc_used");
            // Signal d'intérêt intermédiaire, envoyé au pixel : la démo a tourné au moins un cycle
            // complet sous les yeux du visiteur (voir l'historique dans docs/HISTORIQUE-FONCTIONNALITES.md).
            trackAdEvent("ViewContent", { content_name: "margin_calculator" });
          }}
          onStart={handleStart}
        />

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

        <div
          className="max-w-sm mx-auto rounded-2xl p-6 border-2 text-center"
          style={{ background: "#201B15", borderColor: BRAND_SOLID }}
        >
          <h2 className="font-display uppercase text-white text-sm tracking-wide mb-3">{t("landingPricingTitle")}</h2>
          {launchOfferOpen && (
            <div
              className="inline-block rounded-full px-3 py-1 mb-2 font-display uppercase text-[10px] tracking-wide"
              style={{ background: `${BRAND_SOLID}22`, color: BRAND_SOLID }}
            >
              {t("launchBadge")}
              {typeof spots === "number" ? ` · ${t("launchSpotsLeft")(spots)}` : ""}
            </div>
          )}
          {promoActive && (
            <div
              className="inline-block rounded-full px-3 py-1 mb-2 font-display uppercase text-[10px] tracking-wide"
              style={{ background: `${BRAND_SOLID}22`, color: BRAND_SOLID }}
            >
              {t("promoBadge")} · {t("promoLine")(PROMO_PERCENT, PROMO_CODE)}
            </div>
          )}
          <div className="flex items-end justify-center gap-1.5 mb-1">
            {/* Le tarif normal reste affiché à côté du tarif fondateur : c'est le prix réellement
                facturé à tout compte hors des places fondateur, pas un prix barré fictif. */}
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
          {promoActive && (
            <p className="text-white/40 text-[11px] mb-4">
              {t("promoCondition")} {t("promoCountdownLabel")(promo.days, promo.hours, promo.minutes)}
            </p>
          )}
          {!launchOfferOpen && !promoActive && <div className="mb-4" />}

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
