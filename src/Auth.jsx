import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "./supabaseClient.js";
import { Logo, BRAND_SOLID, BRAND_GRADIENT, BRAND_SHADOW } from "./App.jsx";

const inputClass =
  "w-full rounded-lg px-3 py-2 text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-[#8B5CF6]";

// Porte d'authentification : affiche le formulaire connexion/inscription/mot de
// passe oublié tant qu'aucune session Supabase n'existe, sinon affiche l'app
// (children). Connexion obligatoire (décision produit du 2026-08-02) : aucun
// mode démo sans compte.
export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = chargement initial
  const [recoveryMode, setRecoveryMode] = useState(false); // arrivée depuis le lien "mot de passe oublié"
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

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
          setInfo("Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.");
          setMode("login");
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setInfo("Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.");
      }
    } catch (e2) {
      setErr(e2.message || "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (newPassword.length < 6) throw new Error("6 caractères minimum.");
      if (newPassword !== newPassword2) throw new Error("Les deux mots de passe ne correspondent pas.");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setRecoveryMode(false);
    } catch (e2) {
      setErr(e2.message || "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

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
          <h2 className="text-white text-center font-display uppercase text-sm tracking-wide mb-5">
            Nouveau mot de passe
          </h2>

          {err && (
            <div className="mb-4 text-xs rounded-lg px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20">
              {err}
            </div>
          )}

          <label className="block text-xs text-white/50 mb-1">Nouveau mot de passe</label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={`${inputClass} mb-4`}
            placeholder="6 caractères minimum"
          />

          <label className="block text-xs text-white/50 mb-1">Confirme le mot de passe</label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            className={`${inputClass} mb-5`}
            placeholder="Retape le même mot de passe"
          />

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-full font-display uppercase text-xs tracking-wide font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Valider le nouveau mot de passe
          </button>
        </form>
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
          <div className="flex items-center gap-2 justify-center mb-6">
            <Logo size={30} />
            <h1 className="font-display text-white text-lg tracking-wide uppercase">Chefup</h1>
          </div>
          <h2 className="text-white text-center font-display uppercase text-sm tracking-wide mb-5">
            {mode === "login" ? "Connexion" : mode === "signup" ? "Créer un compte" : "Mot de passe oublié"}
          </h2>

          {err && (
            <div className="mb-4 text-xs rounded-lg px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20">
              {err}
            </div>
          )}
          {info && (
            <div className="mb-4 text-xs rounded-lg px-3 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {info}
            </div>
          )}

          <label className="block text-xs text-white/50 mb-1">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} mb-4`}
            placeholder="toi@exemple.com"
          />

          {mode !== "forgot" && (
            <>
              <label className="block text-xs text-white/50 mb-1">Mot de passe</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} mb-5`}
                placeholder="6 caractères minimum"
              />
            </>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-full font-display uppercase text-xs tracking-wide font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {mode === "login" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : "Envoyer le lien de réinitialisation"}
          </button>

          {mode === "login" && (
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="w-full mt-4 text-xs text-white/50 hover:text-white"
            >
              Mot de passe oublié ?
            </button>
          )}

          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            className="w-full mt-2 text-xs text-white/50 hover:text-white"
          >
            {mode === "signup" ? "Déjà un compte ? Se connecter" : mode === "forgot" ? "Retour à la connexion" : "Pas encore de compte ? Créer un compte"}
          </button>
        </form>
      </div>
    );
  }

  return children;
}
