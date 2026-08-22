// Tableau de bord admin (2026-08-19) — visites/clics/scans/essais/abonnements/comptes, pour
// l'utilisateur uniquement (voir AdminDashboard, src/App.jsx). Authentifié ET restreint à un seul
// email : contrairement aux autres endpoints protégés par ADMIN_SECRET (accès manuel, pas de
// session), celui-ci est appelé depuis l'app connectée, donc vérifié via le token de session ET
// une comparaison d'email côté serveur — jamais uniquement côté client, qui pourrait être falsifié.
//
// ⚠️ Ce projet est au plafond du plan Hobby Vercel (12 fonctions serverless par déploiement,
// _lib.js exclu) avec ce fichier. Avant d'ajouter un nouvel endpoint : fusionner avec un fichier
// existant proche, voir la note dans CLAUDE.md ("Fichiers clés").
import { requireUser, getSupabaseAdmin } from "./_lib.js";

const ADMIN_EMAIL = "alexmollet0@gmail.com";
const TRIAL_DAYS = 7;

export default async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: "Non authentifié." });
  if (user.email !== ADMIN_EMAIL) return res.status(403).json({ error: "Accès réservé." });

  const supabaseAdmin = getSupabaseAdmin();
  const days = Math.max(7, Math.min(90, parseInt(req.query.days, 10) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [landingRes, scanRes, subRes, usersRes] = await Promise.all([
      supabaseAdmin.from("landing_events").select("event_type, created_at").gte("created_at", since),
      supabaseAdmin.from("scan_events").select("created_at").gte("created_at", since),
      supabaseAdmin.from("subscriptions").select("user_id, status"),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    ]);
    if (landingRes.error) throw landingRes.error;
    if (scanRes.error) throw scanRes.error;
    if (subRes.error) throw subRes.error;
    if (usersRes.error) throw usersRes.error;

    const landingRows = landingRes.data || [];
    const scanRows = scanRes.data || [];
    const subByUser = new Map((subRes.data || []).map((s) => [s.user_id, s]));
    const authUsers = usersRes.data?.users || [];

    // Série journalière (visites + scans) sur la période demandée, jours sans donnée inclus à 0
    // pour ne jamais donner l'impression trompeuse d'un trou dans les données.
    const dayKey = (iso) => iso.slice(0, 10);
    const dailyMap = {};
    for (let i = days - 1; i >= 0; i--) {
      const k = dayKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString());
      dailyMap[k] = { date: k, views: 0, startClicks: 0, scans: 0 };
    }
    landingRows.forEach((r) => {
      const k = dayKey(r.created_at);
      if (!dailyMap[k]) return;
      if (r.event_type === "view") dailyMap[k].views++;
      if (r.event_type === "start_click") dailyMap[k].startClicks++;
    });
    scanRows.forEach((r) => {
      const k = dayKey(r.created_at);
      if (dailyMap[k]) dailyMap[k].scans++;
    });
    const dailySeries = Object.values(dailyMap);

    const usersOut = authUsers
      .map((u) => {
        const sub = subByUser.get(u.id);
        const trialEnd = new Date(u.created_at).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000;
        const trialDaysLeft = Math.ceil((trialEnd - Date.now()) / (24 * 60 * 60 * 1000));
        const subActive = sub && ["active", "trialing", "past_due"].includes(sub.status);
        let status;
        if (subActive) status = sub.status === "past_due" ? "Paiement en retard" : "Abonné actif";
        else if (trialDaysLeft > 0) status = `Essai (J-${trialDaysLeft})`;
        else if (sub && sub.status === "canceled") status = "Annulé";
        else status = "Essai expiré";
        return { email: u.email, createdAt: u.created_at, status };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const kpis = {
      totalUsers: usersOut.length,
      activeTrials: usersOut.filter((u) => u.status.startsWith("Essai (")).length,
      activeSubs: usersOut.filter((u) => u.status === "Abonné actif" || u.status === "Paiement en retard").length,
      canceled: usersOut.filter((u) => u.status === "Annulé").length,
      expiredNoSub: usersOut.filter((u) => u.status === "Essai expiré").length,
      views: landingRows.filter((r) => r.event_type === "view").length,
      startClicks: landingRows.filter((r) => r.event_type === "start_click").length,
      scans: scanRows.length,
    };

    return res.status(200).json({ periodDays: days, kpis, dailySeries, users: usersOut });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
