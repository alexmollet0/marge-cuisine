import React, { useEffect, useState } from "react";
import { Percent, Eye, Camera, Check, TrendingUp, ArrowDown } from "lucide-react";
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

// [REFONTE 2026-11-21 — Alex : « il faut vraiment que quand ils arrivent ils voient directement la valeur et ce qu'on propose, qu'on
// comprenne instantanément une fois arrivé sur le site »] Historique : le 2026-09-16, la démo en 5 phases (scan → lignes lues → hausse de
// prix → impact sur une recette) avait remplacé le calculateur manuel (0 utilisation sur 203 visiteurs engagés en une semaine de campagne,
// voir docs/HISTORIQUE-FONCTIONNALITES.md). Mais elle mettait ~11 s à montrer l'effet sur la marge, et pendant la 1re seconde elle ne
// montrait qu'un papier blanc vide : or un visiteur froid (TikTok, téléphone) décide de rester ou non en 3 secondes.
// Remplacée par UNE carte « avant / après » lisible dès la 1re image : la facture (la ligne de bœuf), puis ce que la hausse change sur la marge
// d'un plat. Même exemple qu'avant (bœuf haché +13 %, bourguignon 78 % → 71 %), étiqueté « Exemple » : jamais présenté comme réel. L'« avant »
// s'affiche tout de suite, le basculement a lieu après ~0,9 s, puis boucle douce (aucune interaction requise : un visiteur froid ne clique presque
// jamais). Même signal d'intérêt qu'avant (`onEngage`, événement « calc_used ») une fois le 1er cycle terminé. Dupliquée ici plutôt qu'importée de
// adminAndOnboarding.jsx : ce fichier est chargé AVANT toute authentification, il ne doit dépendre d'aucun module réservé à l'app connectée.
const PROOF_LINES = [
  { name: "Bœuf haché", before: "11,90€/kg", after: "13,50€/kg", flag: true },
  { name: "Oignons", before: "1,80€/kg" },
  { name: "Crème fraîche", before: "3,20€/L" },
  { name: "Carottes", before: "1,50€/kg" },
];

function LandingProofCard({ t, onEngage }) {
  const [after, setAfter] = useState(false);
  const engaged = React.useRef(false);

  useEffect(() => {
    // Mouvement réduit demandé par l'appareil : on montre directement l'état « après », sans boucle.
    let reduced = false;
    try {
      reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      reduced = false;
    }
    if (reduced) {
      setAfter(true);
      return undefined;
    }
    let timer;
    function toAfter() {
      setAfter(true);
      timer = setTimeout(toBefore, 5200);
    }
    function toBefore() {
      if (!engaged.current) { engaged.current = true; onEngage(); }
      setAfter(false);
      timer = setTimeout(toAfter, 1400);
    }
    timer = setTimeout(toAfter, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const margin = after ? 71 : 78;
  const ringColor = margin >= 75 ? TIER_COLORS.high : TIER_COLORS.mid;

  return (
    <div
      className="w-full max-w-sm mx-auto rounded-2xl border border-white/10 overflow-hidden text-left"
      style={{ background: "#201B15", boxShadow: "0 18px 50px rgba(0,0,0,0.45)" }}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold" style={{ color: BRAND_SOLID }}>
          <Camera size={12} /> {t("landingProofInvoice")}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-white/35">{t("landingProofExample")}</span>
      </div>

      <div className="mx-3 rounded-xl border border-white/10 overflow-hidden" style={{ background: "#16130F" }}>
        {PROOF_LINES.map((l, i) => {
          const flagged = !!l.flag && after;
          return (
            <div
              key={l.name}
              className="flex items-center gap-2 px-3 py-2 text-xs transition-all duration-500"
              style={{
                borderBottom: i < PROOF_LINES.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                background: flagged ? "rgba(239,68,68,0.10)" : "transparent",
              }}
            >
              <Check size={11} style={{ color: "#10B981" }} className="shrink-0" />
              <span className="text-white/85 flex-1">{l.name}</span>
              <span className="font-mono font-semibold transition-colors duration-500" style={{ color: flagged ? "#EF4444" : "rgba(255,255,255,0.6)" }}>
                {flagged ? l.after : l.before}
              </span>
              <span
                className="inline-flex items-center justify-end gap-0.5 w-12 shrink-0 text-[11px] font-semibold transition-opacity duration-500"
                style={{ color: "#EF4444", opacity: flagged ? 1 : 0 }}
              >
                {l.flag && <><TrendingUp size={12} />+13%</>}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center py-1.5" style={{ color: BRAND_SOLID }}>
        <ArrowDown size={16} />
      </div>

      <div className="mx-3 mb-3 rounded-xl border border-white/10 p-3 flex items-center gap-3" style={{ background: "#16130F" }}>
        <div className="relative w-14 h-14 shrink-0">
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="23" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
            <circle
              cx="28" cy="28" r="23" fill="none"
              stroke={ringColor}
              strokeWidth="5" strokeLinecap="round"
              strokeDasharray="144.5"
              strokeDashoffset={144.5 * (1 - margin / 100)}
              transform="rotate(-90 28 28)"
              style={{ transition: "stroke-dashoffset 0.9s ease, stroke 0.9s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white text-xs font-display font-black">{margin}%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-semibold">Bœuf bourguignon</div>
          <div className="text-white/45 text-[11px] mt-0.5">{t("landingProofMargin")}</div>
        </div>
        <div className="text-right shrink-0 transition-opacity duration-500" style={{ opacity: after ? 1 : 0 }}>
          <div className="text-[11px] font-semibold" style={{ color: TIER_COLORS.mid }}>78% → 71%</div>
          <div className="text-[10px] text-white/40">−7 pts</div>
        </div>
      </div>

      <p className="px-4 pb-3 text-white/55 text-[11px] leading-snug text-center">{t("landingWowRecipeOutro")}</p>
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
        {/* [REFONTE 2026-11-21 — « qu'on comprenne instantanément »] Haut de page : QUI (puce), QUOI (titre + sous-titre), OFFRE (bouton +
            condition d'essai) et PREUVE (la carte « facture → marge », lisible dès la 1re image, voir LandingProofCard). Sur téléphone la carte
            est juste sous le bouton (dans le 1er écran) ; sur écran large elle passe à côté du texte pour tout voir sans défiler. */}
        <div className="grid sm:grid-cols-2 gap-8 sm:gap-10 items-center mt-6 mb-10">
          <div className="text-center sm:text-left">
            <span
              className="inline-block rounded-full px-3 py-1 mb-4 font-display uppercase text-[10px] tracking-widest"
              style={{ background: `${BRAND_SOLID}22`, color: BRAND_SOLID }}
            >
              {t("landingAudience")}
            </span>
            <h1 className="font-display text-white text-2xl sm:text-3xl tracking-wide leading-snug mb-3">
              {t("landingHeroTitle")}{" "}
              <span style={{ color: BRAND_SOLID }}>{t("landingHeroPlus")}</span>
            </h1>
            <p className="text-white/60 text-sm sm:text-base leading-relaxed mb-6">{t("landingHeroSubtitle")}</p>
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

          <LandingProofCard
            t={t}
            onEngage={() => {
              logLandingEvent("calc_used");
              // Signal d'intérêt intermédiaire, envoyé au pixel : la démo a tourné au moins un cycle
              // complet sous les yeux du visiteur (voir l'historique dans docs/HISTORIQUE-FONCTIONNALITES.md).
              trackAdEvent("ViewContent", { content_name: "margin_calculator" });
            }}
          />
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
