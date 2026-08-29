// Couleurs de marque, tarifs affichés, palette carte digitale — extrait de App.jsx le
// 2026-08-28. Regroupés ici en premier (avant les composants qui les utilisent) pour éviter
// toute dépendance circulaire entre fichiers.

export const TIER_COLORS = { low: "#EF4444", mid: "#F59E0B", high: "#10B981" };
// Couleurs du badge de classement des recettes (TOP1/2/3), volontairement distinctes des
// TIER_COLORS ci-dessus qui ne servent qu'à la marge — or / argent / bronze, un rang = une couleur.
// Tarifs affichés (2026-08-26). Point unique de vérité pour tout ce qui est MONTRÉ à l'utilisateur
// (landing, écran de fin d'essai, emails) — ce qui est réellement facturé vient toujours de Stripe
// via STRIPE_PRICE_ID / STRIPE_FOUNDING_PRICE_ID sur Vercel. Les deux doivent rester cohérents :
// changer un prix ici sans créer le prix correspondant dans Stripe afficherait un montant faux.
// `founding` = offre de lancement, 50 places, verrouillé à vie (voir api/_lib.js, FOUNDING_SPOTS).
export const PRICING = { standard: 49, founding: 29 };

// Identité "Ardoise de cuisine" (2026-08-29) — remplace le dégradé violet->cyan (jugé par
// l'utilisateur "trop appli IA générique") par du cuivre/laiton chaud, cohérent avec le fond
// ardoise déjà en place. Seul le chrome interactif générique (boutons, focus, sélection,
// onglets) utilise ces couleurs — TIER_COLORS/les indicateurs de statut (confiant/importé/prix
// en baisse = vert, à surveiller = orange, problème = rouge) restent inchangés, jamais confondus
// avec la couleur de marque. `BRAND_SOLID_PAPER` reste un cuivre plus foncé pour rester lisible
// sur le ticket recette imprimé (fond blanc/clair, voir la contrainte `.ticket` dans App.jsx).
export const BRAND_SOLID = "#C9793B";
export const BRAND_SOLID_PAPER = "#9C5B28";
export const BRAND_GRADIENT = "linear-gradient(135deg, #C9793B 0%, #E0A050 100%)";
export const BRAND_SHADOW = "inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 14px rgba(201,121,59,0.35)";
export const TOP_BADGE_COLORS = ["#D4AF37", "#B4B8BC", "#C97F3F"];

// Sections de la carte digitale publique (2026-08, v2) : le restaurateur définit lui-même ses
// sections (`menuSettings.customCategories`, tableau {id,name}) au lieu d'une liste fixe — un
// premier retour utilisateur a montré que 4 catégories figées (entrée/plat/dessert/boisson) ne
// couvrent pas des cas réels comme "Pizzas" ou "Sauces". Ces 4 valeurs ne servent plus qu'à
// pré-remplir un point de départ (`defaultMenuCategories`) la première fois qu'un compte ouvre la
// carte digitale — les ids sont volontairement conservés identiques pour rester compatibles avec
// les recettes déjà catégorisées avant ce changement. Depuis le 2026-08-18 (v3), `name` est un
// objet {fr,es,en} (comme `menuDescription`) et non plus une seule chaîne, pour que le nom d'une
// section personnalisée (ex: "Pizzas") soit lui aussi traduit automatiquement — voir
// `categoryLabel` (résout la bonne langue, avec repli sur l'ancien format chaîne si jamais une
// section a été créée avant ce changement).
export const MENU_CATEGORIES = ["starter", "main", "dessert", "drink"];
export const MENU_CATEGORY_LABELS = {
  starter: { fr: "Entrées", es: "Entrantes", en: "Starters" },
  main: { fr: "Plats", es: "Platos principales", en: "Main courses" },
  dessert: { fr: "Desserts", es: "Postres", en: "Desserts" },
  drink: { fr: "Boissons", es: "Bebidas", en: "Drinks" },
};
export function defaultMenuCategories() {
  return MENU_CATEGORIES.map((id) => ({ id, name: { ...MENU_CATEGORY_LABELS[id] } }));
}
export function categoryLabel(category, lang) {
  if (!category) return "";
  if (typeof category.name === "string") return category.name;
  return category.name?.[lang] || category.name?.fr || "";
}
// Palette resserrée plutôt qu'un vrai sélecteur de couleur libre : évite qu'un restaurateur
// choisisse une combinaison illisible (texte clair sur fond clair) sur la carte publique.
export const MENU_ACCENT_COLORS = ["#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899"];
// 4 designs visuellement distincts (2026-08, v2) — le premier jet (2 designs qui ne changeaient
// qu'une couleur de prix) a été jugé "trop tech" par l'utilisateur pour une carte de restaurant.
// `bg` sert uniquement de pastille d'aperçu dans le sélecteur (`DigitalMenuModal`) ; le vrai rendu
// (structure + palette complète) vit dans `src/PublicMenu.jsx`.
export const MENU_DESIGNS = [
  { id: "classic", bg: "#1B1815" },
  { id: "modern", bg: "#1B1815" },
  { id: "elegant", bg: "#F7F1E6" },
  { id: "bistro", bg: "#6E2A22" },
];
export const DESIGN_LABEL_KEYS = {
  classic: "digitalMenuDesignClassic",
  modern: "digitalMenuDesignModern",
  elegant: "digitalMenuDesignElegant",
  bistro: "digitalMenuDesignBistro",
};

// Retire uniquement le code/référence interne en début de ligne (ex: "F11893 ") pour un
// aperçu du texte facture lisible au premier coup d'œil, sans toucher au texte brut complet
// (rawLabel) qui reste intact pour la mémoire des rapprochements et la vérification exacte.
// [BUG confirmé et corrigé, 2026-08-26] Rendu visuel d'une variation de prix scannée, centralisé
// ici parce que les 3 endroits qui l'affichaient (carte compacte, panneau "Modifier", pile de
// vérification) avaient chacun leur copie de la règle — et les 3 avaient le même bug : la couleur
// ET la flèche étaient pilotées par `bigChange` (= écart de plus de 40%, vrai dans les DEUX sens),
// donc une grosse BAISSE s'affichait en rouge avec une flèche vers le haut, juste à côté du texte
// "Prix en baisse" (cas réel signalé sur l'huile d'olive). Règle unique désormais : c'est le SENS
// qui décide de la couleur et de la flèche, jamais l'ampleur. `bigChange` ne fait plus que
// foncer le rouge d'une hausse déjà signalée — une baisse reste toujours verte, flèche vers le bas.
export const priceChangeVisual = (item) => ({
  up: !!item.priceUp,
  color: item.priceUp ? (item.bigChange ? TIER_COLORS.low : TIER_COLORS.mid) : "#10B981",
});

export const lightRawLabel = (raw) => {
  const s = (raw || "").trim();
  if (!s) return "";
  const cleaned = s.replace(/^[A-Z]{0,2}\d{3,8}\s+/i, "").trim();
  return cleaned || s;
};
