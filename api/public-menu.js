// Lecture publique de la carte digitale (2026-08) — endpoint SANS authentification, appelé
// directement par les clients du restaurant qui scannent le QR code (voir src/PublicMenu.jsx).
// Contrairement aux autres endpoints admin de ce projet (protégés par ADMIN_SECRET), celui-ci est
// volontairement ouvert à tous : c'est le but (une carte de restaurant est publique par nature).
// La seule protection est donc le FILTRAGE des champs renvoyés : jamais de coût, de marge, de
// fournisseur, de note interne ni d'aucune donnée de compte — uniquement ce qu'un client de
// restaurant doit voir (nom du plat, description, prix de vente, allergènes). Et rien n'est
// renvoyé du tout tant que le restaurateur n'a pas explicitement activé `menuSettings.published`.
import { getSupabaseAdmin } from "./_lib.js";

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

    if (!menuSettings || menuSettings.published !== true) {
      return res.status(404).json({ error: "not_published" });
    }

    const recipes = recipesRaw ? JSON.parse(recipesRaw) : [];
    const included = recipes
      .filter((r) => r.menuIncluded === true)
      .map((r) => ({
        id: r.id,
        name: r.name || "",
        sellPrice: typeof r.sellPrice === "number" ? r.sellPrice : 0,
        allergens: r.allergens || "",
        allergenCodes: Array.isArray(r.allergenCodes) ? r.allergenCodes : [],
        menuDescription: r.menuDescription && typeof r.menuDescription === "object" ? r.menuDescription : {},
        menuCategory: typeof r.menuCategory === "string" ? r.menuCategory : null,
      }));

    // Articles simples (2026-08-19, voir SimpleItemsSection côté client) : jamais des recettes,
    // mais transformés ici dans le MÊME format que les recettes déjà filtrées ci-dessus (allergènes
    // et description toujours vides) — ainsi src/PublicMenu.jsx n'a besoin d'aucune logique
    // supplémentaire pour les afficher, juste les concaténer dans la même liste. Toujours inclus
    // (pas de case "menuIncluded" séparée) : leur seule raison d'exister est d'être sur la carte.
    // Le coût d'achat éventuel (`cost`) n'est jamais renvoyé — ce n'est pas une donnée publique.
    const simpleItems = simpleItemsRaw ? JSON.parse(simpleItemsRaw) : [];
    const includedSimple = simpleItems
      .filter((it) => it && it.name)
      .map((it) => ({
        id: it.id,
        name: it.name || "",
        sellPrice: typeof it.sellPrice === "number" ? it.sellPrice : 0,
        allergens: "",
        allergenCodes: [],
        menuDescription: {},
        menuCategory: typeof it.menuCategory === "string" ? it.menuCategory : null,
      }));

    const validDesigns = ["classic", "modern", "elegant", "bistro"];
    // `name` est un objet {fr,es,en} depuis le 2026-08-18 (v3) — repli sur l'ancien format chaîne
    // (jamais écrit après ce changement, mais possible sur une carte publiée juste avant) pour ne
    // jamais faire disparaître une section déjà créée par un compte existant.
    const customCategories = Array.isArray(menuSettings.customCategories)
      ? menuSettings.customCategories
          .filter((c) => c && typeof c.id === "string" && c.name)
          .map((c) => ({
            id: c.id,
            name: typeof c.name === "string" ? { fr: c.name, es: c.name, en: c.name } : c.name,
          }))
      : [];

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
