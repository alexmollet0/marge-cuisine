import React, { useState, useEffect, useCallback, useRef } from "react";
import { storage } from "./storage.js";
import {
  Plus,
  Trash2,
  ChefHat,
  AlertTriangle,
  Check,
  Copy,
  Printer,
  LayoutGrid,
  Receipt,
  History,
  Settings as SettingsIcon,
  Search,
  ChevronDown,
  ChevronUp,
  Camera,
  X,
  Loader2,
  TrendingUp,
} from "lucide-react";

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);

const CRITICAL_MARGIN = 70;

const CATEGORIES = [
  { id: "viandes", fr: "Viandes", es: "Carnes" },
  { id: "poissons", fr: "Poissons & fruits de mer", es: "Pescados y mariscos" },
  { id: "legumes", fr: "Légumes", es: "Verduras" },
  { id: "fruits", fr: "Fruits", es: "Frutas" },
  { id: "cremerie", fr: "Crémerie", es: "Lácteos" },
  { id: "epicerie", fr: "Épicerie", es: "Despensa" },
  { id: "epices", fr: "Épices & herbes", es: "Especias y hierbas" },
  { id: "boissons", fr: "Boissons & alcools", es: "Bebidas y licores" },
  { id: "autres", fr: "Autres", es: "Otros" },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const CATALOG = [
  // Viandes
  { id: "boeuf", fr: "Bœuf (paleron / gîte)", es: "Ternera (paletilla)", unit: "kg", cat: "viandes" },
  { id: "poulet", fr: "Poulet entier", es: "Pollo entero", unit: "kg", cat: "viandes" },
  { id: "porc", fr: "Échine de porc", es: "Lomo de cerdo", unit: "kg", cat: "viandes" },
  { id: "agneau", fr: "Gigot d'agneau", es: "Pierna de cordero", unit: "kg", cat: "viandes" },
  { id: "dinde", fr: "Escalope de dinde", es: "Escalope de pavo", unit: "kg", cat: "viandes" },
  { id: "canard", fr: "Magret de canard", es: "Magret de pato", unit: "kg", cat: "viandes" },
  { id: "chorizo", fr: "Chorizo", es: "Chorizo", unit: "kg", cat: "viandes" },
  { id: "jambon_cru", fr: "Jambon cru", es: "Jamón serrano", unit: "kg", cat: "viandes" },
  { id: "jambon_blanc", fr: "Jambon blanc", es: "Jamón cocido", unit: "kg", cat: "viandes" },
  // Poissons & fruits de mer
  { id: "saumon", fr: "Pavé de saumon", es: "Lomo de salmón", unit: "kg", cat: "poissons" },
  { id: "cabillaud", fr: "Dos de cabillaud", es: "Lomo de bacalao", unit: "kg", cat: "poissons" },
  { id: "crevettes", fr: "Crevettes", es: "Gambas", unit: "kg", cat: "poissons" },
  { id: "thon", fr: "Thon rouge", es: "Atún rojo", unit: "kg", cat: "poissons" },
  { id: "bar", fr: "Filet de bar", es: "Filete de lubina", unit: "kg", cat: "poissons" },
  { id: "dorade", fr: "Dorade", es: "Dorada", unit: "kg", cat: "poissons" },
  { id: "moules", fr: "Moules", es: "Mejillones", unit: "kg", cat: "poissons" },
  { id: "poulpe", fr: "Poulpe", es: "Pulpo", unit: "kg", cat: "poissons" },
  { id: "anchois", fr: "Anchois", es: "Anchoas", unit: "kg", cat: "poissons" },
  // Légumes
  { id: "carottes", fr: "Carottes", es: "Zanahorias", unit: "kg", cat: "legumes" },
  { id: "oignons", fr: "Oignons", es: "Cebollas", unit: "kg", cat: "legumes" },
  { id: "ail", fr: "Ail", es: "Ajo", unit: "kg", cat: "legumes" },
  { id: "pommes_de_terre", fr: "Pommes de terre", es: "Patatas", unit: "kg", cat: "legumes" },
  { id: "tomates", fr: "Tomates", es: "Tomates", unit: "kg", cat: "legumes" },
  { id: "courgettes", fr: "Courgettes", es: "Calabacines", unit: "kg", cat: "legumes" },
  { id: "aubergines", fr: "Aubergines", es: "Berenjenas", unit: "kg", cat: "legumes" },
  { id: "poivrons", fr: "Poivrons rouges", es: "Pimientos rojos", unit: "kg", cat: "legumes" },
  { id: "champignons", fr: "Champignons de Paris", es: "Champiñones", unit: "kg", cat: "legumes" },
  { id: "salade", fr: "Salade / Laitue", es: "Lechuga", unit: "U", cat: "legumes" },
  { id: "poireaux", fr: "Poireaux", es: "Puerros", unit: "kg", cat: "legumes" },
  { id: "epinards", fr: "Épinards", es: "Espinacas", unit: "kg", cat: "legumes" },
  { id: "brocoli", fr: "Brocoli", es: "Brócoli", unit: "kg", cat: "legumes" },
  { id: "haricots_verts", fr: "Haricots verts", es: "Judías verdes", unit: "kg", cat: "legumes" },
  { id: "petits_pois", fr: "Petits pois", es: "Guisantes", unit: "kg", cat: "legumes" },
  { id: "concombre", fr: "Concombre", es: "Pepino", unit: "U", cat: "legumes" },
  { id: "echalote", fr: "Échalote", es: "Chalota", unit: "kg", cat: "legumes" },
  { id: "celeri", fr: "Céleri", es: "Apio", unit: "kg", cat: "legumes" },
  // Fruits
  { id: "citron", fr: "Citron", es: "Limón", unit: "U", cat: "fruits" },
  { id: "citron_vert", fr: "Citron vert", es: "Lima", unit: "U", cat: "fruits" },
  { id: "pomme", fr: "Pomme", es: "Manzana", unit: "kg", cat: "fruits" },
  { id: "orange", fr: "Orange", es: "Naranja", unit: "kg", cat: "fruits" },
  { id: "banane", fr: "Banane", es: "Plátano", unit: "kg", cat: "fruits" },
  { id: "fraise", fr: "Fraise", es: "Fresa", unit: "kg", cat: "fruits" },
  { id: "avocat", fr: "Avocat", es: "Aguacate", unit: "U", cat: "fruits" },
  // Crémerie
  { id: "beurre", fr: "Beurre doux", es: "Mantequilla", unit: "kg", cat: "cremerie" },
  { id: "creme", fr: "Crème liquide 30%", es: "Nata líquida 30%", unit: "L", cat: "cremerie" },
  { id: "creme_fraiche", fr: "Crème fraîche", es: "Nata fresca", unit: "L", cat: "cremerie" },
  { id: "lait", fr: "Lait entier", es: "Leche entera", unit: "L", cat: "cremerie" },
  { id: "fromage_rape", fr: "Fromage râpé", es: "Queso rallado", unit: "kg", cat: "cremerie" },
  { id: "mozzarella", fr: "Mozzarella", es: "Mozzarella", unit: "kg", cat: "cremerie" },
  { id: "yaourt", fr: "Yaourt nature", es: "Yogur natural", unit: "U", cat: "cremerie" },
  { id: "mascarpone", fr: "Mascarpone", es: "Mascarpone", unit: "kg", cat: "cremerie" },
  { id: "chevre", fr: "Fromage de chèvre", es: "Queso de cabra", unit: "kg", cat: "cremerie" },
  { id: "parmesan", fr: "Parmesan", es: "Parmesano", unit: "kg", cat: "cremerie" },
  { id: "oeufs", fr: "Œufs", es: "Huevos", unit: "U", cat: "cremerie" },
  // Épicerie
  { id: "farine", fr: "Farine T55", es: "Harina de trigo", unit: "kg", cat: "epicerie" },
  { id: "sucre", fr: "Sucre en poudre", es: "Azúcar", unit: "kg", cat: "epicerie" },
  { id: "sel", fr: "Sel fin", es: "Sal fina", unit: "kg", cat: "epicerie" },
  { id: "poivre", fr: "Poivre noir", es: "Pimienta negra", unit: "kg", cat: "epicerie" },
  { id: "riz", fr: "Riz Basmati", es: "Arroz Basmati", unit: "kg", cat: "epicerie" },
  { id: "pates", fr: "Pâtes Penne", es: "Pasta Penne", unit: "kg", cat: "epicerie" },
  { id: "huile_olive", fr: "Huile d'olive", es: "Aceite de oliva", unit: "L", cat: "epicerie" },
  { id: "huile_tournesol", fr: "Huile de tournesol", es: "Aceite de girasol", unit: "L", cat: "epicerie" },
  { id: "huile_sesame", fr: "Huile de sésame", es: "Aceite de sésamo", unit: "L", cat: "epicerie" },
  { id: "moutarde", fr: "Moutarde", es: "Mostaza", unit: "kg", cat: "epicerie" },
  { id: "sauce_soja", fr: "Sauce soja", es: "Salsa de soja", unit: "L", cat: "epicerie" },
  { id: "vinaigre_balsamique", fr: "Vinaigre balsamique", es: "Vinagre balsámico", unit: "L", cat: "epicerie" },
  { id: "vinaigre_vin", fr: "Vinaigre de vin", es: "Vinagre de vino", unit: "L", cat: "epicerie" },
  { id: "ketchup", fr: "Ketchup", es: "Kétchup", unit: "kg", cat: "epicerie" },
  { id: "mayonnaise", fr: "Mayonnaise", es: "Mayonesa", unit: "kg", cat: "epicerie" },
  { id: "miel", fr: "Miel", es: "Miel", unit: "kg", cat: "epicerie" },
  { id: "maizena", fr: "Maïzena", es: "Maicena", unit: "kg", cat: "epicerie" },
  { id: "quinoa", fr: "Quinoa", es: "Quinoa", unit: "kg", cat: "epicerie" },
  { id: "couscous", fr: "Semoule / Couscous", es: "Cuscús", unit: "kg", cat: "epicerie" },
  { id: "amandes", fr: "Amandes", es: "Almendras", unit: "kg", cat: "epicerie" },
  { id: "noisettes", fr: "Noisettes", es: "Avellanas", unit: "kg", cat: "epicerie" },
  { id: "chocolat_noir", fr: "Chocolat noir", es: "Chocolate negro", unit: "kg", cat: "epicerie" },
  // Épices & herbes
  { id: "paprika", fr: "Paprika", es: "Pimentón", unit: "kg", cat: "epices" },
  { id: "cumin", fr: "Cumin", es: "Comino", unit: "kg", cat: "epices" },
  { id: "curry", fr: "Curry", es: "Curry", unit: "kg", cat: "epices" },
  { id: "cannelle", fr: "Cannelle", es: "Canela", unit: "kg", cat: "epices" },
  { id: "thym", fr: "Thym", es: "Tomillo", unit: "kg", cat: "epices" },
  { id: "laurier", fr: "Laurier", es: "Laurel", unit: "kg", cat: "epices" },
  { id: "basilic", fr: "Basilic frais", es: "Albahaca fresca", unit: "kg", cat: "epices" },
  { id: "persil", fr: "Persil frais", es: "Perejil fresco", unit: "kg", cat: "epices" },
  { id: "muscade", fr: "Noix de muscade", es: "Nuez moscada", unit: "kg", cat: "epices" },
  { id: "piment_espelette", fr: "Piment d'Espelette", es: "Guindilla", unit: "kg", cat: "epices" },
  // Boissons & alcools de cuisine
  { id: "vin_rouge", fr: "Vin rouge de cuisine", es: "Vino tinto de cocina", unit: "L", cat: "boissons" },
  { id: "vin_blanc", fr: "Vin blanc de cuisine", es: "Vino blanco de cocina", unit: "L", cat: "boissons" },
  { id: "biere", fr: "Bière", es: "Cerveza", unit: "L", cat: "boissons" },
  { id: "porto", fr: "Porto", es: "Oporto", unit: "L", cat: "boissons" },
  { id: "jerez", fr: "Xérès / Jerez", es: "Jerez", unit: "L", cat: "boissons" },
  { id: "rhum", fr: "Rhum", es: "Ron", unit: "L", cat: "boissons" },
  { id: "cognac", fr: "Cognac", es: "Coñac", unit: "L", cat: "boissons" },
];
const CATALOG_MAP = Object.fromEntries(CATALOG.map((c) => [c.id, c]));
const normUnit = (u) => (u === "U" ? "pièce" : u);

const ALLERGEN_LABELS = {
  gluten: { fr: "Gluten", es: "Gluten" },
  lait: { fr: "Lait / Lactose", es: "Lácteos" },
  oeufs: { fr: "Œufs", es: "Huevo" },
  sulfites: { fr: "Sulfites", es: "Sulfitos" },
  poisson: { fr: "Poisson", es: "Pescado" },
  crustaces: { fr: "Crustacés", es: "Crustáceos" },
  mollusques: { fr: "Mollusques", es: "Moluscos" },
  moutarde: { fr: "Moutarde", es: "Mostaza" },
  soja: { fr: "Soja", es: "Soja" },
  celeri: { fr: "Céleri", es: "Apio" },
  fruits_a_coque: { fr: "Fruits à coque", es: "Frutos secos" },
};

const ALLERGEN_MAP = {
  farine: ["gluten"], pates: ["gluten"], couscous: ["gluten"],
  beurre: ["lait"], creme: ["lait"], creme_fraiche: ["lait"], lait: ["lait"],
  fromage_rape: ["lait"], mozzarella: ["lait"], yaourt: ["lait"], mascarpone: ["lait"], chevre: ["lait"], parmesan: ["lait"],
  oeufs: ["oeufs"],
  vin_rouge: ["sulfites"], vin_blanc: ["sulfites"], porto: ["sulfites"], jerez: ["sulfites"],
  crevettes: ["crustaces"],
  saumon: ["poisson"], cabillaud: ["poisson"], thon: ["poisson"], bar: ["poisson"], dorade: ["poisson"], anchois: ["poisson"],
  moules: ["mollusques"], poulpe: ["mollusques"],
  moutarde: ["moutarde"],
  sauce_soja: ["soja"],
  celeri: ["celeri"],
  amandes: ["fruits_a_coque"], noisettes: ["fruits_a_coque"],
};

function detectAllergens(lines, ingredientsList, lang) {
  const set = new Set();
  lines.forEach((l) => {
    const ing = ingredientsList.find((i) => i.id === l.ingredientId);
    if (ing?.catalogId && ALLERGEN_MAP[ing.catalogId]) ALLERGEN_MAP[ing.catalogId].forEach((a) => set.add(a));
  });
  return Array.from(set).map((a) => ALLERGEN_LABELS[a][lang]).join(", ");
}

const TR = {
  fr: {
    appTitle: "Marge en cuisine", saved: "Enregistré", loading: "Chargement…",
    dataUnavailable: "Données locales indisponibles", resetData: "Réinitialiser mes données",
    pantry: "Garde-manger", newIngredient: "Nouvel ingrédient", addIngredient: "Ajouter un ingrédient",
    searchPlaceholder: "Rechercher un ingrédient…", pantryFilterPlaceholder: "Filtrer le garde-manger…",
    allCategories: "Tous", createCustom: (q) => `Créer "${q}"`, noMatch: "Aucun résultat dans le catalogue",
    noFilterMatch: "Aucun ingrédient ne correspond.",
    supplier: "fournisseur", newSupplier: "Nouveau fournisseur",
    recipes: "Recettes", newRecipe: "Nouvelle recette", newRecipeName: "Nouvelle recette",
    ticket: "Ticket", overview: "Vue d'ensemble", recipeCol: "Recette", costPortionCol: "Coût/portion",
    sellPriceCol: "Prix vente TTC", marginCol: "Marge", noRecipes: "Aucune recette pour l'instant.",
    overviewHint: "Touche une ligne pour ouvrir le ticket. Couleur = distance à ta marge cible.",
    noRecipeYet: "Aucune recette. Crée-en une pour commencer.",
    duplicate: "Dupliquer", print: "Imprimer / PDF", portions: "Portions", line: "ligne",
    total: "Coût total", costPerPortion: "Coût / portion", sellPriceTTC: "Prix de vente (TTC)",
    sellPriceHT: "Prix HT", vat: "TVA", targetMargin: "Marge cible", suggestedPrice: "Prix conseillé (TTC)",
    use: "Utiliser", marginLabel: "marge", lowMarginWarning: `En dessous de ${CRITICAL_MARGIN}%, à surveiller`,
    marginExcellentTitle: "Marge excellente", marginExcellentDetail: "Déjà au-dessus de ton objectif, aucun ajustement de prix nécessaire.",
    simulateHigherMargin: (v) => `Simuler ${v}%`,
    excellentMarginBadge: "Rentabilité optimale",
    notes: "Notes / Instructions", notesPlaceholder: "Ex : Faire mariner la viande, mijoter 3h, dresser avec persil…",
    allergens: "Allergènes", allergensPlaceholder: "ex : gluten, lait, céleri…",
    allergensAutoBadge: "détecté auto", allergensReset: "Revenir à la détection auto",
    createdOn: "Créé le", settings: "Paramètres", defaultVat: "TVA par défaut",
    minMarginLabel: "Marge minimale souhaitée", close: "Fermer",
    scanInvoice: "Scanner une facture", scanning: "Analyse de la facture en cours…",
    scanError: "Erreur pendant l'analyse", scanRetry: "Réessayer",
    scanResultTitle: "Résultat du scan", scanSupplier: "Fournisseur",
    scanDate: "Date", scanAssignTo: "Associer à", scanNewIngredient: "🆕 Nouvel ingrédient",
    scanImport: "Importer", scanImported: "Importé ✓", scanImportAll: "Tout importer",
    scanPriceIncrease: "Prix en hausse", scanNoItems: "Aucun article détecté.",
    scanHint: "Vérifie et corrige chaque ligne avant d'importer — l'IA peut se tromper.",
  },
  es: {
    appTitle: "Margen en cocina", saved: "Guardado", loading: "Cargando…",
    dataUnavailable: "Datos locales no disponibles", resetData: "Restablecer mis datos",
    pantry: "Despensa", newIngredient: "Nuevo ingrediente", addIngredient: "Añadir ingrediente",
    searchPlaceholder: "Buscar un ingrediente…", pantryFilterPlaceholder: "Filtrar la despensa…",
    allCategories: "Todos", createCustom: (q) => `Crear "${q}"`, noMatch: "Sin resultados en el catálogo",
    noFilterMatch: "Ningún ingrediente coincide.",
    supplier: "proveedor", newSupplier: "Nuevo proveedor",
    recipes: "Recetas", newRecipe: "Nueva receta", newRecipeName: "Nueva receta",
    ticket: "Ticket", overview: "Resumen", recipeCol: "Receta", costPortionCol: "Coste/ración",
    sellPriceCol: "Precio venta IVA inc.", marginCol: "Margen", noRecipes: "Todavía no hay recetas.",
    overviewHint: "Toca una fila para abrir el ticket. Color = distancia a tu margen objetivo.",
    noRecipeYet: "No hay recetas. Crea una para empezar.",
    duplicate: "Duplicar", print: "Imprimir / PDF", portions: "Raciones", line: "línea",
    total: "Coste total", costPerPortion: "Coste / ración", sellPriceTTC: "Precio de venta (IVA inc.)",
    sellPriceHT: "Precio sin IVA", vat: "IVA", targetMargin: "Margen objetivo", suggestedPrice: "Precio sugerido (IVA inc.)",
    use: "Usar", marginLabel: "margen", lowMarginWarning: `Por debajo del ${CRITICAL_MARGIN}%, vigilar`,
    marginExcellentTitle: "Margen excelente", marginExcellentDetail: "Ya por encima de tu objetivo, sin necesidad de ajustar el precio.",
    simulateHigherMargin: (v) => `Simular ${v}%`,
    excellentMarginBadge: "Rentabilidad óptima",
    notes: "Notas / Instrucciones", notesPlaceholder: "Ej : Marinar la carne, cocinar a fuego lento 3h, emplatar con perejil…",
    allergens: "Alérgenos", allergensPlaceholder: "ej: gluten, lácteos, apio…",
    allergensAutoBadge: "detectado auto", allergensReset: "Volver a la detección automática",
    createdOn: "Creado el", settings: "Ajustes", defaultVat: "IVA por defecto",
    minMarginLabel: "Margen mínimo deseado", close: "Cerrar",
    scanInvoice: "Escanear una factura", scanning: "Analizando la factura…",
    scanError: "Error durante el análisis", scanRetry: "Reintentar",
    scanResultTitle: "Resultado del escaneo", scanSupplier: "Proveedor",
    scanDate: "Fecha", scanAssignTo: "Asociar a", scanNewIngredient: "🆕 Nuevo ingrediente",
    scanImport: "Importar", scanImported: "Importado ✓", scanImportAll: "Importar todo",
    scanPriceIncrease: "Precio en alza", scanNoItems: "No se detectó ningún artículo.",
    scanHint: "Revisa y corrige cada línea antes de importar — la IA puede equivocarse.",
  },
};

const SEED_INGREDIENTS = [
  { id: "i1", name: "Bœuf (paleron / gîte)", unit: "kg", catalogId: "boeuf", category: "viandes",
    selectedSupplierId: "s1", suppliers: [{ id: "s1", name: "Métro", price: 14.5 }],
    history: [{ date: "2026-05-02", price: 13.9, supplierName: "Métro" }] },
  { id: "i2", name: "Carottes", unit: "kg", catalogId: "carottes", category: "legumes",
    selectedSupplierId: "s2", suppliers: [{ id: "s2", name: "Grossiste local", price: 1.2 }], history: [] },
  { id: "i3", name: "Oignons", unit: "kg", catalogId: "oignons", category: "legumes",
    selectedSupplierId: "s3", suppliers: [{ id: "s3", name: "Grossiste local", price: 1.1 }], history: [] },
  { id: "i4", name: "Vin rouge de cuisine", unit: "L", catalogId: "vin_rouge", category: "boissons",
    selectedSupplierId: "s4", suppliers: [{ id: "s4", name: "Cavavin Pro", price: 4.5 }], history: [] },
  { id: "i5", name: "Lardons", unit: "kg", catalogId: null, category: "viandes",
    selectedSupplierId: "s5", suppliers: [{ id: "s5", name: "Métro", price: 9.8 }], history: [] },
  { id: "i6", name: "Champignons de Paris", unit: "kg", catalogId: "champignons", category: "legumes",
    selectedSupplierId: "s6", suppliers: [{ id: "s6", name: "Grossiste local", price: 5.2 }], history: [] },
  { id: "i7", name: "Beurre doux", unit: "kg", catalogId: "beurre", category: "cremerie",
    selectedSupplierId: "s7",
    suppliers: [{ id: "s7", name: "Métro", price: 7.5 }, { id: "s7b", name: "Transgourmet", price: 7.1 }],
    history: [] },
];

const SEED_RECIPES = [
  {
    id: "r1", name: "Boeuf bourguignon", portions: 6, sellPrice: 18, targetMargin: 75,
    notes: "Faire mariner le boeuf 12h dans le vin. Mijoter 3h à feu doux. Dresser avec persil frais.",
    allergens: "Sulfites (vin)", allergensAuto: false, createdAt: "2026-06-10",
    lines: [
      { ingredientId: "i1", qty: 1.2 }, { ingredientId: "i2", qty: 0.4 }, { ingredientId: "i3", qty: 0.3 },
      { ingredientId: "i4", qty: 0.75 }, { ingredientId: "i5", qty: 0.15 }, { ingredientId: "i6", qty: 0.25 },
      { ingredientId: "i7", qty: 0.05 },
    ],
  },
];

const DEFAULT_SETTINGS = { vat: 10, minMargin: 75 };

function useDebouncedSave(key, value, ready) {
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(async () => {
      try { await storage.set(key, JSON.stringify(value)); } catch (e) { console.error("save failed", key, e); }
    }, 500);
    return () => clearTimeout(t);
  }, [key, value, ready]);
}

function activeSupplier(ing) {
  if (!ing || !ing.suppliers || !ing.suppliers.length) return null;
  return ing.suppliers.find((s) => s.id === ing.selectedSupplierId) || ing.suppliers[0];
}

function NumField({ value, onChange, className, allowDecimal = true, ...rest }) {
  const [local, setLocal] = useState(value === 0 || value === undefined || value === null ? "" : String(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setLocal(value === 0 || value === undefined || value === null ? "" : String(value));
  }, [value]);

  const handleChange = (e) => {
    let v = e.target.value.replace(",", ".");
    v = allowDecimal ? v.replace(/[^0-9.]/g, "") : v.replace(/[^0-9]/g, "");
    if (allowDecimal) {
      const firstDot = v.indexOf(".");
      if (firstDot !== -1) v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    }
    if (/^0[0-9]/.test(v)) v = v.replace(/^0+/, "");
    setLocal(v);
    const num = v === "" || v === "." ? 0 : parseFloat(v);
    onChange(isNaN(num) ? 0 : num);
  };

  return (
    <input
      type="text" inputMode="decimal" value={local} onChange={handleChange}
      onFocus={(e) => { focusedRef.current = true; e.target.select(); }}
      onBlur={() => { focusedRef.current = false; setLocal(value === 0 || !value ? "" : String(value)); }}
      className={className} {...rest}
    />
  );
}

const TIER_COLORS = { low: "#B23A2E", mid: "#C97A1E", high: "#3F8F52" };
function marginTier(m, minMargin) {
  if (m === null || m === undefined) return null;
  if (m < CRITICAL_MARGIN) return "low";
  const target = Math.max(minMargin ?? 75, CRITICAL_MARGIN);
  if (m < target) return "mid";
  return "high";
}

export default function App() {
  const [ingredients, setIngredients] = useState(SEED_INGREDIENTS);
  const [recipes, setRecipes] = useState(SEED_RECIPES);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeId, setActiveId] = useState("r1");
  const [view, setView] = useState("ticket");
  const [lang, setLang] = useState("fr");
  const [showSettings, setShowSettings] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);

  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [pantryOpen, setPantryOpen] = useState(false);
  const [pantryQuery, setPantryQuery] = useState("");
  const [pantryCategory, setPantryCategory] = useState("all");

  const [scanOpen, setScanOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState(null);
  const [scanResult, setScanResult] = useState(null); // { supplier, date, items: [...] }
  const fileInputRef = useRef(null);


  const t = useCallback((key) => TR[lang][key] ?? TR.fr[key] ?? key, [lang]);
  const ingredientDisplayName = useCallback(
    (ing) => (ing?.catalogId && CATALOG_MAP[ing.catalogId] ? CATALOG_MAP[ing.catalogId][lang] : ing?.name || ""),
    [lang]
  );

  useEffect(() => {
    (async () => {
      try {
        let ing = null, rec = null, set = null, lg = null;
        try { const r = await storage.get("ingredients"); ing = r ? JSON.parse(r.value) : null; } catch (e) {}
        try { const r = await storage.get("recipes"); rec = r ? JSON.parse(r.value) : null; } catch (e) {}
        try { const r = await storage.get("settings"); set = r ? JSON.parse(r.value) : null; } catch (e) {}
        try { const r = await storage.get("lang"); lg = r ? JSON.parse(r.value) : null; } catch (e) {}
        if (ing && ing.length) setIngredients(ing);
        if (rec && rec.length) { setRecipes(rec); setActiveId(rec[0].id); }
        if (set) setSettings({ ...DEFAULT_SETTINGS, ...set });
        if (lg) setLang(lg);
      } catch (e) {
        setLoadErr(true);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useDebouncedSave("ingredients", ingredients, ready);
  useDebouncedSave("recipes", recipes, ready);
  useDebouncedSave("settings", settings, ready);
  useDebouncedSave("lang", lang, ready);

  useEffect(() => {
    if (!ready) return;
    setRecipes((rs) => rs.map((r) => {
      if (r.allergensAuto === false) return r;
      const computed = detectAllergens(r.lines, ingredients, lang);
      return computed === r.allergens ? r : { ...r, allergens: computed };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, ready]);

  useEffect(() => {
    if (!ready) return;
    setSavedPulse(true);
    const t2 = setTimeout(() => setSavedPulse(false), 900);
    return () => clearTimeout(t2);
  }, [ingredients, recipes, settings, ready]);

  const active = recipes.find((r) => r.id === activeId) || recipes[0];
  const ingredientById = useCallback((id) => ingredients.find((i) => i.id === id), [ingredients]);

  const lineCost = (line) => {
    const ing = ingredientById(line.ingredientId);
    const sup = activeSupplier(ing);
    return sup ? sup.price * line.qty : 0;
  };

  const recipeCost = (r) => r.lines.reduce((s, l) => s + lineCost(l), 0);
  const recipeCostPerPortion = (r) => (r.portions > 0 ? recipeCost(r) / r.portions : 0);
  const vatRate = settings.vat ?? 10;
  const priceHT = (ttc) => ttc / (1 + vatRate / 100);
  const recipeMargin = (r) => {
    const cpp = recipeCostPerPortion(r);
    const ht = priceHT(r.sellPrice || 0);
    return ht > 0 ? ((ht - cpp) / ht) * 100 : null;
  };

  const totalCost = active ? recipeCost(active) : 0;
  const costPerPortion = active ? recipeCostPerPortion(active) : 0;
  const sellHT = active ? priceHT(active.sellPrice || 0) : 0;
  const margin = active ? recipeMargin(active) : null;
  const targetMargin = active?.targetMargin ?? 75;
  const suggestedHT = active && targetMargin < 100 ? costPerPortion / (1 - targetMargin / 100) : null;
  const suggestedTTC = suggestedHT !== null ? suggestedHT * (1 + vatRate / 100) : null;
  // Règle : on ne propose un prix conseillé que si la marge actuelle n'atteint pas encore l'objectif.
  // Si l'objectif est déjà atteint ou dépassé, on ne suggère jamais un prix plus bas.
  const isBelowTarget = margin !== null && margin < targetMargin;
  const isAtOrAboveTarget = margin !== null && margin >= targetMargin;
  const nextMarginStep = margin !== null ? Math.min(99, Math.ceil((margin + 5) / 5) * 5) : null;

  const updateRecipe = (patch) => setRecipes((rs) => rs.map((r) => (r.id === active.id ? { ...r, ...patch } : r)));
  const applyLinesChange = (newLines) => {
    const patch = { lines: newLines };
    if (active.allergensAuto !== false) patch.allergens = detectAllergens(newLines, ingredients, lang);
    updateRecipe(patch);
  };
  const updateLineQty = (idx, qty) => updateRecipe({ lines: active.lines.map((l, i) => (i === idx ? { ...l, qty } : l)) });
  const removeLine = (idx) => applyLinesChange(active.lines.filter((_, i) => i !== idx));
  const addLine = () => {
    if (!ingredients.length) return;
    applyLinesChange([...active.lines, { ingredientId: ingredients[0].id, qty: 0.1 }]);
  };
  const changeLineIngredient = (idx, ingredientId) =>
    applyLinesChange(active.lines.map((l, i) => (i === idx ? { ...l, ingredientId } : l)));
  const resetAllergensAuto = () => {
    if (!active) return;
    updateRecipe({ allergens: detectAllergens(active.lines, ingredients, lang), allergensAuto: true });
  };

  const addRecipe = () => {
    const nr = {
      id: uid(), name: t("newRecipeName"), portions: 4, sellPrice: 0, targetMargin: 75,
      notes: "", allergens: "", allergensAuto: true, createdAt: today(), lines: [],
    };
    setRecipes((rs) => [...rs, nr]);
    setActiveId(nr.id);
    setView("ticket");
  };

  const duplicateRecipe = (r) => {
    const copy = { ...r, id: uid(), name: r.name + " (copie)", createdAt: today(), lines: r.lines.map((l) => ({ ...l })) };
    setRecipes((rs) => [...rs, copy]);
    setActiveId(copy.id);
    setView("ticket");
  };

  const deleteRecipe = (id) => {
    setRecipes((rs) => rs.filter((r) => r.id !== id));
    if (activeId === id) {
      const rest = recipes.filter((r) => r.id !== id);
      if (rest.length) setActiveId(rest[0].id);
    }
  };

  const updateIngredientField = (id, field, value) =>
    setIngredients((ings) => ings.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  const updateIngredientName = (id, value) =>
    setIngredients((ings) => ings.map((i) => (i.id === id ? { ...i, name: value, catalogId: null } : i)));

  const addIngredientFromCatalog = (c) => {
    const sId = uid();
    const ni = {
      id: uid(), name: c[lang], unit: normUnit(c.unit), catalogId: c.id, category: c.cat,
      selectedSupplierId: sId, suppliers: [{ id: sId, name: t("supplier"), price: 1 }], history: [],
    };
    setIngredients((ings) => [...ings, ni]);
    setAdding(false);
    setQuery("");
  };

  const addCustomIngredient = (name) => {
    const sId = uid();
    const ni = {
      id: uid(), name: name || t("newIngredient"), unit: "kg", catalogId: null, category: "autres",
      selectedSupplierId: sId, suppliers: [{ id: sId, name: t("supplier"), price: 1 }], history: [],
    };
    setIngredients((ings) => [...ings, ni]);
    setAdding(false);
    setQuery("");
  };

  const deleteIngredient = (id) => setIngredients((ings) => ings.filter((i) => i.id !== id));
  const addSupplier = (ingId) => {
    setIngredients((ings) => ings.map((i) => {
      if (i.id !== ingId) return i;
      const ns = { id: uid(), name: t("newSupplier"), price: activeSupplier(i)?.price || 1 };
      return { ...i, suppliers: [...i.suppliers, ns] };
    }));
  };
  const updateSupplier = (ingId, supId, field, value) => {
    setIngredients((ings) => ings.map((i) => {
      if (i.id !== ingId) return i;
      let historyPatch = i.history || [];
      const suppliers = i.suppliers.map((s) => {
        if (s.id !== supId) return s;
        if (field === "price" && value !== s.price) historyPatch = [...historyPatch, { date: today(), price: value, supplierName: s.name }].slice(-15);
        return { ...s, [field]: value };
      });
      return { ...i, suppliers, history: historyPatch };
    }));
  };
  const removeSupplier = (ingId, supId) => {
    setIngredients((ings) => ings.map((i) => {
      if (i.id !== ingId) return i;
      const suppliers = i.suppliers.filter((s) => s.id !== supId);
      const selectedSupplierId = i.selectedSupplierId === supId ? suppliers[0]?.id : i.selectedSupplierId;
      return { ...i, suppliers, selectedSupplierId };
    }));
  };
  const selectSupplier = (ingId, supId) => updateIngredientField(ingId, "selectedSupplierId", supId);

  const clearAll = async () => {
    if (!window.confirm("Effacer toutes tes données ? Cette action est irréversible.")) return;
    setIngredients([]); setRecipes([]); setActiveId(null);
    try { await storage.delete("ingredients"); await storage.delete("recipes"); } catch (e) {}
  };

  const handlePrint = () => window.print();

  // --- Scan de facture ---

  const normalizeStr = (s) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const guessIngredientId = (name) => {
    const n = normalizeStr(name);
    if (!n) return null;
    const exact = ingredients.find((i) => normalizeStr(ingredientDisplayName(i)) === n);
    if (exact) return exact.id;
    const partial = ingredients.find(
      (i) => n.includes(normalizeStr(ingredientDisplayName(i))) || normalizeStr(ingredientDisplayName(i)).includes(n)
    );
    return partial ? partial.id : null;
  };

  const compressImageFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Image illisible"));
        img.onload = () => {
          const maxDim = 1400;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
          resolve({ base64: dataUrl.split(",")[1], mediaType: "image/jpeg" });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

  const handleScanFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier plus tard
    if (!file) return;
    setScanOpen(true);
    setScanning(true);
    setScanErr(null);
    setScanResult(null);
    try {
      const { base64, mediaType } = await compressImageFile(file);
      const res = await fetch("/api/scan-invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.detail ? `${data.error} (${data.detail})` : data.error || "Échec de l'analyse";
        throw new Error(msg);
      }
      const items = (data.items || []).map((it) => {
        const matchedId = guessIngredientId(it.name);
        const matchedIng = matchedId ? ingredientById(matchedId) : null;
        const currentPrice = matchedIng ? activeSupplier(matchedIng)?.price ?? null : null;
        return {
          ...it,
          assignTo: matchedId || "new",
          imported: false,
          currentPrice,
          priceUp: currentPrice !== null && it.unitPriceHT > currentPrice,
        };
      });
      setScanResult({ supplier: data.supplier || null, date: data.date || null, items });
    } catch (err) {
      setScanErr(err.message || "Erreur inconnue");
    } finally {
      setScanning(false);
    }
  };

  const updateScanItem = (idx, patch) => {
    setScanResult((r) => ({ ...r, items: r.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  };

  const importScanItem = (idx) => {
    const item = scanResult.items[idx];
    if (!item || item.imported) return;
    const supplierName = scanResult.supplier || t("scanInvoice");

    if (item.assignTo === "new") {
      const sId = uid();
      const ni = {
        id: uid(),
        name: item.name,
        unit: item.unit || "kg",
        catalogId: null,
        category: "autres",
        selectedSupplierId: sId,
        suppliers: [{ id: sId, name: supplierName, price: item.unitPriceHT || 0 }],
        history: [{ date: today(), price: item.unitPriceHT || 0, supplierName }],
      };
      setIngredients((ings) => [...ings, ni]);
    } else {
      const ingId = item.assignTo;
      setIngredients((ings) =>
        ings.map((ing) => {
          if (ing.id !== ingId) return ing;
          let suppliers = ing.suppliers;
          const existing = suppliers.find((s) => normalizeStr(s.name) === normalizeStr(supplierName));
          if (existing) {
            suppliers = suppliers.map((s) => (s.id === existing.id ? { ...s, price: item.unitPriceHT || 0 } : s));
          } else {
            suppliers = [...suppliers, { id: uid(), name: supplierName, price: item.unitPriceHT || 0 }];
          }
          const history = [...(ing.history || []), { date: today(), price: item.unitPriceHT || 0, supplierName }].slice(-15);
          return { ...ing, suppliers, history, selectedSupplierId: existing ? ing.selectedSupplierId : ing.selectedSupplierId };
        })
      );
    }
    updateScanItem(idx, { imported: true });
  };

  const importAllScanItems = () => {
    scanResult.items.forEach((_, idx) => importScanItem(idx));
  };

  const closeScan = () => {
    setScanOpen(false);
    setScanResult(null);
    setScanErr(null);
  };

  const tier = marginTier(margin, settings.minMargin);
  const marginLow = tier === "low";

  const suggestions = query.trim()
    ? CATALOG.filter((c) => c[lang].toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : CATALOG.slice(0, 6);

  const pantryFiltered = ingredients.filter((i) => {
    const catOk = pantryCategory === "all" || (i.category || "autres") === pantryCategory;
    const q = pantryQuery.trim().toLowerCase();
    const nameOk = q === "" || ingredientDisplayName(i).toLowerCase().includes(q);
    return catOk && nameOk;
  });

  return (
    <div className="min-h-screen w-full overflow-x-hidden" style={{ background: "#23272A", maxWidth: "100vw" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        .font-display { font-family: 'Oswald', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .ticket { background: #F2ECDD; color: #2B2620; position: relative; box-shadow: 0 12px 30px rgba(0,0,0,0.35); max-width: 100%; }
        .ticket::before, .ticket::after {
          content: ""; position: absolute; left: 0; right: 0; height: 14px;
          background-image: radial-gradient(circle at 10px 7px, #23272A 6px, transparent 7px);
          background-size: 20px 14px; background-repeat: repeat-x;
        }
        .ticket::before { top: -7px; }
        .ticket::after { bottom: -7px; transform: rotate(180deg); }
        .stamp { border: 3px solid currentColor; transform: rotate(-6deg); font-family: 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.9; }
        @media print {
          body * { visibility: hidden; }
          .ticket, .ticket * { visibility: visible; }
          .ticket { position: absolute; top: 0; left: 0; right: 0; margin: 0 auto; box-shadow: none; }
        }
        @media (max-width: 1024px) { .grid-main { grid-template-columns: 1fr !important; } }
      `}</style>

      <header className="border-b border-black/20 px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-2 print:hidden" style={{ background: "#2F3437" }}>
        <div className="flex items-center gap-2">
          <ChefHat size={22} color="#C9A227" />
          <h1 className="font-display text-white text-base sm:text-lg tracking-wide uppercase">{t("appTitle")}</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 font-body text-xs text-white/50 flex-wrap">
          {!ready ? t("loading") : loadErr ? (
            <span className="text-amber-400">{t("dataUnavailable")}</span>
          ) : (
            <span className={`flex items-center gap-1 transition-opacity ${savedPulse ? "opacity-100" : "opacity-0"}`}>
              <Check size={14} color="#7CB342" /> {t("saved")}
            </span>
          )}
          <button onClick={() => setShowSettings(true)} className="text-white/60 hover:text-[#C9A227]" title={t("settings")}>
            <SettingsIcon size={16} />
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => setLang("fr")} className={`text-lg leading-none ${lang === "fr" ? "" : "opacity-40 grayscale"}`} title="Français">🇫🇷</button>
            <button onClick={() => setLang("es")} className={`text-lg leading-none ${lang === "es" ? "" : "opacity-40 grayscale"}`} title="Español">🇪🇸</button>
          </div>
          <button onClick={clearAll} className="underline hover:text-white/80">{t("resetData")}</button>
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setShowSettings(false)}>
          <div className="rounded-md p-5 w-full max-w-xs font-body" style={{ background: "#2F3437" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-white uppercase tracking-wide text-sm mb-4">{t("settings")}</h3>
            <label className="text-xs text-white/60 block mb-1">{t("defaultVat")}</label>
            <select
              value={settings.vat}
              onChange={(e) => setSettings({ ...settings, vat: parseFloat(e.target.value) })}
              className="w-full bg-black/20 text-white text-sm rounded px-2 py-1.5 outline-none mb-4"
              style={{ colorScheme: "dark" }}
            >
              <option value={5.5}>5.5%</option>
              <option value={10}>10% ({lang === "es" ? "hostelería España" : "restauration FR/ES"})</option>
              <option value={20}>20%</option>
              <option value={21}>21% (IVA general España)</option>
            </select>

            <label className="text-xs text-white/60 block mb-1">{t("minMarginLabel")}</label>
            <div className="flex items-center gap-2 mb-1">
              <NumField
                allowDecimal={false}
                value={settings.minMargin}
                onChange={(v) => setSettings({ ...settings, minMargin: Math.max(v, 0) })}
                className="w-16 bg-black/20 text-white text-sm rounded px-2 py-1.5 outline-none text-right"
              />
              <span className="text-white/60 text-sm">%</span>
            </div>
            <p className="text-[10px] text-white/30 mb-4">
              {lang === "es"
                ? `Verde ≥ ${settings.minMargin}% · Naranja entre ${CRITICAL_MARGIN}–${settings.minMargin}% · Rojo < ${CRITICAL_MARGIN}%`
                : `Vert ≥ ${settings.minMargin}% · Orange entre ${CRITICAL_MARGIN}–${settings.minMargin}% · Rouge < ${CRITICAL_MARGIN}%`}
            </p>

            <button onClick={() => setShowSettings(false)} className="w-full text-xs font-display uppercase tracking-wide py-2 rounded border border-white/20 text-white/70 hover:border-[#C9A227] hover:text-[#C9A227]">
              {t("close")}
            </button>
          </div>
        </div>
      )}

      {scanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 print:hidden" onClick={closeScan}>
          <div
            className="rounded-md p-5 w-full max-w-xl max-h-[85vh] overflow-y-auto font-body"
            style={{ background: "#2F3437" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-white uppercase tracking-wide text-sm">{t("scanResultTitle")}</h3>
              <button onClick={closeScan} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {scanning && (
              <div className="flex flex-col items-center justify-center py-10 text-white/60 text-sm gap-3">
                <Loader2 size={26} className="animate-spin" style={{ color: "#C9A227" }} />
                {t("scanning")}
              </div>
            )}

            {scanErr && !scanning && (
              <div className="text-center py-6">
                <div className="text-[#B23A2E] text-sm mb-3">{t("scanError")} : {scanErr}</div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs uppercase tracking-wide px-3 py-1.5 rounded border border-white/20 text-white/70 hover:border-[#C9A227] hover:text-[#C9A227]"
                >
                  {t("scanRetry")}
                </button>
              </div>
            )}

            {scanResult && !scanning && (
              <div>
                <div className="text-xs text-white/50 mb-3 flex flex-wrap gap-x-4 gap-y-1">
                  <span>{t("scanSupplier")}: <span className="text-white/80">{scanResult.supplier || "—"}</span></span>
                  <span>{t("scanDate")}: <span className="text-white/80">{scanResult.date || "—"}</span></span>
                </div>
                <p className="text-[11px] text-white/40 mb-3">{t("scanHint")}</p>

                {scanResult.items.length === 0 ? (
                  <div className="text-white/40 text-sm py-4 text-center">{t("scanNoItems")}</div>
                ) : (
                  <div className="space-y-2">
                    {scanResult.items.map((item, idx) => (
                      <div
                        key={idx}
                        className={`rounded-md p-2.5 ${item.imported ? "opacity-40" : ""}`}
                        style={{ background: "#23272A" }}
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            value={item.name || ""}
                            disabled={item.imported}
                            onChange={(e) => updateScanItem(idx, { name: e.target.value })}
                            className="flex-1 min-w-0 bg-transparent text-white text-sm font-medium outline-none border-b border-white/10 focus:border-[#C9A227]"
                          />
                          <NumField
                            value={item.quantity || 0}
                            onChange={(v) => updateScanItem(idx, { quantity: v })}
                            className="w-14 shrink-0 bg-transparent text-white/80 text-xs text-right outline-none border-b border-white/10"
                          />
                          <select
                            value={item.unit || "kg"}
                            disabled={item.imported}
                            onChange={(e) => updateScanItem(idx, { unit: e.target.value })}
                            className="bg-transparent text-white/60 text-xs outline-none shrink-0"
                            style={{ colorScheme: "dark" }}
                          >
                            <option value="kg">kg</option>
                            <option value="L">L</option>
                            <option value="pièce">pièce</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2 mt-1.5 text-xs text-white/60">
                          <select
                            value={item.assignTo}
                            disabled={item.imported}
                            onChange={(e) => updateScanItem(idx, { assignTo: e.target.value })}
                            className="flex-1 min-w-0 bg-black/20 rounded px-1.5 py-1 outline-none"
                            style={{ colorScheme: "dark" }}
                          >
                            <option value="new">{t("scanNewIngredient")}</option>
                            {ingredients.map((i) => (
                              <option key={i.id} value={i.id}>{ingredientDisplayName(i)}</option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-white/40">HT/u :</span>
                            <NumField
                              value={item.unitPriceHT || 0}
                              onChange={(v) => updateScanItem(idx, { unitPriceHT: v })}
                              className="w-14 bg-transparent text-right outline-none border-b border-white/10 font-mono"
                            />
                            <span>€</span>
                          </div>
                        </div>

                        {item.priceUp && !item.imported && (
                          <div className="flex items-center gap-1 mt-1.5 text-[10px]" style={{ color: TIER_COLORS.mid }}>
                            <TrendingUp size={11} /> {t("scanPriceIncrease")} : {item.currentPrice.toFixed(2)}€ → {(item.unitPriceHT || 0).toFixed(2)}€
                          </div>
                        )}

                        <div className="flex justify-end mt-1.5">
                          {item.imported ? (
                            <span className="text-[10px] text-[#3F8F52] font-semibold">{t("scanImported")}</span>
                          ) : (
                            <button
                              onClick={() => importScanItem(idx)}
                              className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-white/20 text-white/70 hover:border-[#C9A227] hover:text-[#C9A227]"
                            >
                              {t("scanImport")}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {scanResult.items.length > 0 && (
                  <button
                    onClick={importAllScanItems}
                    className="mt-4 w-full text-xs font-display uppercase tracking-wide py-2 rounded"
                    style={{ background: "#C9A227", color: "#000" }}
                  >
                    {t("scanImportAll")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-5 py-8 grid grid-main grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 w-full">
        {/* Pantry */}
        <aside className="font-body print:hidden min-w-0">
          <button onClick={() => setPantryOpen((o) => !o)} className="w-full flex items-center justify-between mb-3 group">
            <h2 className="font-display text-white/90 uppercase text-sm tracking-widest">{t("pantry")}</h2>
            {pantryOpen ? <ChevronUp size={16} className="text-white/40 group-hover:text-[#C9A227]" /> : <ChevronDown size={16} className="text-white/40 group-hover:text-[#C9A227]" />}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleScanFile}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-display uppercase tracking-wide py-2.5 rounded-md mb-4 text-black"
            style={{ background: "#C9A227" }}
          >
            <Camera size={15} /> {t("scanInvoice")}
          </button>

          {pantryOpen && (
            <>
              <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5 mb-2" style={{ background: "#2F3437" }}>
                <Search size={13} className="text-white/40 shrink-0" />
                <input
                  value={pantryQuery}
                  onChange={(e) => setPantryQuery(e.target.value)}
                  placeholder={t("pantryFilterPlaceholder")}
                  className="w-full bg-transparent text-white text-sm outline-none min-w-0"
                />
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                <button
                  onClick={() => setPantryCategory("all")}
                  className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border ${pantryCategory === "all" ? "bg-[#C9A227] text-black border-[#C9A227]" : "text-white/50 border-white/15 hover:border-white/40"}`}
                >
                  {t("allCategories")}
                </button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setPantryCategory(c.id)}
                    className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border ${pantryCategory === c.id ? "bg-[#C9A227] text-black border-[#C9A227]" : "text-white/50 border-white/15 hover:border-white/40"}`}
                  >
                    {c[lang]}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {pantryFiltered.map((ing) => (
                  <div key={ing.id} className="rounded-md p-2.5 min-w-0" style={{ background: "#2F3437" }}>
                    <div className="flex items-center gap-1">
                      <input
                        value={ingredientDisplayName(ing)}
                        onChange={(e) => updateIngredientName(ing.id, e.target.value)}
                        className="w-full bg-transparent text-white text-sm font-medium outline-none border-b border-white/10 focus:border-[#C9A227] pb-0.5 min-w-0"
                      />
                      <select
                        value={ing.unit}
                        onChange={(e) => updateIngredientField(ing.id, "unit", e.target.value)}
                        className="bg-transparent text-white/60 text-xs outline-none shrink-0"
                        style={{ colorScheme: "dark" }}
                      >
                        <option value="kg">kg</option>
                        <option value="L">L</option>
                        <option value="pièce">u.</option>
                      </select>
                      <button onClick={() => deleteIngredient(ing.id)} className="text-white/30 hover:text-red-400 shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="mt-2 space-y-1">
                      {ing.suppliers.map((s) => (
                        <div key={s.id} className="flex items-center gap-1.5 text-xs text-white/60">
                          <input type="radio" checked={ing.selectedSupplierId === s.id} onChange={() => selectSupplier(ing.id, s.id)} title={t("supplier")} className="shrink-0" />
                          <input
                            value={s.name}
                            onChange={(e) => updateSupplier(ing.id, s.id, "name", e.target.value)}
                            className="flex-1 bg-transparent outline-none border-b border-white/10 focus:border-[#C9A227] min-w-0"
                          />
                          <NumField value={s.price} onChange={(v) => updateSupplier(ing.id, s.id, "price", v)} className="w-12 shrink-0 bg-transparent font-mono outline-none border-b border-white/10 focus:border-[#C9A227] text-right" />
                          <span className="shrink-0">€</span>
                          {ing.suppliers.length > 1 && (
                            <button onClick={() => removeSupplier(ing.id, s.id)} className="text-white/25 hover:text-red-400 shrink-0"><Trash2 size={11} /></button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => addSupplier(ing.id)} className="text-[10px] uppercase tracking-wide text-white/40 hover:text-[#C9A227] flex items-center gap-1">
                        <Plus size={10} /> {t("supplier")}
                      </button>
                    </div>

                    {ing.history && ing.history.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-white/40 font-mono flex items-start gap-1">
                        <History size={11} className="mt-0.5 shrink-0" />
                        <span className="break-words">{ing.history.slice(-3).map((h) => `${h.date}: ${h.price.toFixed(2)}€`).join("  ·  ")}</span>
                      </div>
                    )}
                  </div>
                ))}
                {pantryFiltered.length === 0 && (
                  <div className="text-xs text-white/30 px-1 py-2">{t("noFilterMatch")}</div>
                )}
              </div>

              {adding ? (
                <div className="mt-3 relative">
                  <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5" style={{ background: "#2F3437" }}>
                    <Search size={13} className="text-white/40 shrink-0" />
                    <input
                      autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                      placeholder={t("searchPlaceholder")} className="w-full bg-transparent text-white text-sm outline-none min-w-0"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && query.trim()) addCustomIngredient(query.trim());
                        if (e.key === "Escape") { setAdding(false); setQuery(""); }
                      }}
                      onBlur={() => setTimeout(() => setAdding(false), 150)}
                    />
                  </div>
                  <div className="mt-1 rounded-md overflow-hidden absolute z-20 w-full" style={{ background: "#2F3437" }}>
                    {suggestions.map((c) => (
                      <button key={c.id} onMouseDown={(e) => { e.preventDefault(); addIngredientFromCatalog(c); }} className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 flex items-center justify-between">
                        <span>{c[lang]}</span>
                        <span className="text-[10px] text-white/30">{normUnit(c.unit)}</span>
                      </button>
                    ))}
                    {query.trim() && (
                      <button onMouseDown={(e) => { e.preventDefault(); addCustomIngredient(query.trim()); }} className="w-full text-left px-3 py-2 text-xs text-[#C9A227] hover:bg-white/10 border-t border-white/10">
                        {t("createCustom")(query.trim())}
                      </button>
                    )}
                    {!suggestions.length && !query.trim() && <div className="px-3 py-2 text-xs text-white/30">{t("noMatch")}</div>}
                  </div>
                </div>
              ) : (
                <button onClick={() => setAdding(true)} className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-display uppercase tracking-wide py-2 rounded-md border border-dashed border-white/25 text-white/60 hover:text-[#C9A227] hover:border-[#C9A227] transition">
                  <Plus size={14} /> {t("addIngredient")}
                </button>
              )}
            </>
          )}

          <h2 className="font-display text-white/90 uppercase text-sm tracking-widest mt-8 mb-3">{t("recipes")}</h2>
          <div className="space-y-1">
            {recipes.map((r) => {
              const m = recipeMargin(r);
              const rt = marginTier(m, settings.minMargin);
              return (
                <button
                  key={r.id}
                  onClick={() => { setActiveId(r.id); setView("ticket"); }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-body flex items-center justify-between group ${r.id === activeId && view === "ticket" ? "bg-[#C9A227] text-black font-semibold" : "text-white/70 hover:bg-white/5"}`}
                >
                  <span className="truncate min-w-0">{r.name}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {m !== null && <span className="text-[10px] font-mono" style={{ color: TIER_COLORS[rt] }}>{m.toFixed(0)}%</span>}
                    <Trash2 size={13} onClick={(e) => { e.stopPropagation(); deleteRecipe(r.id); }} className={`opacity-0 group-hover:opacity-60 hover:!opacity-100 ${r.id === activeId ? "text-black" : "text-white"}`} />
                  </span>
                </button>
              );
            })}
          </div>
          <button onClick={addRecipe} className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-display uppercase tracking-wide py-2 rounded-md border border-dashed border-white/25 text-white/60 hover:text-[#C9A227] hover:border-[#C9A227] transition">
            <Plus size={14} /> {t("newRecipe")}
          </button>
        </aside>

        {/* Main panel */}
        <section className="min-w-0">
          <div className="flex items-center gap-2 mb-5 print:hidden">
            <button onClick={() => setView("ticket")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-display uppercase tracking-wide ${view === "ticket" ? "bg-[#C9A227] text-black" : "text-white/60 hover:bg-white/5"}`}>
              <Receipt size={14} /> {t("ticket")}
            </button>
            <button onClick={() => setView("overview")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-display uppercase tracking-wide ${view === "overview" ? "bg-[#C9A227] text-black" : "text-white/60 hover:bg-white/5"}`}>
              <LayoutGrid size={14} /> {t("overview")}
            </button>
          </div>

          {view === "overview" ? (
            <div className="font-body">
              {/* Desktop table */}
              <div className="rounded-md overflow-hidden hidden sm:block" style={{ background: "#2F3437" }}>
                <table className="w-full text-sm text-white/80">
                  <thead>
                    <tr className="text-left text-white/40 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3">{t("recipeCol")}</th>
                      <th className="px-4 py-3 text-right">{t("costPortionCol")}</th>
                      <th className="px-4 py-3 text-right">{t("sellPriceCol")}</th>
                      <th className="px-4 py-3 text-right">{t("marginCol")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipes.map((r) => {
                      const cpp = recipeCostPerPortion(r);
                      const m = recipeMargin(r);
                      const rt = marginTier(m, settings.minMargin);
                      return (
                        <tr key={r.id} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => { setActiveId(r.id); setView("ticket"); }}>
                          <td className="px-4 py-3 font-medium">{r.name}</td>
                          <td className="px-4 py-3 text-right font-mono">{cpp.toFixed(2)}€</td>
                          <td className="px-4 py-3 text-right font-mono">{(r.sellPrice || 0).toFixed(2)}€</td>
                          <td className="px-4 py-3 text-right font-mono">
                            {m === null ? "—" : (
                              <span className="inline-block px-1.5 py-0.5 rounded font-semibold" style={{ color: TIER_COLORS[rt], backgroundColor: `${TIER_COLORS[rt]}22` }}>{m.toFixed(0)}%</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {recipes.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-white/40">{t("noRecipes")}</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {recipes.map((r) => {
                  const cpp = recipeCostPerPortion(r);
                  const m = recipeMargin(r);
                  const rt = marginTier(m, settings.minMargin);
                  return (
                    <button
                      key={r.id}
                      onClick={() => { setActiveId(r.id); setView("ticket"); }}
                      className="w-full text-left rounded-md p-3"
                      style={{ background: "#2F3437" }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-white font-medium text-sm truncate min-w-0">{r.name}</span>
                        {m !== null && (
                          <span className="text-xs font-mono font-semibold shrink-0 ml-2" style={{ color: TIER_COLORS[rt] }}>{m.toFixed(0)}%</span>
                        )}
                      </div>
                      <div className="flex justify-between text-[11px] text-white/50 font-mono">
                        <span>{t("costPortionCol")}: {cpp.toFixed(2)}€</span>
                        <span>{t("sellPriceCol")}: {(r.sellPrice || 0).toFixed(2)}€</span>
                      </div>
                    </button>
                  );
                })}
                {recipes.length === 0 && <div className="text-center text-white/40 text-sm py-6">{t("noRecipes")}</div>}
              </div>

              <p className="text-xs text-white/40 mt-3">{t("overviewHint")}</p>
            </div>
          ) : !active ? (
            <div className="font-body text-white/50 text-sm">{t("noRecipeYet")}</div>
          ) : (
            <div>
              <div className="flex justify-end gap-2 mb-3 print:hidden">
                <button onClick={() => duplicateRecipe(active)} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-[#C9A227] font-display uppercase tracking-wide">
                  <Copy size={13} /> {t("duplicate")}
                </button>
                <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-[#C9A227] font-display uppercase tracking-wide">
                  <Printer size={13} /> {t("print")}
                </button>
              </div>

              <div className="ticket rounded-sm px-5 sm:px-6 py-8 max-w-md mx-auto font-mono text-sm">
                <input
                  value={active.name}
                  onChange={(e) => updateRecipe({ name: e.target.value })}
                  className="w-full bg-transparent font-display text-lg sm:text-xl uppercase tracking-wide mb-1 outline-none text-center border-b border-dashed border-black/20 pb-2"
                />
                <div className="flex justify-center items-center gap-2 text-xs text-black/50 mb-1">
                  <span>{t("portions")} :</span>
                  <NumField allowDecimal={false} value={active.portions} onChange={(v) => updateRecipe({ portions: v || 1 })} className="w-12 bg-transparent text-center outline-none border-b border-black/20" />
                </div>
                <div className="text-center text-[10px] text-black/40 mb-4">{t("createdOn")} {active.createdAt || today()}</div>

                <div className="border-t border-b border-dashed border-black/30 py-3 space-y-2">
                  {active.lines.map((line, idx) => {
                    const ing = ingredientById(line.ingredientId);
                    return (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <select value={line.ingredientId} onChange={(e) => changeLineIngredient(idx, e.target.value)} className="flex-1 min-w-0 bg-transparent outline-none truncate">
                          {ingredients.map((i) => <option key={i.id} value={i.id}>{ingredientDisplayName(i)}</option>)}
                        </select>
                        <NumField value={line.qty} onChange={(v) => updateLineQty(idx, v)} className="w-12 shrink-0 bg-transparent text-right outline-none border-b border-black/20" />
                        <span className="text-black/40 w-6 shrink-0">{ing?.unit}</span>
                        <span className="w-14 shrink-0 text-right">{lineCost(line).toFixed(2)}€</span>
                        <button onClick={() => removeLine(idx)} className="text-black/25 hover:text-red-600 print:hidden shrink-0"><Trash2 size={12} /></button>
                      </div>
                    );
                  })}
                  <button onClick={addLine} className="text-xs text-black/40 hover:text-black flex items-center gap-1 pt-1 print:hidden">
                    <Plus size={12} /> {t("line")}
                  </button>
                </div>

                <div className="pt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span>{t("total")}</span><span className="font-semibold">{totalCost.toFixed(2)}€</span></div>
                  <div className="flex justify-between"><span>{t("costPerPortion")}</span><span className="font-semibold">{costPerPortion.toFixed(2)}€</span></div>
                  <div className="flex justify-between items-center pt-1">
                    <span>{t("sellPriceTTC")}</span>
                    <div className="flex items-center gap-1">
                      <NumField value={active.sellPrice} onChange={(v) => updateRecipe({ sellPrice: v })} className="w-16 bg-transparent text-right outline-none border-b border-black/20 font-semibold" />
                      <span>€</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-black/50 text-xs">
                    <span>{t("sellPriceHT")} ({t("vat")} {vatRate}%)</span>
                    <span>{sellHT.toFixed(2)}€</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-black/30 mt-3 pt-3 text-xs space-y-1.5 print:hidden">
                  <div className="flex justify-between items-center text-black/60">
                    <span>{t("targetMargin")}</span>
                    <div className="flex items-center gap-1">
                      <NumField allowDecimal={false} value={targetMargin} onChange={(v) => updateRecipe({ targetMargin: v })} className="w-12 bg-transparent text-right outline-none border-b border-black/20" />
                      <span>%</span>
                    </div>
                  </div>
                  {isBelowTarget && suggestedTTC !== null && (
                    <div className="flex justify-between items-center">
                      <span>{t("suggestedPrice")}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{suggestedTTC.toFixed(2)}€</span>
                        <button onClick={() => updateRecipe({ sellPrice: Math.round(suggestedTTC * 2) / 2 })} className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-black/30 hover:bg-black hover:text-[#F2ECDD] transition">
                          {t("use")}
                        </button>
                      </div>
                    </div>
                  )}
                  {isAtOrAboveTarget && (
                    <div className="rounded p-2 mt-1" style={{ background: `${TIER_COLORS.high}18` }}>
                      <div className="flex items-center gap-1.5 font-semibold" style={{ color: TIER_COLORS.high }}>
                        <Check size={12} /> {t("marginExcellentTitle")}
                      </div>
                      <div className="text-black/50 mt-0.5">{t("marginExcellentDetail")}</div>
                      {nextMarginStep !== null && (
                        <button
                          onClick={() => updateRecipe({ targetMargin: nextMarginStep })}
                          className="mt-1.5 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-black/30 hover:bg-black hover:text-[#F2ECDD] transition"
                        >
                          {t("simulateHigherMargin")(nextMarginStep)}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {margin !== null && (
                  <div className="flex flex-col items-center mt-6 mb-1 gap-1.5">
                    <div className="stamp px-4 py-1.5 text-sm" style={{ color: TIER_COLORS[tier] }}>{t("marginLabel")} {margin.toFixed(0)}%</div>
                    {tier === "high" && (
                      <div
                        className="flex items-center gap-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold"
                        style={{ color: TIER_COLORS.high, background: `${TIER_COLORS.high}18` }}
                      >
                        <Check size={11} /> {t("excellentMarginBadge")}
                      </div>
                    )}
                  </div>
                )}
                {marginLow && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-[#B23A2E] font-body mt-2 print:hidden">
                    <AlertTriangle size={13} /> {t("lowMarginWarning")}
                  </div>
                )}

                <div className="border-t border-dashed border-black/30 mt-4 pt-3 space-y-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-black/40 mb-1">{t("notes")}</div>
                    <textarea value={active.notes || ""} onChange={(e) => updateRecipe({ notes: e.target.value })} placeholder={t("notesPlaceholder")} rows={3} className="w-full bg-black/5 rounded p-2 text-xs outline-none resize-none focus:bg-black/10" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[10px] uppercase tracking-wide text-black/40 flex items-center gap-1.5">
                        {t("allergens")}
                        {active.allergensAuto !== false && active.allergens && (
                          <span className="normal-case tracking-normal text-[9px] px-1 py-0.5 rounded bg-black/10 text-black/40">{t("allergensAutoBadge")}</span>
                        )}
                      </div>
                      {active.allergensAuto === false && (
                        <button onClick={resetAllergensAuto} className="text-[9px] uppercase tracking-wide text-black/40 hover:text-black underline print:hidden">
                          {t("allergensReset")}
                        </button>
                      )}
                    </div>
                    <input
                      value={active.allergens || ""}
                      onChange={(e) => updateRecipe({ allergens: e.target.value, allergensAuto: false })}
                      placeholder={t("allergensPlaceholder")}
                      className="w-full bg-black/5 rounded p-2 text-xs outline-none focus:bg-black/10"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
