// Aide de tarification/activité (prix effectif, variation, sauvegarde debounced, journal
// d'activité) — extrait de App.jsx le 2026-08-28.
import { useEffect } from "react";
import { storage } from "./storage.js";
import { supabase } from "./supabaseClient.js";

export const DEFAULT_SETTINGS = { vat: 10, minMargin: 75, emailRemindersEnabled: true };

export function useDebouncedSave(key, value, ready) {
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(async () => {
      try { await storage.set(key, JSON.stringify(value)); } catch (e) { console.error("save failed", key, e); }
    }, 500);
    return () => clearTimeout(t);
  }, [key, value, ready]);
}

export function activeSupplier(ing) {
  if (!ing || !ing.suppliers || !ing.suppliers.length) return null;
  return ing.suppliers.find((s) => s.id === ing.selectedSupplierId) || ing.suppliers[0];
}

// Prix réellement utilisable en cuisine une fois le parage/la perte pris en compte
// (ex: 20% de perte sur du poisson brut -> le kg utile coûte plus cher que le kg acheté).
// lossPercent vit sur l'ingrédient (pas sur la ligne de recette) : une seule vérité,
// modifiable depuis le garde-manger ou directement depuis une fiche recette.
// Le garde-fou à 95 évite une division par un nombre proche de 0 si une valeur
// aberrante (>=100) est un jour stockée.
export function effectiveUnitPrice(ing) {
  const sup = activeSupplier(ing);
  if (!sup) return 0;
  const loss = Math.min(Math.max(ing?.lossPercent || 0, 0), 95);
  return sup.price / (1 - loss / 100);
}

// Variation par rapport à la dernière mise à jour de prix connue du MÊME fournisseur actif
// (les 2 dernières entrées d'historique qui lui appartiennent). Filtré par supplierId (ou par
// nom pour les entrées anciennes sans supplierId, avant ce correctif) pour ne jamais comparer
// le prix actuel à celui d'un AUTRE fournisseur de cet ingrédient — bug réel trouvé par
// l'utilisateur (2026-08-22) : un ingrédient avec 2 fournisseurs (ex: une estimation de
// départ à 1€ jamais nettoyée, à côté du vrai fournisseur à 7,50€) pouvait comparer une
// nouvelle saisie à ce mauvais fournisseur et afficher une variation absurde (ex: 900%).
// Retourne null s'il n'y a pas assez d'historique pour ce fournisseur pour comparer.
export function priceVariation(ing) {
  const sup = activeSupplier(ing);
  if (!sup) return null;
  const h = (ing?.history || []).filter((e) => (e.supplierId ? e.supplierId === sup.id : e.supplierName === sup.name));
  if (h.length < 2) return null;
  const previous = h[h.length - 2].price;
  const current = h[h.length - 1].price;
  if (!previous) return null;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 1) return null; // variation négligeable, pas de bruit visuel
  return { pct: Math.round(Math.abs(pct)), dir: pct > 0 ? "up" : "down" };
}

// Flux d'activité admin (2026-08-23, voir AdminDashboard + api/scan-events.js) : journalise une
// action utilisateur simple (recette créée...) en fire-and-forget, jamais bloquant/visible pour
// l'utilisateur lui-même. Les scans ont déjà leur propre appel dédié (runScanPipeline), qui écrit
// à la fois dans scan_events (stats agrégées) ET, côté serveur, dans le même flux d'activité —
// pas besoin de dupliquer l'appel ici pour eux.
export function logActivity(type, meta) {
  (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch("/api/scan-events", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type, meta }),
      });
    } catch (e) {}
  })();
}
