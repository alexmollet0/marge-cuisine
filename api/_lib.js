// Fichier utilitaire partagé par les fonctions serveur Stripe. Le préfixe "_" empêche Vercel de
// le déployer lui-même comme une route (convention Vercel pour du code partagé dans /api).
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Client Supabase "admin" (clé service_role, jamais exposée au navigateur) : contourne les
// policies RLS, nécessaire ici car le webhook Stripe et les fonctions de facturation écrivent
// dans la table subscriptions sans être "connectés" comme un utilisateur normal.
export function getSupabaseAdmin() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Vérifie le token de session Supabase envoyé par le client (Authorization: Bearer <token>) et
// renvoie l'utilisateur correspondant, ou null. C'est le token signé par Supabase qui prouve
// l'identité — on ne fait jamais confiance à un user_id envoyé directement dans le corps de la
// requête, qui pourrait être falsifié.
export async function requireUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// Vérification "souple" de l'utilisateur (2026-08-24), pensée pour les endpoints COÛTEUX (scan IA)
// où il faut deux choses à la fois, en apparence contradictoires :
//  - empêcher un inconnu d'appeler l'endpoint en boucle et de consommer nos crédits d'IA ;
//  - ne JAMAIS bloquer un vrai restaurateur à cause d'un incident qui n'a rien à voir avec lui.
// D'où ce résultat en 4 états plutôt qu'un simple oui/non (contrairement à `requireUser`, qui
// renvoie `null` aussi bien pour "aucun token" que pour "Supabase est en panne" — indistinguable,
// donc inutilisable ici sans risquer de bloquer un client pendant une panne) :
//  - "ok"           : token valide, c'est un client connecté ;
//  - "missing"      : aucun token du tout → c'est la signature d'un appel automatisé, on refuse ;
//  - "invalid"      : token présent mais explicitement refusé (expiré) → le client peut le
//                     rafraîchir et relancer tout seul, l'app le fait automatiquement ;
//  - "unverifiable" : impossible de savoir (Supabase injoignable, erreur 5xx, délai dépassé) →
//                     ON LAISSE PASSER volontairement. Mieux vaut offrir un scan de trop que
//                     bloquer un restaurateur pour une panne dont il n'est pas responsable.
export async function checkUserSoft(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { status: "missing", user: null };
  try {
    // Délai court : la vérification ne doit jamais rallonger sensiblement un scan, et surtout
    // jamais le faire échouer si Supabase met du temps à répondre.
    const result = await Promise.race([
      getSupabaseAdmin().auth.getUser(token),
      new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 5000)),
    ]);
    if (result?.timedOut) return { status: "unverifiable", user: null };
    if (result?.data?.user) return { status: "ok", user: result.data.user };
    // Seul un refus EXPLICITE compte comme un token invalide. Tout le reste (panne, limite de
    // débit, erreur réseau) est traité comme "je ne sais pas", donc laissé passer.
    const status = result?.error?.status;
    if (status === 401 || status === 403) return { status: "invalid", user: null };
    return { status: "unverifiable", user: null };
  } catch (e) {
    return { status: "unverifiable", user: null };
  }
}

// Envoi d'email via l'API Resend (pas les templates d'auth Supabase, qui ne servent qu'à
// signup/reset/magic link) — partagé par api/send-reminders.js et api/contact.js.
// `attachments` (optionnel) : tableau au format Resend [{ filename, content (base64) }].
// `scheduledAt` (optionnel, 2026-08-24) : ISO 8601 UTC — programme l'envoi dans le futur au lieu
// d'envoyer immédiatement (utilisé par le mail d'accueil, voir api/send-reminders.js).
// `replyTo` (optionnel, 2026-08-24) : adresse où atterrissent les réponses, distincte de `from`
// (qui reste "hello@getchefup.com" pour la marque) — utile tant que cette adresse n'a pas de
// vraie boîte de réception configurée (voir CLAUDE.md, section EN COURS).
// Habillage HTML commun à tous les emails automatiques (bordure de marque, CTA, mention en bas de
// page) — partagé par api/send-reminders.js et api/admin-dashboard.js (2026-08-25, mail de
// déblocage) pour ne pas dupliquer ce gabarit à chaque nouvel usage.
export function wrapEmailHtml(bodyHtml, ctaLabel, settingsHint) {
  return `<div style="font-family:Arial,sans-serif;background:#F3EBDA;padding:24px;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;">
      <div style="font-family:Arial,sans-serif;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;color:#6D28D9;margin-bottom:16px;">Chefup</div>
      <div style="color:#2B2620;font-size:14px;line-height:1.6;">${bodyHtml}</div>
      <a href="https://getchefup.com" style="display:inline-block;margin-top:20px;padding:10px 20px;border-radius:999px;background:linear-gradient(90deg,#8B5CF6,#22D3EE);color:#fff;text-decoration:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">${ctaLabel}</a>
      ${settingsHint ? `<p style="color:#2B2620;opacity:0.4;font-size:11px;margin-top:24px;">${settingsHint}</p>` : ""}
    </div>
  </div>`;
}

export async function sendEmail(to, subject, html, attachments, scheduledAt, replyTo) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY manquant côté serveur.");
  const body = { from: "Chefup <hello@getchefup.com>", to, subject, html };
  if (attachments && attachments.length) body.attachments = attachments;
  if (scheduledAt) body.scheduled_at = scheduledAt;
  if (replyTo) body.reply_to = replyTo;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Resend a refusé l'envoi (${res.status}) : ${await res.text()}`);
}
