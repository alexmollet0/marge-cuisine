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

// Envoi d'email via l'API Resend (pas les templates d'auth Supabase, qui ne servent qu'à
// signup/reset/magic link) — partagé par api/send-reminders.js et api/contact.js.
export async function sendEmail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY manquant côté serveur.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: "Chefup <hello@getchefup.com>", to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend a refusé l'envoi (${res.status}) : ${await res.text()}`);
}
