// Compteur de visite de la landing page (2026-08). Fusionné avec les anciens fichiers séparés
// log-landing-event.js (écriture)/landing-stats.js (lecture) le 2026-08-18 — pas pour des raisons
// de code, mais parce que le plan Hobby de Vercel plafonne à 12 fonctions serverless par
// déploiement et que ce projet venait de le dépasser (build silencieusement resté sur l'ancien
// déploiement). Voir aussi api/scan-events.js, fusionné pour la même raison le même jour.
//
// POST (public, sans authentification — la landing s'affiche avant toute connexion) : enregistre
// un événement (`view`/`start_click`/`login_click`). Aucune donnée personnelle stockée (pas d'IP,
// pas d'email, pas d'user-agent) : juste un type d'événement et une date.
//
// GET (protégé par `ADMIN_SECRET`, `?secret=...&days=30`) : donne le funnel complet — vues,
// clics, et le nombre de comptes réellement créés sur la période (API admin Supabase Auth).
import { getSupabaseAdmin } from "./_lib.js";

const VALID_EVENTS = new Set(["view", "start_click", "login_click"]);

export default async function handler(req, res) {
  const supabaseAdmin = getSupabaseAdmin();

  if (req.method === "POST") {
    const eventType = (req.body || {}).event;
    if (!VALID_EVENTS.has(eventType)) {
      return res.status(400).json({ error: "Événement inconnu." });
    }
    try {
      const { error } = await supabaseAdmin.from("landing_events").insert({ event_type: eventType });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    } catch (e) {
      // Best-effort : un échec ici ne doit jamais gêner un visiteur (appelé en fire-and-forget).
      return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
    }
  }

  if (req.method === "GET") {
    const secret = process.env.ADMIN_SECRET;
    const provided = req.query.secret || (req.headers.authorization || "").replace(/^Bearer /, "");
    if (!secret || provided !== secret) {
      return res.status(401).json({ error: "Non autorisé." });
    }

    const days = Math.max(1, Math.min(365, parseInt(req.query.days, 10) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    try {
      const { data, error } = await supabaseAdmin
        .from("landing_events")
        .select("event_type, created_at")
        .gte("created_at", since);
      if (error) throw error;

      const rows = data || [];
      const countOf = (type) => rows.filter((r) => r.event_type === type).length;

      let accountsCreated = null;
      try {
        const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        if (!usersError) {
          const sinceMs = new Date(since).getTime();
          accountsCreated = (usersData?.users || []).filter((u) => new Date(u.created_at).getTime() >= sinceMs).length;
        }
      } catch (e) {}

      return res.status(200).json({
        periodDays: days,
        views: countOf("view"),
        startClicks: countOf("start_click"),
        loginClicks: countOf("login_click"),
        accountsCreated,
      });
    } catch (e) {
      return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
    }
  }

  return res.status(405).json({ error: "Méthode non autorisée" });
}
