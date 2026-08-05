// Journal statistique du scanner (2026-08) — enregistre, à chaque scan, quelques compteurs
// agrégés (combien de lignes détectées/exclues/incertaines) pour permettre de surveiller la
// fiabilité réelle du scanner sur l'ensemble des comptes, sans dépendre de retours spontanés des
// utilisateurs (la plupart d'un vrai problème ne le signalent jamais, ils arrêtent juste
// d'utiliser). JAMAIS de contenu de facture (pas de nom de produit, pas de prix, pas de nom de
// fournisseur) : uniquement des nombres. Invisible dans l'app elle-même — aucun utilisateur ne
// voit ces données sur son propre compte, seule une requête protégée par ADMIN_SECRET
// (api/scan-stats.js) peut les lire.
import { requireUser, getSupabaseAdmin } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: "Non authentifié." });

  const b = req.body || {};
  const toInt = (v) => (Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
  const row = {
    user_id: user.id,
    scanner: b.scanner === "recipe" ? "recipe" : "invoice",
    supplier_known: !!b.supplierKnown,
    total_items: toInt(b.totalItems),
    food_items: toInt(b.foodItems),
    excluded_items: toInt(b.excludedItems),
    zero_items: !!b.zeroItems,
    low_confidence_items: toInt(b.lowConfidenceItems),
    many_low_confidence: !!b.manyLowConfidence,
    price_inconsistent_items: toInt(b.priceInconsistentItems),
    pricing_unknown_items: toInt(b.pricingUnknownItems),
  };

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.from("scan_events").insert(row);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (e) {
    // Best-effort : un échec ici ne doit jamais faire échouer le scan lui-même côté client
    // (appelé en fire-and-forget), mais on renvoie quand même une erreur propre si interrogé.
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
