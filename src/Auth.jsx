import React, { useState, useEffect } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "./supabaseClient.js";
import { Logo, BRAND_SOLID, BRAND_GRADIENT, BRAND_SHADOW, TR } from "./App.jsx";
import Landing from "./Landing.jsx";

// text-base (16px) plutôt que text-sm : en dessous de 16px, iOS/Android zooment
// automatiquement l'écran au focus d'un champ, et ne rezooment pas toujours
// proprement après — gênant comme toute première impression de l'app.
const inputClass =
  "w-full rounded-lg px-3 py-2 text-base text-white bg-white/5 border border-white/10 outline-none focus:border-[#8B5CF6]";

const AUTH_LANG_KEY = "chefup:authLang";

function guessAuthLang() {
  try {
    const saved = localStorage.getItem(AUTH_LANG_KEY);
    if (saved && TR[saved]) return saved;
  } catch (e) {}
  const nav = (typeof navigator !== "undefined" && navigator.language) || "fr";
  if (nav.startsWith("es")) return "es";
  if (nav.startsWith("en")) return "en";
  return "fr";
}

// Messages Supabase bruts (toujours en anglais côté API) mappés vers une clé TR
// (résolue seulement à l'affichage) plutôt qu'un texte déjà traduit — sinon un
// message déjà affiché reste figé dans l'ancienne langue si on change de langue.
function authErrorKey(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "authErrorInvalidCredentials";
  if (m.includes("already registered")) return "authErrorAlreadyRegistered";
  if (m.includes("email not confirmed")) return "authErrorEmailNotConfirmed";
  if (m.includes("password should be at least")) return "authErrorPasswordTooShort";
  if (m.includes("valid email")) return "authErrorInvalidEmail";
  return "authErrorGeneric";
}

function PasswordField({ label, value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <>
      {label && <label className="block text-xs text-white/50 mb-1">{label}</label>}
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          required
          minLength={6}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          className={`${inputClass} pr-9`}
          placeholder={placeholder}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </>
  );
}

// Porte d'authentification : affiche le formulaire connexion/inscription/mot de
// passe oublié tant qu'aucune session Supabase n'existe, sinon affiche l'app
// (children). Connexion obligatoire (décision produit du 2026-08-02) : aucun
// mode démo sans compte. Langue de cet écran choisie indépendamment de la
// langue du compte (inconnue tant qu'on n'est pas connecté), mémorisée en
// localStorage le temps de la session pré-connexion.
export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = chargement initial
  const [recoveryMode, setRecoveryMode] = useState(false); // arrivée depuis le lien "mot de passe oublié"
  const [showLanding, setShowLanding] = useState(true); // page d'accueil publique, avant le formulaire
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  const [authLang, setAuthLang] = useState(guessAuthLang);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const t = (key) => TR[authLang]?.[key] ?? TR.fr[key] ?? key;

  function changeAuthLang(l) {
    setAuthLang(l);
    try {
      localStorage.setItem(AUTH_LANG_KEY, l);
    } catch (e) {}
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function switchMode(next) {
    setMode(next);
    setErr("");
    setInfo("");
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setInfo("authSignupSuccessInfo");
          setMode("login");
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setInfo("authForgotSuccessInfo");
      }
    } catch (e2) {
      setErr(authErrorKey(e2.message));
    } finally {
      setBusy(false);
    }
  }

  async function sendMagicLink() {
    setErr("");
    setInfo("");
    if (!email) {
      setErr("authErrorInvalidEmail");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setInfo("authMagicLinkInfo");
    } catch (e2) {
      setErr(authErrorKey(e2.message));
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (newPassword.length < 6) { setErr("authErrorPasswordTooShort"); return; }
      if (newPassword !== newPassword2) { setErr("authErrorPasswordMismatch"); return; }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setRecoveryMode(false);
    } catch (e2) {
      setErr(authErrorKey(e2.message));
    } finally {
      setBusy(false);
    }
  }

  const LangSwitcher = (
    <div className="flex items-center justify-center gap-1 mb-4">
      <button type="button" onClick={() => changeAuthLang("fr")} className={`text-lg leading-none ${authLang === "fr" ? "" : "opacity-40 grayscale"}`} title="Français">🇫🇷</button>
      <button type="button" onClick={() => changeAuthLang("es")} className={`text-lg leading-none ${authLang === "es" ? "" : "opacity-40 grayscale"}`} title="Español">🇪🇸</button>
      <button type="button" onClick={() => changeAuthLang("en")} className={`text-lg leading-none ${authLang === "en" ? "" : "opacity-40 grayscale"}`} title="English">🇬🇧</button>
    </div>
  );

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#1B1815" }}>
        <Loader2 className="animate-spin" style={{ color: BRAND_SOLID }} size={28} />
      </div>
    );
  }

  if (recoveryMode) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 font-body" style={{ background: "#1B1815" }}>
        <form
          onSubmit={submitReset}
          className="w-full max-w-sm rounded-2xl p-6 border border-white/10"
          style={{ background: "#26221C" }}
        >
          <div className="flex items-center gap-2 justify-center mb-6">
            <Logo size={30} />
            <h1 className="font-display text-white text-lg tracking-wide uppercase">Chefup</h1>
          </div>
          {LangSwitcher}
          <h2 className="text-white text-center font-display uppercase text-sm tracking-wide mb-5">
            {t("authResetTitle")}
          </h2>

          {err && (
            <div className="mb-4 text-xs rounded-lg px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20">
              {t(err)}
            </div>
          )}

          <div className="mb-4">
            <PasswordField
              label={t("authNewPasswordLabel")}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("authPasswordPlaceholder")}
            />
          </div>

          <div className="mb-5">
            <PasswordField
              label={t("authConfirmPasswordLabel")}
              autoComplete="new-password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              placeholder={t("authConfirmPasswordPlaceholder")}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-full font-display uppercase text-xs tracking-wide font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {t("authResetButton")}
          </button>
        </form>
      </div>
    );
  }

  if (!session && showLanding) {
    return (
      <Landing
        lang={authLang}
        LangSwitcher={LangSwitcher}
        onStart={() => {
          setShowLanding(false);
          switchMode("signup");
        }}
        onLogin={() => {
          setShowLanding(false);
          switchMode("login");
        }}
      />
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 font-body" style={{ background: "#1B1815" }}>
        <form
          onSubmit={submit}
          className="w-full max-w-sm rounded-2xl p-6 border border-white/10"
          style={{ background: "#26221C" }}
        >
          <button
            type="button"
            onClick={() => setShowLanding(true)}
            className="text-xs text-white/40 hover:text-white mb-3"
          >
            ← Chefup
          </button>
          <div className="flex items-center gap-2 justify-center mb-2">
            <Logo size={30} />
            <h1 className="font-display text-white text-lg tracking-wide uppercase">Chefup</h1>
          </div>
          <p className="text-center text-xs text-white/40 mb-4">{t("authTagline")}</p>
          {LangSwitcher}
          <h2 className="text-white text-center font-display uppercase text-sm tracking-wide mb-1.5">
            {mode === "login" ? t("authLoginTitle") : mode === "signup" ? t("authSignupTitle") : t("authForgotTitle")}
          </h2>
          {mode === "signup" && (
            <p className="text-center text-xs text-emerald-400/80 mb-4">{t("authSignupFreeNote")}</p>
          )}
          {mode !== "signup" && <div className="mb-5" />}

          {err && (
            <div className="mb-4 text-xs rounded-lg px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20">
              {t(err)}
            </div>
          )}
          {info && (
            <div className="mb-4 text-xs rounded-lg px-3 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {t(info)}
            </div>
          )}

          <label className="block text-xs text-white/50 mb-1">{t("authEmailLabel")}</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} mb-4`}
            placeholder={t("authEmailPlaceholder")}
          />

          {mode !== "forgot" && (
            <div className="mb-5">
              <PasswordField
                label={t("authPasswordLabel")}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("authPasswordPlaceholder")}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-full font-display uppercase text-xs tracking-wide font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {mode === "login" ? t("authLoginButton") : mode === "signup" ? t("authSignupButton") : t("authForgotButton")}
          </button>

          {mode === "login" && (
            <>
              <div className="flex items-center gap-3 my-4">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] uppercase tracking-wide text-white/30">{t("authOrDivider")}</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={sendMagicLink}
                className="w-full py-2.5 rounded-full text-xs font-semibold border border-white/15 text-white/80 hover:bg-white/5 disabled:opacity-60"
              >
                {t("authMagicLinkButton")}
              </button>
            </>
          )}

          {mode === "login" && (
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="w-full mt-4 text-xs text-white/50 hover:text-white"
            >
              {t("authForgotLink")}
            </button>
          )}

          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            className="w-full mt-2 text-xs text-white/50 hover:text-white"
          >
            {mode === "signup" ? t("authSwitchToLogin") : mode === "forgot" ? t("authBackToLogin") : t("authSwitchToSignup")}
          </button>
        </form>
      </div>
    );
  }

  return children;
}
