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
      .in("key", ["menuSettings", "recipes"]);
    if (error) throw error;

    const menuSettingsRaw = (data || []).find((r) => r.key === "menuSettings")?.value;
    const recipesRaw = (data || []).find((r) => r.key === "recipes")?.value;
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
      }));

    return res.status(200).json({
      restaurantName: menuSettings.restaurantName || "",
      design: menuSettings.design === "modern" ? "modern" : "classic",
      recipes: included,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
