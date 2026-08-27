import React, { useState, useEffect } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "./supabaseClient.js";
import { Logo, BRAND_SOLID, BRAND_GRADIENT, BRAND_SHADOW, TR } from "./App.jsx";
import Landing from "./Landing.jsx";
import { trackAdEvent } from "./adPixel.js";

// text-base (16px) plutôt que text-sm : en dessous de 16px, iOS/Android zooment
// automatiquement l'écran au focus d'un champ, et ne rezooment pas toujours
// proprement après — gênant comme toute première impression de l'app.
const inputClass =
  "w-full rounded-lg px-3 py-2 text-base text-white bg-white/5 border border-white/10 outline-none focus:border-[#8B5CF6]";

const AUTH_LANG_KEY = "chefup:authLang";

// Flux d'activité admin (2026-08-23, voir api/scan-events.js + AdminDashboard dans App.jsx) :
// journalise chaque (re)connexion réelle, fire-and-forget (jamais bloquant, jamais d'erreur
// remontée à l'écran de connexion). Fires aussi bien sur une vraie saisie identifiants que sur
// une session restaurée au chargement de l'onglet — les deux comptent comme un signal de
// présence utile pour suivre l'activité d'un compte, voir le commentaire sur loginKey plus bas.
function logLoginActivity(sess) {
  if (!sess?.access_token) return;
  fetch("/api/scan-events", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${sess.access_token}` },
    body: JSON.stringify({ type: "login" }),
  }).catch(() => {});
}

// Mail d'accueil humain (2026-08-24) : déclenché une seule fois, à la toute première connexion
// d'un compte (détectée par "créé il y a moins de 10 minutes" — fonctionne que la confirmation
// par email soit requise ou non, contrairement à un déclenchement juste après `signUp()` qui
// n'a pas toujours de session active à ce moment-là). Le serveur (`api/send-reminders.js`,
// `handleScheduleWelcome`) reste la vraie garde-fou contre un double envoi (`notifState`) — ce
// heuristique côté client sert juste à ne pas spammer l'appel réseau inutilement à chaque
// connexion normale. Fuseau horaire envoyé pour choisir la bonne heure d'envoi (voir
// computeWelcomeSendAt côté serveur) — repli sur Europe/Paris si l'API Intl échoue.
function maybeScheduleWelcomeEmail(sess) {
  if (!sess?.access_token || !sess?.user?.created_at) return;
  const accountAgeMs = Date.now() - new Date(sess.user.created_at).getTime();
  if (accountAgeMs > 10 * 60 * 1000) return;
  let timeZone = "Europe/Paris";
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || timeZone; } catch (e) {}
  fetch("/api/send-reminders", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${sess.access_token}` },
    body: JSON.stringify({ timeZone }),
  }).catch(() => {});
}

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
// Accepte soit l'erreur complète (objet, avec `.code`/`.message`), soit directement une chaîne
// (compatibilité). Le `code` structuré de Supabase est vérifié en priorité — plus fiable qu'un
// texte qui peut changer d'une version à l'autre —, avec repli sur le texte du message pour les
// erreurs qui n'exposent pas de `code`.
function authErrorKey(err) {
  const code = (typeof err === "object" && err?.code) || "";
  const m = (typeof err === "string" ? err : err?.message || "").toLowerCase();
  if (code === "over_email_send_rate_limit" || m.includes("rate limit") || m.includes("security purposes") || m.includes("can only request this")) return "authErrorRateLimit";
  if (m.includes("invalid login credentials")) return "authErrorInvalidCredentials";
  if (m.includes("already registered")) return "authErrorAlreadyRegistered";
  if (m.includes("email not confirmed")) return "authErrorEmailNotConfirmed";
  if (m.includes("password should be at least")) return "authErrorPasswordTooShort";
  if (m.includes("valid email")) return "authErrorInvalidEmail";
  // [AJOUT 2026-08-27, flux OTP par code] Messages Supabase pour un code faux/expiré (`verifyOtp`),
  // trouvés en interceptant les appels réels pendant la vérification de cette fonctionnalité.
  if (m.includes("token has expired") || m.includes("otp") || m.includes("token is invalid")) return "authErrorOtpInvalid";
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
  // Incrémenté à chaque vraie (re)connexion (pas les rafraîchissements de token en arrière-plan) —
  // sert de clé de remontage pour forcer App.jsx à recharger ingrédients/recettes depuis Supabase
  // au lieu de garder en mémoire les données d'une session précédente (voir React.cloneElement
  // plus bas). Sans ça, se déconnecter/reconnecter (ou changer de compte) dans le même onglet sans
  // recharger la page pouvait réécrire silencieusement des données fraîches avec d'anciennes
  // données encore en mémoire — bug réel trouvé par l'utilisateur le 2026-08-05 (marge de recette
  // qui "revenait en arrière" après une reconnexion).
  const [loginKey, setLoginKey] = useState(0);
  const [recoveryMode, setRecoveryMode] = useState(false); // arrivée depuis le lien "mot de passe oublié"
  const [showLanding, setShowLanding] = useState(true); // page d'accueil publique, avant le formulaire
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  // [CHANGEMENT 2026-08-27] Inscription en deux temps : on ne montre d'abord QUE le champ email.
  // Motif : sur mobile, un formulaire qui affiche d'emblée "email + mot de passe (6 caractères
  // minimum)" à quelqu'un qui n'a encore rien vu du produit se lit comme une corvée, et c'est l'un
  // des points d'abandon les mieux documentés. Un seul champ visible se lit comme une question.
  // Le mot de passe reste obligatoire ensuite (voir plus bas pourquoi on ne l'a PAS supprimé).
  const [signupStep, setSignupStep] = useState("email"); // "email" | "password"
  // [AJOUT 2026-08-27, refonte "inscription hyper rapide"] Connexion/inscription par code à 6
  // chiffres reçu par email, sans mot de passe — remplace l'ancien lien magique. Motif du
  // changement de mécanisme (pas juste de nom) : un LIEN fait quitter l'onglet (ouvre parfois une
  // autre appli sur mobile/navigateur intégré TikTok — c'est exactement ce qui avait cassé
  // l'inscription par lien magique le 2026-08-27, voir plus bas). Un CODE se tape directement dans
  // le même onglet : on ne perd jamais le contexte. `otpFlow` distingue signup (crée le compte,
  // envoie l'événement pub CompleteRegistration) de login (compte déjà existant) — même écran de
  // saisie de code pour les deux, seul ce qui se passe APRÈS la vérification diffère.
  const [otpFlow, setOtpFlow] = useState(null); // null | "signup" | "login"
  const [otpCode, setOtpCode] = useState("");
  const [authLang, setAuthLang] = useState(guessAuthLang);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);

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
      if (event === "SIGNED_IN") {
        setLoginKey((k) => k + 1);
        logLoginActivity(sess);
        maybeScheduleWelcomeEmail(sess);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function switchMode(next) {
    setMode(next);
    setErr("");
    setInfo("");
    setSignupStep("email");
    setOtpFlow(null);
    setOtpCode("");
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setInfo("");
    // Première étape de l'inscription : on ne fait AUCUN appel réseau, on révèle simplement le
    // champ mot de passe. Volontairement tolérant sur la validation (le champ est déjà `type=email`
    // et `required`) — refuser une adresse ici avec un message d'erreur serait le meilleur moyen de
    // perdre quelqu'un dès le premier écran.
    if (mode === "signup" && signupStep === "email") {
      if (!email.trim()) {
        setErr("authErrorInvalidEmail");
        return;
      }
      setSignupStep("password");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        // Provenance de campagne rattachée au compte (2026-08-26) : les événements de la landing
        // (`landing_events`) sont anonymes par conception, donc rien ne permettait de relier une
        // INSCRIPTION à la campagne qui l'a amenée — on savait combien de gens venaient de TikTok,
        // pas combien créaient un compte. On recopie donc ici la source mémorisée par la landing
        // (sessionStorage, voir src/Landing.jsx) dans les métadonnées du compte, lues ensuite par
        // api/admin-dashboard.js. Aucune table ni requête supplémentaire.
        // Ces métadonnées sont modifiables par l'utilisateur lui-même : c'est acceptable pour une
        // statistique d'acquisition (au pire quelqu'un fausse sa propre ligne), ce ne serait pas
        // acceptable pour une décision d'accès — d'où le choix de ne JAMAIS s'en servir ailleurs.
        let signupSource = null;
        try {
          signupSource = sessionStorage.getItem("chefup:src");
        } catch (e) {}
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          ...(signupSource ? { options: { data: { signup_source: signupSource.slice(0, 40) } } } : {}),
        });
        if (error) throw error;
        // Conversion réelle envoyée au pixel publicitaire (silencieux sans consentement ou sans
        // pixel configuré) : c'est le seul événement qui compte vraiment pour une régie.
        trackAdEvent("CompleteRegistration", { content_name: signupSource || "direct" });
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
      setErr(authErrorKey(e2));
    } finally {
      setBusy(false);
    }
  }

  // Renvoie le mail de confirmation d'inscription (2026-08-25) : proposé directement sous l'erreur
  // "email not confirmed" pour qu'un utilisateur qui n'a pas trouvé le premier mail (souvent parti
  // en spam) puisse en redemander un sans nous écrire — l'app lui rappelle aussi de vérifier ses
  // spams cette fois, ce n'était pas mentionné sur le tout premier mail.
  async function resendConfirmation() {
    if (!email) {
      setErr("authErrorInvalidEmail");
      return;
    }
    setResendBusy(true);
    setErr("");
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      setInfo("authResendConfirmationSent");
    } catch (e2) {
      setErr(authErrorKey(e2));
    } finally {
      setResendBusy(false);
    }
  }

  // Envoie le code à 6 chiffres (signup crée le compte s'il n'existe pas encore, login échoue
  // simplement si le compte n'existe pas — Supabase gère déjà ça nativement via `shouldCreateUser`).
  async function sendOtpCode(flow) {
    setErr("");
    setInfo("");
    if (!email.trim()) {
      setErr("authErrorInvalidEmail");
      return;
    }
    setBusy(true);
    try {
      // Provenance de campagne (voir plus haut, même logique que l'inscription classique) : sans
      // ça, un compte créé par ce chemin serait compté "direct" et fausserait la mesure pub.
      let signupSource = null;
      try {
        signupSource = sessionStorage.getItem("chefup:src");
      } catch (e) {}
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: flow === "signup",
          ...(flow === "signup" && signupSource ? { data: { signup_source: signupSource.slice(0, 40) } } : {}),
        },
      });
      if (error) throw error;
      setOtpCode("");
      setOtpFlow(flow);
      setInfo("authMagicLinkInfo");
    } catch (e2) {
      setErr(authErrorKey(e2));
    } finally {
      setBusy(false);
    }
  }

  // Vérifie le code tapé. Réutilisée pour signup ET login : `otpFlow` dit laquelle des deux on
  // vient de faire, uniquement pour savoir s'il faut prévenir la régie publicitaire d'une vraie
  // conversion (`CompleteRegistration`) — la session, elle, se met en place pareil dans les deux
  // cas via `onAuthStateChange` (SIGNED_IN), déjà branché plus haut.
  async function verifyOtpCode(code) {
    setErr("");
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) throw error;
      if (otpFlow === "signup") {
        let signupSource = null;
        try {
          signupSource = sessionStorage.getItem("chefup:src");
        } catch (e) {}
        trackAdEvent("CompleteRegistration", { content_name: signupSource || "direct" });
      }
    } catch (e2) {
      setErr(authErrorKey(e2));
      setOtpCode("");
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
      setErr(authErrorKey(e2));
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

  // Écran de saisie du code à 6 chiffres — remplace tout le formulaire tant qu'un code a été
  // envoyé (`otpFlow` non nul). Un seul champ, vérification automatique dès le 6e chiffre : pas de
  // bouton supplémentaire à chercher, c'est le point qui rend ce chemin vraiment "hyper rapide".
  if (!session && otpFlow) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 font-body" style={{ background: "#1B1815" }}>
        <div className="w-full max-w-sm rounded-2xl p-6 border border-white/10" style={{ background: "#26221C" }}>
          <div className="flex items-center gap-2 justify-center mb-2">
            <Logo size={30} />
            <h1 className="font-display text-white text-lg tracking-wide uppercase">Chefup</h1>
          </div>
          {LangSwitcher}
          <h2 className="text-white text-center font-display uppercase text-sm tracking-wide mb-1.5">
            {t("authOtpTitle")}
          </h2>
          <p className="text-center text-xs text-white/50 mb-5">{t("authOtpSubtitle")(email)}</p>

          {err && (
            <div className="mb-4 text-xs rounded-lg px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20">
              {t(err)}
            </div>
          )}
          {info && !err && (
            <div className="mb-4 text-xs rounded-lg px-3 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {t(info)}
            </div>
          )}

          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={otpCode}
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setOtpCode(v);
              setErr("");
              // Vérification automatique dès le 6e chiffre — pas besoin de chercher un bouton.
              if (v.length === 6) verifyOtpCode(v);
            }}
            className={`${inputClass} text-center text-2xl tracking-[0.6em] font-display mb-4 disabled:opacity-60`}
            placeholder="······"
          />

          <button
            type="button"
            disabled={busy || otpCode.length !== 6}
            onClick={() => verifyOtpCode(otpCode)}
            className="w-full py-2.5 rounded-full font-display uppercase text-xs tracking-wide font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {t("authOtpVerifyButton")}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => sendOtpCode(otpFlow)}
            className="w-full mt-3 text-xs text-white/50 hover:text-white disabled:opacity-60"
          >
            {t("authOtpResend")}
          </button>
          <button
            type="button"
            onClick={() => { setOtpFlow(null); setOtpCode(""); setErr(""); setInfo(""); }}
            className="w-full mt-2 text-xs text-white/40 hover:text-white"
          >
            {t("authOtpBack")}
          </button>
        </div>
      </div>
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
              {err === "authErrorEmailNotConfirmed" && (
                <button
                  type="button"
                  onClick={resendConfirmation}
                  disabled={resendBusy}
                  className="mt-2 w-full text-center underline text-red-300 hover:text-red-200 disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {resendBusy && <Loader2 size={12} className="animate-spin" />}
                  {t("authResendConfirmationButton")}
                </button>
              )}
              {/* "Un compte existe déjà" était un cul-de-sac : en test réel, l'utilisateur a fini
                  par changer d'adresse email pour pouvoir s'inscrire. On propose donc directement
                  la sortie évidente — se connecter avec ce compte. */}
              {err === "authErrorAlreadyRegistered" && (
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="mt-2 w-full text-center underline text-red-300 hover:text-red-200"
                >
                  {t("authAlreadyRegisteredGoLogin")}
                </button>
              )}
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

          {/* Le champ mot de passe reste caché tant que l'inscription est à l'étape "email" —
              un seul champ visible au premier regard (voir signupStep plus haut). En mode
              connexion, rien ne change : les deux champs restent affichés ensemble, l'utilisateur
              connaît déjà son mot de passe et le remplissage automatique du navigateur fait le
              travail. */}
          {mode !== "forgot" && !(mode === "signup" && signupStep === "email") && (
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
            {mode === "login"
              ? t("authLoginButton")
              : mode === "signup"
              ? signupStep === "email"
                ? t("authContinueButton")
                : t("authSignupButton")
              : t("authForgotButton")}
          </button>

          {/* [REVENU À L'INSCRIPTION le 2026-08-27, refonte "hyper rapide", avec le vrai problème
              corrigé cette fois] Un lien magique avait déjà été proposé ici, puis retiré : il
              créait le compte avant même d'être cliqué, et un utilisateur qui n'avait rien reçu
              (mail parti en spam) puis basculait sur le mot de passe se heurtait à "un compte
              existe déjà" sans issue — il avait dû changer d'email pour s'inscrire. Cette fois,
              DEUX choses ont changé : (1) c'est un CODE à taper dans le même onglet, plus un lien
              qui fait quitter l'app (le vrai souci sur le navigateur intégré de TikTok, où ouvrir
              un lien peut basculer vers un autre navigateur et perdre le contexte) ; (2) le
              cul-de-sac "compte existe déjà" a depuis reçu un bouton "Me connecter avec ce compte"
              (voir plus haut, `authAlreadyRegisteredGoLogin`) — même si quelqu'un choisit le code,
              ne le reçoit pas à temps et revient au mot de passe, il n'est plus jamais bloqué. */}
          {mode === "signup" && signupStep === "email" && (
            <>
              <div className="flex items-center gap-3 my-4">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] uppercase tracking-wide text-white/30">{t("authOrDivider")}</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => sendOtpCode("signup")}
                className="w-full py-2.5 rounded-full text-xs font-semibold border border-white/15 text-white/80 hover:bg-white/5 disabled:opacity-60"
              >
                {t("authMagicLinkSignupButton")}
              </button>
            </>
          )}

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
                onClick={() => sendOtpCode("login")}
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

  // cloneElement + key plutôt que "return children" tel quel : force React à démonter/remonter
  // entièrement l'app (SubscriptionGate + App) à chaque connexion réelle, pour que le useEffect de
  // chargement des données (dépendance [] dans App.jsx) se relance et reparte des données fraîches
  // de Supabase — voir le commentaire sur loginKey plus haut.
  return React.cloneElement(children, { key: `${session.user.id}-${loginKey}` });
}
