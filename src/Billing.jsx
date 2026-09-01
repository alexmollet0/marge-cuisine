import React, { useState, useEffect, useCallback } from "react";
import { Loader2, Check } from "lucide-react";
import { supabase } from "./supabaseClient.js";
import { Logo, BRAND_SOLID, BRAND_GRADIENT, BRAND_SHADOW, TR, PRICING } from "./App.jsx";
import { logActivity } from "./pricing.js";

const TRIAL_DAYS = 7;
const AUTH_LANG_KEY = "chefup:authLang";

function daysLeft(createdAt) {
  const trialEnd = new Date(createdAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return Math.ceil((trialEnd - Date.now()) / (24 * 60 * 60 * 1000));
}

// Portail d'accès (comme AuthGate) : affiché uniquement une fois connecté (voir main.jsx,
// imbriqué DANS AuthGate). Pas de carte demandée pour l'essai de 7 jours (décision produit
// 2026-08-03, cohérente avec l'acquisition TikTok/créateurs à faible friction) : le calcul de
// l'essai se base uniquement sur la date d'inscription Supabase, déjà connue, aucune donnée
// supplémentaire à stocker pour ça. Stripe n'intervient qu'une fois l'essai terminé.
export default function SubscriptionGate({ children }) {
  const [status, setStatus] = useState(undefined); // undefined = chargement initial
  const [lang, setLang] = useState("fr");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const t = (key) => TR[lang]?.[key] ?? TR.fr[key] ?? key;

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    // trialStartOverride (2026-08-25) : posé depuis le tableau de bord admin (bouton "Réinitialiser
    // l'essai") pour un compte dont l'essai a été gâché par un vrai bug de l'app, pas de sa faute.
    // On retient la plus récente des deux dates comme point de départ — jamais la plus ancienne,
    // pour ne jamais RACCOURCIR un essai par accident si ce champ contenait une date passée.
    let effectiveStart = session.user.created_at;
    try {
      const { data: override } = await supabase.from("kv_store").select("value").eq("key", "trialStartOverride").maybeSingle();
      if (override?.value && new Date(override.value) > new Date(effectiveStart)) effectiveStart = override.value;
    } catch (e) {}
    const left = daysLeft(effectiveStart);
    const { data: sub } = await supabase.from("subscriptions").select("status").maybeSingle();
    // "past_due" reste autorisé (grâce le temps que Stripe relance le paiement automatiquement)
    // — seuls canceled/unpaid/aucun abonnement bloquent une fois l'essai terminé.
    const active = !!sub && ["active", "trialing", "past_due"].includes(sub.status);

    // Offre de lancement (2026-08-26) : seul le serveur peut dire si ce compte détient encore une
    // des 50 places (ça dépend des autres comptes, jamais visible côté client). Best-effort — si
    // l'appel échoue, l'app se comporte exactement comme avant l'offre, sans jamais bloquer.
    // Le même appel indique aussi si le compte est interne (voir INTERNAL_EMAILS, api/_lib.js).
    let founder = false;
    let internal = false;
    let spotsRemaining = null;
    try {
      const res = await fetch("/api/create-checkout-session", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const info = await res.json();
        founder = !!info.founder;
        internal = !!info.internal;
        spotsRemaining = typeof info.spotsRemaining === "number" ? info.spotsRemaining : null;
      }
    } catch (e) {}

    // Comptes internes (2026-08-26) : accès permanent, jamais de paywall ni de bandeau d'essai.
    // Sans ça, le fondateur se retrouvait enfermé hors de sa propre application dès qu'un test de
    // paiement se terminait — et le tableau de bord admin, seul endroit d'où réinitialiser un
    // essai, se trouve JUSTEMENT derrière ce paywall. La seule issue était alors d'aller écrire à
    // la main dans Supabase.
    // ⚠️ La décision vient du SERVEUR (email comparé à INTERNAL_EMAILS côté API, jamais côté
    // client) et n'est volontairement PAS mise en cache dans le navigateur : un drapeau
    // "je suis interne" stocké localement serait modifiable par n'importe qui pour contourner
    // l'abonnement. En contrepartie, si cet appel échoue, le paywall réapparaît — c'est le repli
    // sûr, jamais l'inverse.
    setStatus({ active: active || internal, inTrial: left > 0, trialDaysLeft: left, founder, internal, spotsRemaining });
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_LANG_KEY);
      if (saved && TR[saved]) setLang(saved);
    } catch (e) {}
    load();
    // Retour de Stripe Checkout : le webhook peut prendre une seconde à écrire le statut,
    // on revérifie une fois après un court délai plutôt que d'afficher un paywall périmé.
    if (window.location.search.includes("checkout=")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
      setTimeout(load, 2500);
    }
  }, [load]);

  async function subscribe() {
    setErr("");
    setBusy(true);
    // [BUG confirmé et corrigé, 2026-09-01] Le suivi "Clic « S'abonner »" ajouté hier n'avait été
    // branché que sur `manageSubscription` (App.jsx, bouton secondaire de la fenêtre "Mon compte")
    // — pas sur CETTE fonction, qui est celle du vrai bouton "S'abonner maintenant" du bandeau
    // d'essai (le chemin que prennent presque tous les utilisateurs). Signalé par l'utilisateur
    // après un test réel : clic sur le bandeau, rien dans le tableau de bord. Corrigé en dupliquant
    // le même appel ici — les deux boutons envoient maintenant le même événement.
    logActivity("subscribe_clicked", {});
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "checkout error");
      window.location.href = data.url;
    } catch (e) {
      setErr(t("billingCheckoutError"));
      setBusy(false);
    }
  }

  if (status === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#16130F" }}>
        <Loader2 className="animate-spin" style={{ color: BRAND_SOLID }} size={28} />
      </div>
    );
  }

  if (!status.active && !status.inTrial) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 font-body" style={{ background: "#16130F" }}>
        <div className="w-full max-w-sm rounded-2xl p-6 border border-white/10 text-center" style={{ background: "#201B15" }}>
          <div className="flex items-center gap-2 justify-center mb-4">
            <Logo size={30} />
            <h1 className="font-display text-white text-lg tracking-wide uppercase">Chefup</h1>
          </div>
          {/* Un compte qui détient encore une place fondateur voit l'offre plutôt que le message
              de fin d'essai générique — c'est le dernier moment où elle peut encore être prise.
              Une fois la place perdue (essai expiré, places épuisées), on retombe sur le tarif
              normal sans jamais promettre un prix qui ne s'appliquerait plus. */}
          <h2 className="text-white font-display uppercase text-sm tracking-wide mb-3">
            {status.founder ? t("launchPaywallTitle")(PRICING.founding) : t("billingPaywallTitle")}
          </h2>
          <p className="text-white/60 text-sm mb-2">
            {t("billingPaywallBody")(status.founder ? PRICING.founding : PRICING.standard)}
          </p>
          {status.founder && (
            <p className="text-xs font-semibold mb-4" style={{ color: BRAND_SOLID }}>
              {t("launchLifetimeLock")}
            </p>
          )}
          {!status.founder && <div className="mb-2" />}
          <p className="text-white/40 text-xs italic mb-5">{t("billingFounderStory")}</p>
          <ul className="text-left text-white/80 text-sm space-y-2 mb-5">
            {[t("billingBenefit1"), t("billingBenefit2"), t("billingBenefit3")].map((benefit, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check size={15} className="shrink-0 mt-0.5" style={{ color: BRAND_SOLID }} />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <p className="text-white/50 text-xs mb-5">{t("billingPaywallReminder")}</p>
          {err && (
            <div className="mb-4 text-xs rounded-lg px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20">{err}</div>
          )}
          <button
            onClick={subscribe}
            disabled={busy}
            className="w-full py-2.5 rounded-full font-display uppercase text-xs tracking-wide font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {t("billingSubscribeButton")}
          </button>
          <p className="text-[10px] text-white/30 mt-3">{t("billingSecureNote")}</p>
          <button onClick={() => supabase.auth.signOut()} className="text-white/40 hover:text-white text-xs mt-5 underline">
            {t("logout")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {!status.active && status.inTrial && (
        <div
          className="print:hidden flex items-center justify-center gap-3 flex-wrap text-[11px] py-2 px-3 text-white font-semibold"
          style={{ background: BRAND_GRADIENT }}
        >
          {/* Pendant l'essai, un fondateur voit ce qu'il a à PERDRE (son tarif à vie) plutôt qu'un
              simple décompte de jours : c'est la même échéance, mais avec un enjeu. Nombre de
              places restantes ajouté au bandeau (2026-09-01, demandé par l'utilisateur) — la même
              pression que sur la landing, mais visible aussi une fois dans l'app. */}
          <span>
            {status.founder
              ? t("launchTrialBanner")(status.trialDaysLeft, PRICING.founding, status.spotsRemaining)
              : t("billingTrialBanner")(status.trialDaysLeft)}
          </span>
          {/* [AJOUT 2026-08-27] Bouton d'abonnement directement dans le bandeau. Jusqu'ici, le seul
              chemin pour s'abonner pendant l'essai passait par une petite icône de l'en-tête, puis
              une fenêtre "Mon compte", puis un bouton — trois clics et rien de visible. On annonce
              une offre limitée en haut de l'écran sans donner le moyen d'y souscrire à côté :
              c'était le trou le plus coûteux du produit. */}
          <button
            onClick={subscribe}
            disabled={busy}
            className="shrink-0 px-3 py-1 rounded-full text-[11px] font-bold disabled:opacity-60 flex items-center gap-1.5"
            style={{ background: "#fff", color: "#C9793B" }}
          >
            {busy && <Loader2 size={11} className="animate-spin" />}
            {t("billingSubscribeButton")}
          </button>
        </div>
      )}
      {children}
    </>
  );
}
