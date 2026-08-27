// Pixel publicitaire TikTok (2026-08-27) — mesure des conversions d'une campagne payante.
//
// ⚠️ Trois garde-fous délibérés, à ne pas retirer sans y avoir repensé :
//
// 1. INERTE PAR DÉFAUT. Sans `VITE_TIKTOK_PIXEL_ID` configuré sur Vercel, rien n'est chargé, rien
//    n'est demandé au visiteur, aucune bannière n'apparaît. Le site retrouve exactement le
//    comportement qu'il avait avant. Même principe que le prix fondateur côté Stripe.
//
// 2. CONSENTEMENT PRÉALABLE. Contrairement au comptage maison de la landing (anonyme : ni IP, ni
//    email, ni user-agent, juste un type d'événement et une date), un pixel publicitaire est un
//    traceur tiers qui dépose des identifiants et transmet des données à TikTok. En Europe, il
//    exige un consentement explicite AVANT tout chargement. Le script n'est donc injecté qu'après
//    une acceptation, jamais avant.
//
// 3. DEMANDÉ UNIQUEMENT AU TRAFIC PUBLICITAIRE. La bannière n'est montrée qu'aux visiteurs
//    arrivés avec un paramètre de campagne (`?src=`), les seuls pour qui ce pixel sert à quelque
//    chose. Un visiteur organique ne voit aucune bannière et n'est jamais tracé — on ne dégrade
//    donc pas la conversion de tout le monde pour mesurer une minorité.

const CONSENT_KEY = "chefup:adConsent"; // "granted" | "denied"

export const pixelId = import.meta.env.VITE_TIKTOK_PIXEL_ID || null;

function readConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch (e) {
    // Stockage bloqué (navigation privée stricte) : on considère qu'aucun consentement n'a été
    // donné. Ne jamais tracer dans le doute.
    return null;
  }
}

export function consentDecision() {
  return readConsent();
}

// Vrai seulement si le pixel est configuré, que le visiteur vient d'une campagne, et qu'il n'a
// encore ni accepté ni refusé.
export function shouldAskConsent(campaignSource) {
  return !!pixelId && !!campaignSource && readConsent() === null;
}

let loaded = false;

// Extrait officiel du pixel TikTok, réécrit lisiblement. Chargé à la demande uniquement.
function injectPixel() {
  if (loaded || !pixelId || typeof window === "undefined") return;
  loaded = true;
  /* eslint-disable */
  (function (w, d, t) {
    w.TiktokAnalyticsObject = t;
    const ttq = (w[t] = w[t] || []);
    ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
    ttq.setAndDefer = function (obj, method) {
      obj[method] = function () {
        obj.push([method].concat(Array.prototype.slice.call(arguments, 0)));
      };
    };
    for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.instance = function (id) {
      const inst = ttq._i[id] || [];
      for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(inst, ttq.methods[i]);
      return inst;
    };
    ttq.load = function (id, opts) {
      const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {};
      ttq._i[id] = [];
      ttq._i[id]._u = url;
      ttq._t = ttq._t || {};
      ttq._t[id] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[id] = opts || {};
      const script = d.createElement("script");
      script.type = "text/javascript";
      script.async = true;
      script.src = url + "?sdkid=" + id + "&lib=" + t;
      const first = d.getElementsByTagName("script")[0];
      first.parentNode.insertBefore(script, first);
    };
    ttq.load(pixelId);
    ttq.page();
  })(window, document, "ttq");
  /* eslint-enable */
}

export function grantConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, "granted");
  } catch (e) {}
  injectPixel();
}

export function denyConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, "denied");
  } catch (e) {}
}

// À appeler au chargement : ne réinjecte le pixel que si le visiteur avait DÉJÀ accepté lors
// d'une visite précédente. Ne demande jamais rien de lui-même.
export function initPixelIfConsented() {
  if (readConsent() === "granted") injectPixel();
}

// Événement de conversion. Silencieux si le pixel n'est pas chargé (pas de consentement, pas de
// pixel configuré, script bloqué par un bloqueur de publicité) — jamais d'erreur remontée au
// visiteur pour une histoire de mesure publicitaire.
export function trackAdEvent(event, params) {
  try {
    if (!loaded || !window.ttq) return;
    window.ttq.track(event, params || {});
  } catch (e) {}
}
