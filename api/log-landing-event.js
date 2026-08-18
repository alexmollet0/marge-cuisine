// Compteur de visite de la landing page (2026-08), pour distinguer "personne ne clique le lien"
// de "les gens cliquent mais n'ouvrent jamais de compte" — voir Authentication > Users dans
// Supabase pour les comptes réellement créés. Aucune donnée personnelle stockée (pas d'IP, pas
// d'email, pas d'user-agent) : juste un type d'événement et une date. Endpoint public sans
// authentification (la landing page s'affiche avant toute connexion) — écrit via le client admin
// service_role, jamais accessible en lecture/écriture directe depuis le navigateur (RLS activé
// sans policy sur la table, même principe que scan_events).
import { getSupabaseAdmin } from "./_lib.js";

const VALID_EVENTS = new Set(["view", "start_click", "login_click"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const eventType = (req.body || {}).event;
  if (!VALID_EVENTS.has(eventType)) {
    return res.status(400).json({ error: "Événement inconnu." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.from("landing_events").insert({ event_type: eventType });
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (e) {
    // Best-effort : un échec ici ne doit jamais gêner un visiteur (appelé en fire-and-forget).
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
