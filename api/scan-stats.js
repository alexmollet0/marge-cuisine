// Lecture des statistiques agrégées du scanner (2026-08), réservée à l'utilisateur (via Claude
// dans une future conversation, ou directement) — protégée par ADMIN_SECRET, jamais par un compte
// utilisateur normal. Renvoie un résumé chiffré (taux de scans vides, part de lignes incertaines,
// etc.), jamais le contenu d'une facture individuelle. Paramètre `?days=30` (défaut) pour la
// fenêtre de temps, `?raw=1` pour renvoyer aussi les lignes brutes (sans user_id) en plus du
// résumé, utile pour un diagnostic plus fin.
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
      .from("scan_events")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const rows = data || [];
    const n = rows.length;
    const pct = (count) => (n ? Math.round((count / n) * 1000) / 10 : 0);
    const summary = {
      periodDays: days,
      totalScans: n,
      distinctAccounts: new Set(rows.map((r) => r.user_id)).size,
      scansWithZeroItems: rows.filter((r) => r.zero_items).length,
      scansWithZeroItemsPct: pct(rows.filter((r) => r.zero_items).length),
      scansWithManyLowConfidence: rows.filter((r) => r.many_low_confidence).length,
      scansWithManyLowConfidencePct: pct(rows.filter((r) => r.many_low_confidence).length),
      scansWithSupplierUnknown: rows.filter((r) => !r.supplier_known).length,
      avgFoodItemsPerScan: n ? Math.round((rows.reduce((s, r) => s + r.food_items, 0) / n) * 10) / 10 : 0,
      avgLowConfidenceItemsPerScan:
        n ? Math.round((rows.reduce((s, r) => s + r.low_confidence_items, 0) / n) * 10) / 10 : 0,
      avgPriceInconsistentItemsPerScan:
        n ? Math.round((rows.reduce((s, r) => s + r.price_inconsistent_items, 0) / n) * 10) / 10 : 0,
    };

    const payload = { summary };
    if (req.query.raw === "1") {
      payload.rows = rows.map(({ user_id, ...rest }) => rest);
    }
    return res.status(200).json(payload);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
