// Journal statistique du scanner (2026-08). Fusionné avec les anciens fichiers séparés
// log-scan-event.js (écriture)/scan-stats.js (lecture) le 2026-08-18 — pas pour des raisons de
// code, mais parce que le plan Hobby de Vercel plafonne à 12 fonctions serverless par déploiement
// et que ce projet venait de le dépasser (build silencieusement resté sur l'ancien déploiement,
// aucune erreur visible côté client). Voir aussi api/landing.js, fusionné pour la même raison le
// même jour.
//
// POST (authentifié, `requireUser`) :
// - Sans `type` explicite (chemin historique, réservé au scanner de factures/fiches) : enregistre
//   quelques compteurs agrégés par scan dans `scan_events` (combien de lignes détectées/exclues/
//   incertaines) — jamais de contenu de facture (pas de nom de produit, pas de prix, pas de
//   fournisseur), uniquement des nombres. En plus (2026-08-23), miroir best-effort dans
//   `activity_events` (mêmes compteurs en `meta`) pour alimenter le flux d'activité par compte du
//   tableau de bord admin (voir api/admin-dashboard.js).
// - `type: "login" | "recipe_created"` (2026-08-23, nouveau) : écrit uniquement dans
//   `activity_events`, pour le même flux d'activité — permet à l'utilisateur (fondateur) de suivre
//   en direct ce qu'un compte fait dans l'app (connexions, recettes créées, scans + leur résultat)
//   sans dépendre de logs Vercel. `meta` est un objet libre, jamais de données sensibles au-delà
//   d'un nom de recette.
//
// GET (protégé par `ADMIN_SECRET`, `?secret=...&days=30&raw=1`) : résumé chiffré de la fiabilité
// du scanner sur l'ensemble des comptes (inchangé, lit toujours scan_events).
import { requireUser, getSupabaseAdmin, uploadScanImage } from "./_lib.js";

// Résultat du scan + photo d'origine (2026-08-31), demandé explicitement par l'utilisateur pour
// pouvoir vérifier depuis le tableau de bord admin qu'un scan a bien fonctionné, sans devoir
// redemander la facture à son client. Reprend volontairement la décision de confidentialité prise
// le 2026-08-24 ("jamais de contenu de facture, juste des compteurs") — assumé et documenté comme
// un changement délibéré, pas un oubli : nom/prix/unité de chaque ligne + la photo elle-même sont
// désormais journalisés, réservés au tableau de bord admin (jamais exposés côté client), avec
// suppression automatique des photos après 30 jours (voir uploadScanImage, api/_lib.js).
// Filet anti-abus : jamais plus de 60 lignes gardées par scan (une vraie facture n'en a jamais
// autant), et seuls les 3 champs utiles à la vérification visuelle sont conservés.
function sanitizeScanItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 60).map((it) => ({
    name: typeof it?.name === "string" ? it.name.slice(0, 120) : "",
    unit: typeof it?.unit === "string" ? it.unit.slice(0, 20) : "",
    price: Number.isFinite(it?.price) ? it.price : null,
  }));
}

// `scan_failed` (2026-08-24) : un scan qui ÉCHOUE (réseau coupé, délai dépassé, IA indisponible,
// fichier illisible) n'écrivait jusqu'ici strictement rien nulle part — le journal `scan_events`
// n'est alimenté qu'après une réponse réussie. Résultat concret : quand la première vraie cliente
// a signalé "je n'arrive pas à importer mes factures", le tableau de bord admin ne montrait AUCUN
// scan pour son compte, impossible de savoir si elle avait seulement essayé. Ces échecs partent
// donc désormais dans `activity_events` (aucune nouvelle table, aucune nouvelle fonction Vercel —
// le plafond de 12 est atteint), avec uniquement un code d'erreur et le type de fichier en `meta`.
// Étapes de parcours (2026-08-31), demandées par l'utilisateur pour savoir PRÉCISÉMENT où un
// compte décroche — voir CLAUDE.md. `tutorial_closed`/`tab_opened`/`digital_menu_published`/
// `subscribe_clicked` s'ajoutent à la liste déjà existante, aucune donnée sensible dans `meta`
// (juste une étape/un nom d'onglet, jamais de contenu de recette ou de facture).
const SIMPLE_ACTIVITY_TYPES = new Set([
  "login", "recipe_created", "scan_failed",
  "tutorial_closed", "tab_opened", "digital_menu_published", "subscribe_clicked",
]);

export default async function handler(req, res) {
  const supabaseAdmin = getSupabaseAdmin();

  if (req.method === "POST") {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ error: "Non authentifié." });

    const b = req.body || {};

    if (SIMPLE_ACTIVITY_TYPES.has(b.type)) {
      try {
        const meta = b.meta && typeof b.meta === "object" ? { ...b.meta } : {};
        // Un scan échoué garde aussi sa photo/PDF d'origine quand disponible (pas toujours le cas —
        // un fichier illisible côté navigateur n'a par exemple jamais pu être décodé du tout).
        if (b.type === "scan_failed" && b.image) {
          const imagePath = await uploadScanImage(supabaseAdmin, user.id, b.image, b.mediaType);
          if (imagePath) meta.imagePath = imagePath;
        }
        const { error } = await supabaseAdmin
          .from("activity_events")
          .insert({ user_id: user.id, type: b.type, meta });
        if (error) throw error;
        return res.status(200).json({ ok: true });
      } catch (e) {
        return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
      }
    }

    const toInt = (v) => (Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
    const scanner = b.scanner === "recipe" ? "recipe" : "invoice";
    const row = {
      user_id: user.id,
      scanner,
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
      const { error } = await supabaseAdmin.from("scan_events").insert(row);
      if (error) throw error;
      // Miroir best-effort dans le flux d'activité unifié — ne doit jamais faire échouer la
      // réponse au client si activity_events n'existe pas encore ou si l'écriture échoue. Photo +
      // résultat détaillé (2026-08-31) : voir le commentaire de sanitizeScanItems plus haut.
      // ⚠️ AWAIT nécessaire (pas de fire-and-forget non attendu) : Vercel peut couper l'exécution
      // dès que la réponse part, donc l'upload de l'image + l'insertion doivent finir AVANT de
      // répondre au client — ce endpoint est déjà appelé en fire-and-forget depuis le navigateur
      // (voir App.jsx), la latence supplémentaire ici ne bloque donc jamais le scan lui-même.
      try {
        const meta = {
          supplierKnown: row.supplier_known,
          totalItems: row.total_items,
          foodItems: row.food_items,
          excludedItems: row.excluded_items,
          zeroItems: row.zero_items,
          lowConfidenceItems: row.low_confidence_items,
          priceInconsistentItems: row.price_inconsistent_items,
          pricingUnknownItems: row.pricing_unknown_items,
          items: sanitizeScanItems(b.items),
        };
        if (b.image) {
          const imagePath = await uploadScanImage(supabaseAdmin, user.id, b.image, b.mediaType);
          if (imagePath) meta.imagePath = imagePath;
        }
        await supabaseAdmin
          .from("activity_events")
          .insert({ user_id: user.id, type: scanner === "recipe" ? "scan_recipe" : "scan_invoice", meta });
      } catch (e) {}
      return res.status(200).json({ ok: true });
    } catch (e) {
      // Best-effort : un échec ici ne doit jamais faire échouer le scan lui-même côté client
      // (appelé en fire-and-forget), mais on renvoie quand même une erreur propre si interrogé.
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

  return res.status(405).json({ error: "Méthode non autorisée" });
}
