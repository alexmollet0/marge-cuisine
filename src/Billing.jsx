import React, { useState, useEffect, useCallback } from "react";
import { Loader2, Check } from "lucide-react";
import { supabase } from "./supabaseClient.js";
import { Logo, BRAND_SOLID, BRAND_GRADIENT, BRAND_SHADOW, TR } from "./App.jsx";

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
    const left = daysLeft(session.user.created_at);
    const { data: sub } = await supabase.from("subscriptions").select("status").maybeSingle();
    // "past_due" reste autorisé (grâce le temps que Stripe relance le paiement automatiquement)
    // — seuls canceled/unpaid/aucun abonnement bloquent une fois l'essai terminé.
    const active = !!sub && ["active", "trialing", "past_due"].includes(sub.status);
    setStatus({ active, inTrial: left > 0, trialDaysLeft: left });
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#1B1815" }}>
        <Loader2 className="animate-spin" style={{ color: BRAND_SOLID }} size={28} />
      </div>
    );
  }

  if (!status.active && !status.inTrial) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 font-body" style={{ background: "#1B1815" }}>
        <div className="w-full max-w-sm rounded-2xl p-6 border border-white/10 text-center" style={{ background: "#26221C" }}>
          <div className="flex items-center gap-2 justify-center mb-4">
            <Logo size={30} />
            <h1 className="font-display text-white text-lg tracking-wide uppercase">Chefup</h1>
          </div>
          <h2 className="text-white font-display uppercase text-sm tracking-wide mb-3">{t("billingPaywallTitle")}</h2>
          <p className="text-white/60 text-sm mb-4">{t("billingPaywallBody")}</p>
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
        <div className="print:hidden text-center text-[11px] py-1.5 px-3 text-white font-semibold" style={{ background: BRAND_GRADIENT }}>
          {t("billingTrialBanner")(status.trialDaysLeft)}
        </div>
      )}
      {children}
    </>
  );
}
