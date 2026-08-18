// Lecture des statistiques de la landing page (2026-08), réservée à l'utilisateur — protégée par
// ADMIN_SECRET, même principe que api/scan-stats.js. Donne le funnel complet : vues de la page,
// clics sur "Commencer gratuitement" (intention d'inscription) vs "J'ai déjà un compte", et le
// nombre de comptes réellement créés sur la même période (via l'API admin Supabase Auth), pour
// voir où les visiteurs abandonnent. `?days=30` (défaut) pour la fenêtre de temps.
import { getSupabaseAdmin } from "./_lib.js";

export default async function handler(req, res) {
  const secret = process.env.ADMIN_SECRET;
  const provided = req.query.secret || (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!secret || provided !== secret) {
    return res.status(401).json({ error: "Non autorisé." });
  }

  const days = Math.max(1, Math.min(365, parseInt(req.query.days, 10) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const supabaseAdmin = getSupabaseAdmin();
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
