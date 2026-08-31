// Lecture publique de la carte digitale (2026-08) — endpoint SANS authentification, appelé
// directement par les clients du restaurant qui scannent le QR code (voir src/PublicMenu.jsx).
// Contrairement aux autres endpoints admin de ce projet (protégés par ADMIN_SECRET), celui-ci est
// volontairement ouvert à tous : c'est le but (une carte de restaurant est publique par nature).
// La seule protection est donc le FILTRAGE des champs renvoyés : jamais de coût, de marge, de
// fournisseur, de note interne ni d'aucune donnée de compte — uniquement ce qu'un client de
// restaurant doit voir (nom du plat, description, prix de vente, allergènes). Et rien n'est
// renvoyé du tout tant que le restaurateur n'a pas explicitement activé `menuSettings.published`.
import { getSupabaseAdmin } from "./_lib.js";

// Dupliqué depuis `MENU_CATEGORY_LABELS`/`defaultMenuCategories` de src/brand.js (même principe que
// `recipeMarginPercent` dans api/send-reminders.js — à resynchroniser à la main si les 4 sections
// par défaut changent). Nécessaire ici : `menuSettings.customCategories` ne contient RIEN tant que
// le restaurateur n'a jamais personnalisé ses sections (bouton crayon dans "Ajouter des plats") —
// avant ce correctif, un plat ajouté à la section par défaut "Entrées"/"Plats"/etc. n'avait donc
// jamais de section reconnue sur la carte PUBLIQUE (tombait dans le groupe "sans section", sans
// en-tête — voir groupByCategory dans src/PublicMenu.jsx), alors que côté app le même repli sur les
// 4 sections par défaut existe déjà (voir `categories` dans DigitalMenuModal, scannerComponents.jsx).
const DEFAULT_MENU_CATEGORY_LABELS = {
  starter: { fr: "Entrées", es: "Entrantes", en: "Starters" },
  main: { fr: "Plats", es: "Platos principales", en: "Main courses" },
  dessert: { fr: "Desserts", es: "Postres", en: "Desserts" },
  drink: { fr: "Boissons", es: "Bebidas", en: "Drinks" },
};
function defaultMenuCategories() {
  return Object.keys(DEFAULT_MENU_CATEGORY_LABELS).map((id) => ({ id, name: { ...DEFAULT_MENU_CATEGORY_LABELS[id] } }));
}

export default async function handler(req, res) {
  const userId = req.query.id;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Identifiant manquant." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("kv_store")
      .select("key, value")
      .eq("user_id", userId)
      .in("key", ["menuSettings", "recipes", "simpleItems"]);
    if (error) throw error;

    const menuSettingsRaw = (data || []).find((r) => r.key === "menuSettings")?.value;
    const recipesRaw = (data || []).find((r) => r.key === "recipes")?.value;
    const simpleItemsRaw = (data || []).find((r) => r.key === "simpleItems")?.value;
    const menuSettings = menuSettingsRaw ? JSON.parse(menuSettingsRaw) : null;

    // Aperçu propriétaire (2026-08-30) : le bouton "Voir la carte" doit fonctionner même AVANT la
    // publication (signalé par l'utilisateur comme une erreur bloquante) — sans ça, impossible de
    // relire sa propre carte tant qu'on ne l'a pas rendue publique. `previewToken` est le jeton de
    // session Supabase du compte connecté (passé en query, pas en header : cette page publique
    // n'a pas de session côté client) ; on vérifie juste qu'il correspond bien au PROPRIÉTAIRE du
    // compte demandé (`userId`) avant de lever la restriction "publiée uniquement" — un vrai client
    // qui scanne un QR code n'a jamais ce jeton, donc reste toujours soumis au 404 normal.
    const previewToken = typeof req.query.previewToken === "string" ? req.query.previewToken : null;
    let isOwnerPreview = false;
    if (previewToken) {
      try {
        const { data: authData } = await supabaseAdmin.auth.getUser(previewToken);
        if (authData?.user?.id === userId) isOwnerPreview = true;
      } catch {
        // jeton invalide/expiré : retombe simplement sur le comportement public normal
      }
    }

    if (!menuSettings || (menuSettings.published !== true && !isOwnerPreview)) {
      return res.status(404).json({ error: "not_published" });
    }

    const recipes = recipesRaw ? JSON.parse(recipesRaw) : [];
    const included = recipes
      .filter((r) => r.menuIncluded === true)
      .map((r) => ({
        id: r.id,
        name: r.name || "",
        menuNameI18n: r.menuNameI18n && typeof r.menuNameI18n === "object" ? r.menuNameI18n : {},
        // [CHANGEMENT 2026-08-30] Le prix affiché sur la carte publique n'est plus synchronisé en
        // direct sur le prix de vente de la recette (`sellPrice`) — demandé explicitement par
        // l'utilisateur : tester un prix pour voir l'effet sur sa marge ne doit jamais le pousser
        // publiquement tout seul. `menuPrice` est le SNAPSHOT réellement affiché, mis à jour
        // uniquement via le bouton dédié (fiche recette, src/App.jsx) ou au moment où la recette
        // rejoint la carte pour la première fois. Repli sur `sellPrice` uniquement pour les
        // recettes déjà sur une carte AVANT ce changement (menuPrice pas encore renseigné) — pour
        // ne jamais faire disparaître un prix déjà publié.
        sellPrice: typeof r.menuPrice === "number" ? r.menuPrice : (typeof r.sellPrice === "number" ? r.sellPrice : 0),
        allergens: r.allergens || "",
        allergenCodes: Array.isArray(r.allergenCodes) ? r.allergenCodes : [],
        menuDescription: r.menuDescription && typeof r.menuDescription === "object" ? r.menuDescription : {},
        menuCategory: typeof r.menuCategory === "string" ? r.menuCategory : null,
      }));

    // Articles simples (2026-08-19, voir SimpleItemsSection côté client) : jamais des recettes,
    // mais transformés ici dans le MÊME format que les recettes déjà filtrées ci-dessus (allergènes
    // toujours vides — un article simple n'a pas d'ingrédients à analyser) — ainsi src/PublicMenu.jsx
    // n'a besoin d'aucune logique supplémentaire pour les afficher, juste les concaténer dans la
    // même liste. Toujours inclus (pas de case "menuIncluded" séparée) : leur seule raison d'exister
    // est d'être sur la carte. Le coût d'achat éventuel (`cost`) n'est jamais renvoyé — pas une
    // donnée publique. `menuDescription` renvoyée depuis 2026-08-30 (ajoutée côté UI le même jour,
    // voir SimpleItemRow) — jusqu'ici toujours vide en dur, un article simple ne pouvait avoir
    // aucune description sur la carte publique, signalé par l'utilisateur comme un vrai manque.
    const simpleItems = simpleItemsRaw ? JSON.parse(simpleItemsRaw) : [];
    const includedSimple = simpleItems
      .filter((it) => it && it.name)
      .map((it) => ({
        id: it.id,
        name: it.name || "",
        menuNameI18n: it.menuNameI18n && typeof it.menuNameI18n === "object" ? it.menuNameI18n : {},
        sellPrice: typeof it.sellPrice === "number" ? it.sellPrice : 0,
        allergens: "",
        allergenCodes: [],
        menuDescription: it.menuDescription && typeof it.menuDescription === "object" ? it.menuDescription : {},
        menuCategory: typeof it.menuCategory === "string" ? it.menuCategory : null,
      }));

    const validDesigns = ["classic", "modern", "elegant", "bistro"];
    // `name` est un objet {fr,es,en} depuis le 2026-08-18 (v3) — repli sur l'ancien format chaîne
    // (jamais écrit après ce changement, mais possible sur une carte publiée juste avant) pour ne
    // jamais faire disparaître une section déjà créée par un compte existant.
    const customCategories =
      Array.isArray(menuSettings.customCategories) && menuSettings.customCategories.length
        ? menuSettings.customCategories
            .filter((c) => c && typeof c.id === "string" && c.name)
            .map((c) => ({
              id: c.id,
              name: typeof c.name === "string" ? { fr: c.name, es: c.name, en: c.name } : c.name,
            }))
        : defaultMenuCategories();

    return res.status(200).json({
      restaurantName: menuSettings.restaurantName || "",
      design: validDesigns.includes(menuSettings.design) ? menuSettings.design : "classic",
      logo: typeof menuSettings.logo === "string" ? menuSettings.logo : null,
      accentColor: typeof menuSettings.accentColor === "string" ? menuSettings.accentColor : null,
      customCategories,
      recipes: [...included, ...includedSimple],
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
