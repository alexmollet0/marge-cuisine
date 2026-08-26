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
import { getSupabaseAdmin, getFoundingState } from "./_lib.js";

const VALID_EVENTS = new Set(["view", "start_click", "login_click"]);

// Provenance de la visite (2026-08-26), pour distinguer le trafic d'une campagne payante du
// trafic organique — indispensable dès qu'on paie de la publicité, sinon impossible de savoir si
// elle convertit. Reste totalement anonyme : c'est une simple étiquette de campagne (`tiktok`,
// `insta`...), jamais un identifiant de visiteur.
const MAX_SOURCE_LEN = 40;
const cleanSource = (raw) =>
  typeof raw === "string" && raw.trim()
    ? raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, MAX_SOURCE_LEN) || null
    : null;

// Compteur de places de l'offre de lancement : recalculé côté serveur, mais mis en cache
// brièvement en mémoire. Cet appel est public (la landing s'affiche avant toute connexion) et
// interroge l'API admin Supabase : sans ce cache, un visiteur qui rafraîchit en boucle
// déclencherait autant de requêtes admin. 60s suffisent largement pour un compteur de places.
let spotsCache = { at: 0, payload: null };
const SPOTS_CACHE_MS = 60 * 1000;

export default async function handler(req, res) {
  const supabaseAdmin = getSupabaseAdmin();

  if (req.method === "POST") {
    const body = req.body || {};
    const eventType = body.event;
    if (!VALID_EVENTS.has(eventType)) {
      return res.status(400).json({ error: "Événement inconnu." });
    }
    const source = cleanSource(body.source);
    try {
      let { error } = await supabaseAdmin.from("landing_events").insert({ event_type: eventType, source });
      // La colonne `source` doit être ajoutée à la main dans Supabase (voir CLAUDE.md). Tant que
      // ce n'est pas fait, l'insertion échoue sur une colonne inconnue : on réessaie alors sans
      // elle plutôt que de perdre le comptage de visite lui-même, qui est le plus important.
      if (error && source !== undefined) {
        const retry = await supabaseAdmin.from("landing_events").insert({ event_type: eventType });
        error = retry.error;
      }
      if (error) throw error;
      return res.status(200).json({ ok: true });
    } catch (e) {
      // Best-effort : un échec ici ne doit jamais gêner un visiteur (appelé en fire-and-forget).
      return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
    }
  }

  // Places restantes de l'offre de lancement — public et volontairement minimal : uniquement deux
  // nombres, jamais la moindre information sur les comptes eux-mêmes.
  if (req.method === "GET" && req.query.spots === "1") {
    // ⚠️ Garde-fou indispensable : tant que le prix fondateur n'existe pas côté Stripe
    // (STRIPE_FOUNDING_PRICE_ID absent), api/create-checkout-session.js facture forcément le tarif
    // normal. Annoncer l'offre dans ce cas afficherait 29€ sur la landing pour un prélèvement réel
    // de 49€ — c'est le serveur, et lui seul, qui décide si l'offre peut être montrée.
    if (!process.env.STRIPE_FOUNDING_PRICE_ID) {
      return res.status(200).json({ enabled: false, remaining: null, total: null });
    }
    if (spotsCache.payload && Date.now() - spotsCache.at < SPOTS_CACHE_MS) {
      return res.status(200).json(spotsCache.payload);
    }
    try {
      const { remaining, total } = await getFoundingState(supabaseAdmin);
      const payload = { enabled: true, remaining, total };
      spotsCache = { at: Date.now(), payload };
      return res.status(200).json(payload);
    } catch (e) {
      // Compteur indisponible : l'offre reste annonçable (le prix Stripe existe bien), simplement
      // sans le nombre de places.
      return res.status(200).json({ enabled: true, remaining: null, total: null });
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
      // `source` peut ne pas encore exister comme colonne (migration manuelle, voir POST plus
      // haut) : on retente sans elle plutôt que de renvoyer une erreur pour tout le funnel.
      let { data, error } = await supabaseAdmin
        .from("landing_events")
        .select("event_type, source, created_at")
        .gte("created_at", since);
      if (error) {
        const retry = await supabaseAdmin
          .from("landing_events")
          .select("event_type, created_at")
          .gte("created_at", since);
        data = retry.data;
        error = retry.error;
      }
      if (error) throw error;

      const rows = data || [];
      const countOf = (type) => rows.filter((r) => r.event_type === type).length;

      // Funnel détaillé par provenance : c'est ce qui dit si une campagne payante convertit
      // réellement, ou si les inscriptions viennent en fait du trafic organique.
      const bySource = {};
      for (const r of rows) {
        const key = r.source || "direct";
        if (!bySource[key]) bySource[key] = { views: 0, startClicks: 0, loginClicks: 0 };
        if (r.event_type === "view") bySource[key].views++;
        if (r.event_type === "start_click") bySource[key].startClicks++;
        if (r.event_type === "login_click") bySource[key].loginClicks++;
      }

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
        bySource,
      });
    } catch (e) {
      return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
    }
  }

  return res.status(405).json({ error: "Méthode non autorisée" });
}
