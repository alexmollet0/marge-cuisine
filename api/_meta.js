// Nettoyage du champ `meta` des événements d'activité envoyés par le navigateur (2026-11-19). Préfixe `_` : pas une route Vercel (le plafond de 12 fonctions
// est atteint), simple module partagé avec api/scan-events.js.
//
// Pourquoi : `meta` vient du navigateur d'un compte connecté et était inséré tel quel dans `activity_events`. Les nouveaux événements de suivi (appareil,
// erreurs JavaScript, actions clés) passent par ici : au plus 16 clés, noms simples, valeurs simples (texte de 300 caractères au plus, nombre, booléen),
// jamais d'objet ni de tableau, 2 500 caractères au plus une fois sérialisé. Les anciens types d'événements (scan_failed avec son résultat détaillé…)
// gardent leur traitement d'avant.
export const MAX_CLES = 16;
export const MAX_TEXTE = 300;
export const MAX_TOTAL = 2500;

export function sanitizeMeta(meta) {
  const out = {};
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return out;
  let n = 0;
  for (const [k, v] of Object.entries(meta)) {
    if (n >= MAX_CLES) break;
    const cle = String(k).replace(/[^A-Za-z0-9_]/g, "_").slice(0, 40);
    if (!cle) continue;
    if (typeof v === "string") out[cle] = v.slice(0, MAX_TEXTE);
    else if (typeof v === "number" && Number.isFinite(v)) out[cle] = v;
    else if (typeof v === "boolean" || v === null) out[cle] = v;
    else continue; // ni objet, ni tableau, ni fonction
    n++;
  }
  // Trop gros une fois sérialisé : on retire les textes les plus longs d'abord
  while (JSON.stringify(out).length > MAX_TOTAL) {
    const textes = Object.entries(out).filter(([, v]) => typeof v === "string").sort((a, b) => b[1].length - a[1].length);
    if (!textes.length) break;
    delete out[textes[0][0]];
  }
  return out;
}
