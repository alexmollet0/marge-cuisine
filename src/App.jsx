import React, { useState, useEffect, useCallback, useRef, useId } from "react";
import { storage } from "./storage.js";
import { supabase } from "./supabaseClient.js";
import {
  Plus,
  LogOut,
  Trash2,
  AlertTriangle,
  Check,
  Copy,
  Printer,
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
  TrendingDown,
  Package,
  Pencil,
  Upload,
  Clock,
  ArrowLeft,
  ShieldCheck,
  Award,
  Percent,
  Tags,
  LayoutGrid,
  List,
  ClipboardList,
  Mail,
  User,
  Paperclip,
  RotateCcw,
  RotateCw,
  QrCode,
  Globe,
  LogIn,
  ChefHat,
  Smartphone,
  Share,
  MoreVertical,
  ArrowRight,
  RefreshCw,
  MailWarning,
  Info,
} from "lucide-react";

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);

// Logo Chefup : hirondelle en plein vol ascendant, queue fourchue rappelant une
// fourchette, remplie du dégradé de marque violet -> cyan. Icône libre (sans anneau
// ni disque), pour rester lisible aussi bien sur le fond ardoise que sur le papier.
export function Logo({ size = 22 }) {
  const gradId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0, display: "block" }}>
      <defs>
        <linearGradient id={`chefup-grad-${gradId}`} x1="5%" y1="100%" x2="95%" y2="5%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <path
        d="M 76 28 C 71 27 65 29 60 33 C 55 23 44 16 32 15 C 39 24 46 30 53 36 C 47 39 39 40 31 39 C 36 45 45 47 53 45 C 50 50 46 54 41 57 L 34 58 L 8 66 L 28 64 L 14 90 L 39 66 C 44 68 50 67 54 63 C 57 66 61 68 66 69 C 63 60 62 51 64 43 C 70 43 75 39 78 34 C 80 31 79 29 76 28 Z"
        fill={`url(#chefup-grad-${gradId})`}
      />
    </svg>
  );
}

const CRITICAL_MARGIN = 70;

const CATEGORIES = [
  { id: "viandes", fr: "Viandes", es: "Carnes", en: "Meats" },
  { id: "poissons", fr: "Poissons & fruits de mer", es: "Pescados y mariscos", en: "Fish & seafood" },
  { id: "legumes", fr: "Légumes", es: "Verduras", en: "Vegetables" },
  { id: "fruits", fr: "Fruits", es: "Frutas", en: "Fruits" },
  { id: "cremerie", fr: "Crémerie", es: "Lácteos", en: "Dairy" },
  { id: "epicerie", fr: "Épicerie", es: "Despensa", en: "Pantry staples" },
  { id: "epices", fr: "Épices & herbes", es: "Especias y hierbas", en: "Spices & herbs" },
  { id: "boissons", fr: "Boissons & alcools", es: "Bebidas y licores", en: "Drinks & cooking alcohol" },
  { id: "autres", fr: "Autres", es: "Otros", en: "Other" },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// Prix indicatifs par catégorie (ordre de grandeur grossier, marché français, par kg/L/pièce
// selon l'unité de l'ingrédient) pour le bouton "estimer un prix temporaire" de l'assistant
// ingrédient — un flat 1€ pour tout (viande comme légume) a été jugé inutile en test réel
// (2026-08). Ça reste un point de départ à corriger par l'utilisateur, pas une vraie estimation
// de marché, juste un chiffre moins absurde que le même pour tout.
const CATEGORY_ESTIMATE_PRICE = {
  viandes: 15, poissons: 18, legumes: 2.5, fruits: 3, cremerie: 6,
  epicerie: 4, epices: 20, boissons: 5, autres: 5,
};

// Unité par défaut par catégorie pour un ingrédient créé depuis le scanner de fiche recette
// quand la quantité est imprécise (voir impreciseQuantity, api/scan-recipe.js) — sert de
// garde-fou pour ne jamais suivre aveuglément une unité "pièce" hasardeuse proposée par l'IA
// pour un ingrédient normalement vendu au poids (ex: "faux filet" ne doit jamais partir en
// pièce). Uniquement utilisé dans ce cas précis, jamais pour une quantité déjà précise.
const CATEGORY_DEFAULT_UNIT = {
  viandes: "kg", poissons: "kg", legumes: "kg", fruits: "kg", cremerie: "kg",
  epicerie: "kg", epices: "kg", boissons: "L", autres: "pièce",
};

const CATALOG = [
  // Viandes
  { id: "boeuf", fr: "Bœuf (paleron / gîte)", es: "Ternera (paletilla)", en: "Beef (chuck / shin)", unit: "kg", cat: "viandes" },
  { id: "poulet", fr: "Poulet entier", es: "Pollo entero", en: "Whole chicken", unit: "kg", cat: "viandes" },
  { id: "porc", fr: "Échine de porc", es: "Lomo de cerdo", en: "Pork shoulder", unit: "kg", cat: "viandes" },
  { id: "agneau", fr: "Gigot d'agneau", es: "Pierna de cordero", en: "Leg of lamb", unit: "kg", cat: "viandes" },
  { id: "dinde", fr: "Escalope de dinde", es: "Escalope de pavo", en: "Turkey escalope", unit: "kg", cat: "viandes" },
  { id: "canard", fr: "Magret de canard", es: "Magret de pato", en: "Duck breast", unit: "kg", cat: "viandes" },
  { id: "chorizo", fr: "Chorizo", es: "Chorizo", en: "Chorizo", unit: "kg", cat: "viandes" },
  { id: "jambon_cru", fr: "Jambon cru", es: "Jamón serrano", en: "Cured ham", unit: "kg", cat: "viandes" },
  { id: "jambon_blanc", fr: "Jambon blanc", es: "Jamón cocido", en: "Cooked ham", unit: "kg", cat: "viandes" },
  // Poissons & fruits de mer
  { id: "saumon", fr: "Pavé de saumon", es: "Lomo de salmón", en: "Salmon fillet steak", unit: "kg", cat: "poissons" },
  { id: "cabillaud", fr: "Dos de cabillaud", es: "Lomo de bacalao", en: "Cod loin", unit: "kg", cat: "poissons" },
  { id: "crevettes", fr: "Crevettes", es: "Gambas", en: "Shrimp", unit: "kg", cat: "poissons" },
  { id: "thon", fr: "Thon rouge", es: "Atún rojo", en: "Bluefin tuna", unit: "kg", cat: "poissons" },
  { id: "bar", fr: "Filet de bar", es: "Filete de lubina", en: "Sea bass fillet", unit: "kg", cat: "poissons" },
  { id: "dorade", fr: "Dorade", es: "Dorada", en: "Sea bream", unit: "kg", cat: "poissons" },
  { id: "moules", fr: "Moules", es: "Mejillones", en: "Mussels", unit: "kg", cat: "poissons" },
  { id: "poulpe", fr: "Poulpe", es: "Pulpo", en: "Octopus", unit: "kg", cat: "poissons" },
  { id: "anchois", fr: "Anchois", es: "Anchoas", en: "Anchovies", unit: "kg", cat: "poissons" },
  // Légumes
  { id: "carottes", fr: "Carottes", es: "Zanahorias", en: "Carrots", unit: "kg", cat: "legumes" },
  { id: "oignons", fr: "Oignons", es: "Cebollas", en: "Onions", unit: "kg", cat: "legumes" },
  { id: "ail", fr: "Ail", es: "Ajo", en: "Garlic", unit: "kg", cat: "legumes" },
  { id: "pommes_de_terre", fr: "Pommes de terre", es: "Patatas", en: "Potatoes", unit: "kg", cat: "legumes" },
  { id: "tomates", fr: "Tomates", es: "Tomates", en: "Tomatoes", unit: "kg", cat: "legumes" },
  { id: "courgettes", fr: "Courgettes", es: "Calabacines", en: "Zucchini", unit: "kg", cat: "legumes" },
  { id: "aubergines", fr: "Aubergines", es: "Berenjenas", en: "Eggplant", unit: "kg", cat: "legumes" },
  { id: "poivrons", fr: "Poivrons rouges", es: "Pimientos rojos", en: "Red bell peppers", unit: "kg", cat: "legumes" },
  { id: "champignons", fr: "Champignons de Paris", es: "Champiñones", en: "Button mushrooms", unit: "kg", cat: "legumes" },
  { id: "salade", fr: "Salade / Laitue", es: "Lechuga", en: "Lettuce", unit: "U", cat: "legumes" },
  { id: "poireaux", fr: "Poireaux", es: "Puerros", en: "Leeks", unit: "kg", cat: "legumes" },
  { id: "epinards", fr: "Épinards", es: "Espinacas", en: "Spinach", unit: "kg", cat: "legumes" },
  { id: "brocoli", fr: "Brocoli", es: "Brócoli", en: "Broccoli", unit: "kg", cat: "legumes" },
  { id: "haricots_verts", fr: "Haricots verts", es: "Judías verdes", en: "Green beans", unit: "kg", cat: "legumes" },
  { id: "petits_pois", fr: "Petits pois", es: "Guisantes", en: "Peas", unit: "kg", cat: "legumes" },
  { id: "concombre", fr: "Concombre", es: "Pepino", en: "Cucumber", unit: "U", cat: "legumes" },
  { id: "echalote", fr: "Échalote", es: "Chalota", en: "Shallot", unit: "kg", cat: "legumes" },
  { id: "celeri", fr: "Céleri", es: "Apio", en: "Celery", unit: "kg", cat: "legumes" },
  // Fruits
  { id: "citron", fr: "Citron", es: "Limón", en: "Lemon", unit: "U", cat: "fruits" },
  { id: "citron_vert", fr: "Citron vert", es: "Lima", en: "Lime", unit: "U", cat: "fruits" },
  { id: "pomme", fr: "Pomme", es: "Manzana", en: "Apple", unit: "kg", cat: "fruits" },
  { id: "orange", fr: "Orange", es: "Naranja", en: "Orange", unit: "kg", cat: "fruits" },
  { id: "banane", fr: "Banane", es: "Plátano", en: "Banana", unit: "kg", cat: "fruits" },
  { id: "fraise", fr: "Fraise", es: "Fresa", en: "Strawberry", unit: "kg", cat: "fruits" },
  { id: "avocat", fr: "Avocat", es: "Aguacate", en: "Avocado", unit: "U", cat: "fruits" },
  // Crémerie
  { id: "beurre", fr: "Beurre doux", es: "Mantequilla", en: "Unsalted butter", unit: "kg", cat: "cremerie" },
  { id: "creme", fr: "Crème liquide 30%", es: "Nata líquida 30%", en: "Heavy cream 30%", unit: "L", cat: "cremerie" },
  { id: "creme_fraiche", fr: "Crème fraîche", es: "Nata fresca", en: "Crème fraîche", unit: "L", cat: "cremerie" },
  { id: "lait", fr: "Lait entier", es: "Leche entera", en: "Whole milk", unit: "L", cat: "cremerie" },
  { id: "fromage_rape", fr: "Fromage râpé", es: "Queso rallado", en: "Shredded cheese", unit: "kg", cat: "cremerie" },
  { id: "mozzarella", fr: "Mozzarella", es: "Mozzarella", en: "Mozzarella", unit: "kg", cat: "cremerie" },
  { id: "yaourt", fr: "Yaourt nature", es: "Yogur natural", en: "Plain yogurt", unit: "U", cat: "cremerie" },
  { id: "mascarpone", fr: "Mascarpone", es: "Mascarpone", en: "Mascarpone", unit: "kg", cat: "cremerie" },
  { id: "chevre", fr: "Fromage de chèvre", es: "Queso de cabra", en: "Goat cheese", unit: "kg", cat: "cremerie" },
  { id: "parmesan", fr: "Parmesan", es: "Parmesano", en: "Parmesan", unit: "kg", cat: "cremerie" },
  { id: "oeufs", fr: "Œufs", es: "Huevos", en: "Eggs", unit: "U", cat: "cremerie" },
  // Épicerie
  { id: "farine", fr: "Farine T55", es: "Harina de trigo", en: "All-purpose flour", unit: "kg", cat: "epicerie" },
  { id: "sucre", fr: "Sucre en poudre", es: "Azúcar", en: "Granulated sugar", unit: "kg", cat: "epicerie" },
  { id: "sel", fr: "Sel fin", es: "Sal fina", en: "Fine salt", unit: "kg", cat: "epicerie" },
  { id: "poivre", fr: "Poivre noir", es: "Pimienta negra", en: "Black pepper", unit: "kg", cat: "epicerie" },
  { id: "riz", fr: "Riz Basmati", es: "Arroz Basmati", en: "Basmati rice", unit: "kg", cat: "epicerie" },
  { id: "pates", fr: "Pâtes Penne", es: "Pasta Penne", en: "Penne pasta", unit: "kg", cat: "epicerie" },
  { id: "huile_olive", fr: "Huile d'olive", es: "Aceite de oliva", en: "Olive oil", unit: "L", cat: "epicerie" },
  { id: "huile_tournesol", fr: "Huile de tournesol", es: "Aceite de girasol", en: "Sunflower oil", unit: "L", cat: "epicerie" },
  { id: "huile_sesame", fr: "Huile de sésame", es: "Aceite de sésamo", en: "Sesame oil", unit: "L", cat: "epicerie" },
  { id: "moutarde", fr: "Moutarde", es: "Mostaza", en: "Mustard", unit: "kg", cat: "epicerie" },
  { id: "sauce_soja", fr: "Sauce soja", es: "Salsa de soja", en: "Soy sauce", unit: "L", cat: "epicerie" },
  { id: "vinaigre_balsamique", fr: "Vinaigre balsamique", es: "Vinagre balsámico", en: "Balsamic vinegar", unit: "L", cat: "epicerie" },
  { id: "vinaigre_vin", fr: "Vinaigre de vin", es: "Vinagre de vino", en: "Wine vinegar", unit: "L", cat: "epicerie" },
  { id: "ketchup", fr: "Ketchup", es: "Kétchup", en: "Ketchup", unit: "kg", cat: "epicerie" },
  { id: "mayonnaise", fr: "Mayonnaise", es: "Mayonesa", en: "Mayonnaise", unit: "kg", cat: "epicerie" },
  { id: "miel", fr: "Miel", es: "Miel", en: "Honey", unit: "kg", cat: "epicerie" },
  { id: "maizena", fr: "Maïzena", es: "Maicena", en: "Cornstarch", unit: "kg", cat: "epicerie" },
  { id: "quinoa", fr: "Quinoa", es: "Quinoa", en: "Quinoa", unit: "kg", cat: "epicerie" },
  { id: "couscous", fr: "Semoule / Couscous", es: "Cuscús", en: "Couscous", unit: "kg", cat: "epicerie" },
  { id: "amandes", fr: "Amandes", es: "Almendras", en: "Almonds", unit: "kg", cat: "epicerie" },
  { id: "noisettes", fr: "Noisettes", es: "Avellanas", en: "Hazelnuts", unit: "kg", cat: "epicerie" },
  { id: "chocolat_noir", fr: "Chocolat noir", es: "Chocolate negro", en: "Dark chocolate", unit: "kg", cat: "epicerie" },
  // Épices & herbes
  { id: "paprika", fr: "Paprika", es: "Pimentón", en: "Paprika", unit: "kg", cat: "epices" },
  { id: "cumin", fr: "Cumin", es: "Comino", en: "Cumin", unit: "kg", cat: "epices" },
  { id: "curry", fr: "Curry", es: "Curry", en: "Curry powder", unit: "kg", cat: "epices" },
  { id: "cannelle", fr: "Cannelle", es: "Canela", en: "Cinnamon", unit: "kg", cat: "epices" },
  { id: "thym", fr: "Thym", es: "Tomillo", en: "Thyme", unit: "kg", cat: "epices" },
  { id: "laurier", fr: "Laurier", es: "Laurel", en: "Bay leaf", unit: "kg", cat: "epices" },
  { id: "basilic", fr: "Basilic frais", es: "Albahaca fresca", en: "Fresh basil", unit: "kg", cat: "epices" },
  { id: "persil", fr: "Persil frais", es: "Perejil fresco", en: "Fresh parsley", unit: "kg", cat: "epices" },
  { id: "muscade", fr: "Noix de muscade", es: "Nuez moscada", en: "Nutmeg", unit: "kg", cat: "epices" },
  { id: "piment_espelette", fr: "Piment d'Espelette", es: "Guindilla", en: "Espelette pepper", unit: "kg", cat: "epices" },
  // Boissons & alcools de cuisine
  { id: "vin_rouge", fr: "Vin rouge de cuisine", es: "Vino tinto de cocina", en: "Red cooking wine", unit: "L", cat: "boissons" },
  { id: "vin_blanc", fr: "Vin blanc de cuisine", es: "Vino blanco de cocina", en: "White cooking wine", unit: "L", cat: "boissons" },
  { id: "biere", fr: "Bière", es: "Cerveza", en: "Beer", unit: "L", cat: "boissons" },
  { id: "porto", fr: "Porto", es: "Oporto", en: "Port wine", unit: "L", cat: "boissons" },
  { id: "jerez", fr: "Xérès / Jerez", es: "Jerez", en: "Sherry", unit: "L", cat: "boissons" },
  { id: "rhum", fr: "Rhum", es: "Ron", en: "Rum", unit: "L", cat: "boissons" },
  { id: "cognac", fr: "Cognac", es: "Coñac", en: "Cognac", unit: "L", cat: "boissons" },
  { id: "steak_hache", fr: "Steak haché 15%", es: "Carne picada 15%", en: "Ground beef 15%", unit: "kg", cat: "viandes" },
  { id: "entrecote", fr: "Entrecôte", es: "Entrecot", en: "Ribeye steak", unit: "kg", cat: "viandes" },
  { id: "filet_boeuf", fr: "Filet de bœuf", es: "Solomillo de ternera", en: "Beef tenderloin", unit: "kg", cat: "viandes" },
  { id: "rumsteck", fr: "Rumsteck", es: "Contra de ternera", en: "Rump steak", unit: "kg", cat: "viandes" },
  { id: "bavette", fr: "Bavette", es: "Bavette de ternera", en: "Flank steak", unit: "kg", cat: "viandes" },
  { id: "cote_porc", fr: "Côte de porc", es: "Chuleta de cerdo", en: "Pork chop", unit: "kg", cat: "viandes" },
  { id: "lardons_fumes", fr: "Lardons fumés", es: "Panceta ahumada en tacos", en: "Smoked bacon lardons", unit: "kg", cat: "viandes" },
  { id: "saucisse_toulouse", fr: "Saucisse de Toulouse", es: "Salchicha de Toulouse", en: "Toulouse sausage", unit: "kg", cat: "viandes" },
  { id: "merguez", fr: "Merguez", es: "Merguez", en: "Merguez sausage", unit: "kg", cat: "viandes" },
  { id: "foie_gras", fr: "Foie gras cru", es: "Foie gras crudo", en: "Raw foie gras", unit: "kg", cat: "viandes" },
  { id: "lapin", fr: "Lapin entier", es: "Conejo entero", en: "Whole rabbit", unit: "kg", cat: "viandes" },
  { id: "veau_escalope", fr: "Escalope de veau", es: "Escalope de ternera lechal", en: "Veal escalope", unit: "kg", cat: "viandes" },
  { id: "pintade", fr: "Pintade", es: "Pintada", en: "Guinea fowl", unit: "kg", cat: "viandes" },
  { id: "maquereau", fr: "Maquereau", es: "Caballa", en: "Mackerel", unit: "kg", cat: "poissons" },
  { id: "sardine", fr: "Sardine", es: "Sardina", en: "Sardine", unit: "kg", cat: "poissons" },
  { id: "truite", fr: "Truite", es: "Trucha", en: "Trout", unit: "kg", cat: "poissons" },
  { id: "lieu_noir", fr: "Lieu noir", es: "Abadejo", en: "Coley", unit: "kg", cat: "poissons" },
  { id: "sole", fr: "Sole", es: "Lenguado", en: "Sole", unit: "kg", cat: "poissons" },
  { id: "seiche", fr: "Seiche", es: "Sepia", en: "Cuttlefish", unit: "kg", cat: "poissons" },
  { id: "calamar", fr: "Calamar", es: "Calamar", en: "Squid", unit: "kg", cat: "poissons" },
  { id: "langoustine", fr: "Langoustine", es: "Cigala", en: "Langoustine", unit: "kg", cat: "poissons" },
  { id: "huitres", fr: "Huîtres", es: "Ostras", en: "Oysters", unit: "U", cat: "poissons" },
  { id: "saint_jacques", fr: "Noix de Saint-Jacques", es: "Vieiras", en: "Scallops", unit: "kg", cat: "poissons" },
  { id: "saumon_fume", fr: "Saumon fumé", es: "Salmón ahumado", en: "Smoked salmon", unit: "kg", cat: "poissons" },
  { id: "tarama", fr: "Tarama", es: "Tarama", en: "Tarama", unit: "kg", cat: "poissons" },
  { id: "surimi", fr: "Surimi", es: "Surimi", en: "Surimi", unit: "kg", cat: "poissons" },
  { id: "radis", fr: "Radis", es: "Rábano", en: "Radish", unit: "kg", cat: "legumes" },
  { id: "betterave", fr: "Betterave", es: "Remolacha", en: "Beetroot", unit: "kg", cat: "legumes" },
  { id: "navet", fr: "Navet", es: "Nabo", en: "Turnip", unit: "kg", cat: "legumes" },
  { id: "fenouil", fr: "Fenouil", es: "Hinojo", en: "Fennel", unit: "kg", cat: "legumes" },
  { id: "artichaut", fr: "Artichaut", es: "Alcachofa", en: "Artichoke", unit: "U", cat: "legumes" },
  { id: "asperge", fr: "Asperge verte", es: "Espárrago verde", en: "Green asparagus", unit: "kg", cat: "legumes" },
  { id: "chou_blanc", fr: "Chou blanc", es: "Col blanca", en: "White cabbage", unit: "kg", cat: "legumes" },
  { id: "chou_fleur", fr: "Chou-fleur", es: "Coliflor", en: "Cauliflower", unit: "U", cat: "legumes" },
  { id: "chou_bruxelles", fr: "Chou de Bruxelles", es: "Coles de Bruselas", en: "Brussels sprouts", unit: "kg", cat: "legumes" },
  { id: "endive", fr: "Endive", es: "Endivia", en: "Endive", unit: "kg", cat: "legumes" },
  { id: "roquette", fr: "Roquette", es: "Rúcula", en: "Arugula", unit: "kg", cat: "legumes" },
  { id: "mache", fr: "Mâche", es: "Canónigos", en: "Lamb's lettuce", unit: "kg", cat: "legumes" },
  { id: "patate_douce", fr: "Patate douce", es: "Boniato", en: "Sweet potato", unit: "kg", cat: "legumes" },
  { id: "mais_doux", fr: "Maïs doux", es: "Maíz dulce", en: "Sweet corn", unit: "kg", cat: "legumes" },
  { id: "gingembre", fr: "Gingembre frais", es: "Jengibre fresco", en: "Fresh ginger", unit: "kg", cat: "legumes" },
  { id: "oignon_rouge", fr: "Oignon rouge", es: "Cebolla roja", en: "Red onion", unit: "kg", cat: "legumes" },
  { id: "ciboulette", fr: "Ciboulette fraîche", es: "Cebollino fresco", en: "Fresh chives", unit: "kg", cat: "legumes" },
  { id: "coriandre", fr: "Coriandre fraîche", es: "Cilantro fresco", en: "Fresh cilantro", unit: "kg", cat: "legumes" },
  { id: "menthe", fr: "Menthe fraîche", es: "Menta fresca", en: "Fresh mint", unit: "kg", cat: "legumes" },
  { id: "poire", fr: "Poire", es: "Pera", en: "Pear", unit: "kg", cat: "fruits" },
  { id: "peche", fr: "Pêche", es: "Melocotón", en: "Peach", unit: "kg", cat: "fruits" },
  { id: "abricot", fr: "Abricot", es: "Albaricoque", en: "Apricot", unit: "kg", cat: "fruits" },
  { id: "prune", fr: "Prune", es: "Ciruela", en: "Plum", unit: "kg", cat: "fruits" },
  { id: "raisin", fr: "Raisin", es: "Uva", en: "Grapes", unit: "kg", cat: "fruits" },
  { id: "melon", fr: "Melon", es: "Melón", en: "Melon", unit: "U", cat: "fruits" },
  { id: "pasteque", fr: "Pastèque", es: "Sandía", en: "Watermelon", unit: "kg", cat: "fruits" },
  { id: "kiwi", fr: "Kiwi", es: "Kiwi", en: "Kiwi", unit: "kg", cat: "fruits" },
  { id: "mangue", fr: "Mangue", es: "Mango", en: "Mango", unit: "U", cat: "fruits" },
  { id: "ananas", fr: "Ananas", es: "Piña", en: "Pineapple", unit: "U", cat: "fruits" },
  { id: "framboise", fr: "Framboise", es: "Frambuesa", en: "Raspberry", unit: "kg", cat: "fruits" },
  { id: "myrtille", fr: "Myrtille", es: "Arándano", en: "Blueberry", unit: "kg", cat: "fruits" },
  { id: "cerise", fr: "Cerise", es: "Cereza", en: "Cherry", unit: "kg", cat: "fruits" },
  { id: "figue", fr: "Figue", es: "Higo", en: "Fig", unit: "kg", cat: "fruits" },
  { id: "pamplemousse", fr: "Pamplemousse", es: "Pomelo", en: "Grapefruit", unit: "U", cat: "fruits" },
  { id: "noix_de_coco", fr: "Noix de coco", es: "Coco", en: "Coconut", unit: "U", cat: "fruits" },
  { id: "comte", fr: "Comté", es: "Comté (queso)", en: "Comté cheese", unit: "kg", cat: "cremerie" },
  { id: "emmental", fr: "Emmental", es: "Emmental", en: "Emmental", unit: "kg", cat: "cremerie" },
  { id: "gruyere", fr: "Gruyère", es: "Gruyer", en: "Gruyère", unit: "kg", cat: "cremerie" },
  { id: "brie", fr: "Brie", es: "Brie", en: "Brie", unit: "kg", cat: "cremerie" },
  { id: "camembert", fr: "Camembert", es: "Camembert", en: "Camembert", unit: "U", cat: "cremerie" },
  { id: "roquefort", fr: "Roquefort", es: "Roquefort", en: "Roquefort", unit: "kg", cat: "cremerie" },
  { id: "feta", fr: "Feta", es: "Feta", en: "Feta", unit: "kg", cat: "cremerie" },
  { id: "ricotta", fr: "Ricotta", es: "Ricotta", en: "Ricotta", unit: "kg", cat: "cremerie" },
  { id: "fromage_blanc", fr: "Fromage blanc", es: "Queso fresco batido", en: "Fromage blanc", unit: "kg", cat: "cremerie" },
  { id: "beurre_demi_sel", fr: "Beurre demi-sel", es: "Mantequilla semisalada", en: "Lightly salted butter", unit: "kg", cat: "cremerie" },
  { id: "margarine", fr: "Margarine", es: "Margarina", en: "Margarine", unit: "kg", cat: "cremerie" },
  { id: "skyr", fr: "Skyr nature", es: "Skyr natural", en: "Plain skyr", unit: "kg", cat: "cremerie" },
  { id: "pain_mie", fr: "Pain de mie", es: "Pan de molde", en: "Sandwich bread", unit: "kg", cat: "epicerie" },
  { id: "farine_sarrasin", fr: "Farine de sarrasin", es: "Harina de trigo sarraceno", en: "Buckwheat flour", unit: "kg", cat: "epicerie" },
  { id: "levure_boulangere", fr: "Levure boulangère", es: "Levadura de panadería", en: "Baker's yeast", unit: "kg", cat: "epicerie" },
  { id: "levure_chimique", fr: "Levure chimique", es: "Levadura química", en: "Baking powder", unit: "kg", cat: "epicerie" },
  { id: "bicarbonate", fr: "Bicarbonate de soude", es: "Bicarbonato de sodio", en: "Baking soda", unit: "kg", cat: "epicerie" },
  { id: "sucre_glace", fr: "Sucre glace", es: "Azúcar glas", en: "Powdered sugar", unit: "kg", cat: "epicerie" },
  { id: "cassonade", fr: "Cassonade", es: "Azúcar moreno", en: "Brown sugar", unit: "kg", cat: "epicerie" },
  { id: "confiture", fr: "Confiture", es: "Mermelada", en: "Jam", unit: "kg", cat: "epicerie" },
  { id: "pate_a_tartiner", fr: "Pâte à tartiner", es: "Crema de cacao para untar", en: "Chocolate hazelnut spread", unit: "kg", cat: "epicerie" },
  { id: "chapelure", fr: "Chapelure", es: "Pan rallado", en: "Breadcrumbs", unit: "kg", cat: "epicerie" },
  { id: "spaghetti", fr: "Spaghetti", es: "Espaguetis", en: "Spaghetti", unit: "kg", cat: "epicerie" },
  { id: "tagliatelles", fr: "Tagliatelles", es: "Tallarines", en: "Tagliatelle", unit: "kg", cat: "epicerie" },
  { id: "lentilles_vertes", fr: "Lentilles vertes", es: "Lentejas verdes", en: "Green lentils", unit: "kg", cat: "epicerie" },
  { id: "pois_chiches", fr: "Pois chiches", es: "Garbanzos", en: "Chickpeas", unit: "kg", cat: "epicerie" },
  { id: "haricots_rouges", fr: "Haricots rouges secs", es: "Alubias rojas", en: "Dried kidney beans", unit: "kg", cat: "epicerie" },
  { id: "tofu", fr: "Tofu", es: "Tofu", en: "Tofu", unit: "kg", cat: "epicerie" },
  { id: "noix_cajou", fr: "Noix de cajou", es: "Anacardos", en: "Cashew nuts", unit: "kg", cat: "epicerie" },
  { id: "pistaches", fr: "Pistaches", es: "Pistachos", en: "Pistachios", unit: "kg", cat: "epicerie" },
  { id: "tomates_pelees", fr: "Tomates pelées en boîte", es: "Tomate pelado en lata", en: "Canned peeled tomatoes", unit: "kg", cat: "epicerie" },
  { id: "concentre_tomate", fr: "Concentré de tomate", es: "Concentrado de tomate", en: "Tomato paste", unit: "kg", cat: "epicerie" },
  { id: "capres", fr: "Câpres", es: "Alcaparras", en: "Capers", unit: "kg", cat: "epicerie" },
  { id: "olives_vertes", fr: "Olives vertes", es: "Aceitunas verdes", en: "Green olives", unit: "kg", cat: "epicerie" },
  { id: "olives_noires", fr: "Olives noires", es: "Aceitunas negras", en: "Black olives", unit: "kg", cat: "epicerie" },
  { id: "cornichons", fr: "Cornichons", es: "Pepinillos", en: "Gherkins", unit: "kg", cat: "epicerie" },
  { id: "bouillon_volaille", fr: "Bouillon de volaille", es: "Caldo de pollo", en: "Chicken stock", unit: "kg", cat: "epicerie" },
  { id: "curcuma", fr: "Curcuma", es: "Cúrcuma", en: "Turmeric", unit: "kg", cat: "epices" },
  { id: "cardamome", fr: "Cardamome", es: "Cardamomo", en: "Cardamom", unit: "kg", cat: "epices" },
  { id: "girofle", fr: "Clou de girofle", es: "Clavo de olor", en: "Cloves", unit: "kg", cat: "epices" },
  { id: "herbes_provence", fr: "Herbes de Provence", es: "Hierbas provenzales", en: "Herbes de Provence", unit: "kg", cat: "epices" },
  { id: "origan", fr: "Origan", es: "Orégano", en: "Oregano", unit: "kg", cat: "epices" },
  { id: "romarin", fr: "Romarin", es: "Romero", en: "Rosemary", unit: "kg", cat: "epices" },
  { id: "sauge", fr: "Sauge", es: "Salvia", en: "Sage", unit: "kg", cat: "epices" },
  { id: "estragon", fr: "Estragon", es: "Estragón", en: "Tarragon", unit: "kg", cat: "epices" },
  { id: "fleur_de_sel", fr: "Fleur de sel", es: "Flor de sal", en: "Fleur de sel", unit: "kg", cat: "epices" },
  { id: "poivre_blanc", fr: "Poivre blanc", es: "Pimienta blanca", en: "White pepper", unit: "kg", cat: "epices" },
  { id: "vanille", fr: "Gousse de vanille", es: "Vaina de vainilla", en: "Vanilla pod", unit: "U", cat: "epices" },
  { id: "sucre_vanille", fr: "Sucre vanillé", es: "Azúcar avainillado", en: "Vanilla sugar", unit: "kg", cat: "epices" },
  { id: "eau_plate", fr: "Eau minérale plate", es: "Agua mineral sin gas", en: "Still mineral water", unit: "L", cat: "boissons" },
  { id: "eau_gazeuse", fr: "Eau gazeuse", es: "Agua con gas", en: "Sparkling water", unit: "L", cat: "boissons" },
  { id: "jus_orange", fr: "Jus d'orange", es: "Zumo de naranja", en: "Orange juice", unit: "L", cat: "boissons" },
  { id: "jus_pomme", fr: "Jus de pomme", es: "Zumo de manzana", en: "Apple juice", unit: "L", cat: "boissons" },
  { id: "soda_cola", fr: "Soda cola", es: "Refresco de cola", en: "Cola soda", unit: "L", cat: "boissons" },
  { id: "cafe_grains", fr: "Café en grains", es: "Café en grano", en: "Coffee beans", unit: "kg", cat: "boissons" },
  { id: "cafe_moulu", fr: "Café moulu", es: "Café molido", en: "Ground coffee", unit: "kg", cat: "boissons" },
  { id: "the_noir", fr: "Thé noir", es: "Té negro", en: "Black tea", unit: "kg", cat: "boissons" },
  { id: "vin_rose", fr: "Vin rosé de cuisine", es: "Vino rosado de cocina", en: "Rosé cooking wine", unit: "L", cat: "boissons" },
  { id: "champagne", fr: "Champagne", es: "Champán", en: "Champagne", unit: "L", cat: "boissons" },
  { id: "whisky", fr: "Whisky", es: "Whisky", en: "Whisky", unit: "L", cat: "boissons" },
  { id: "vodka", fr: "Vodka", es: "Vodka", en: "Vodka", unit: "L", cat: "boissons" },
];
const CATALOG_MAP = Object.fromEntries(CATALOG.map((c) => [c.id, c]));
const normUnit = (u) => (u === "U" ? "pièce" : u);
// "pièce" est un identifiant interne stable (comparé un peu partout dans le code, ex: unit ===
// "pièce") — jamais renommé. Seul son AFFICHAGE doit être traduit ; "kg"/"L" restent identiques
// dans les 3 langues donc n'ont besoin d'aucune conversion.
const unitDisplayLabel = (u, t) => (u === "pièce" ? t("unitPieceLabel") : u);

export const ALLERGEN_LABELS = {
  gluten: { fr: "Gluten", es: "Gluten", en: "Gluten" },
  lait: { fr: "Lait / Lactose", es: "Lácteos", en: "Milk / Lactose" },
  oeufs: { fr: "Œufs", es: "Huevo", en: "Eggs" },
  sulfites: { fr: "Sulfites", es: "Sulfitos", en: "Sulphites" },
  poisson: { fr: "Poisson", es: "Pescado", en: "Fish" },
  crustaces: { fr: "Crustacés", es: "Crustáceos", en: "Crustaceans" },
  mollusques: { fr: "Mollusques", es: "Moluscos", en: "Molluscs" },
  moutarde: { fr: "Moutarde", es: "Mostaza", en: "Mustard" },
  soja: { fr: "Soja", es: "Soja", en: "Soy" },
  celeri: { fr: "Céleri", es: "Apio", en: "Celery" },
  fruits_a_coque: { fr: "Fruits à coque", es: "Frutos secos", en: "Tree nuts" },
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

// Détection complémentaire par mots-clés dans le nom (comparaison mot entier, jamais sous-chaîne,
// pour éviter des faux positifs comme "laitue" -> "lait"). Sert de filet pour les ingrédients créés
// depuis le scan de facture, qui n'ont pas de catalogId reconnu dans ALLERGEN_MAP ci-dessus.
// Toujours comparé au nom source français, indépendamment de la langue d'interface choisie.
const ALLERGEN_NAME_KEYWORDS = {
  gluten: ["farine", "ble", "froment", "pain", "pate", "pates", "semoule", "couscous", "chapelure", "biscuit", "biscuits", "vermicelle", "orge", "seigle", "avoine", "boulgour"],
  lait: ["lait", "creme", "beurre", "fromage", "yaourt", "yogourt", "mozzarella", "parmesan", "mascarpone", "chevre", "comte", "emmental", "gruyere", "cheddar", "ricotta", "brie", "camembert", "roquefort", "burrata", "feta"],
  oeufs: ["oeuf", "oeufs"],
  sulfites: ["sulfite", "sulfites"],
  poisson: ["saumon", "cabillaud", "thon", "bar", "dorade", "anchois", "morue", "sole", "truite", "colin", "merlan", "hareng", "maquereau", "lieu", "poisson"],
  crustaces: ["crevette", "crevettes", "gambas", "langoustine", "langoustines", "crabe", "homard", "ecrevisse"],
  mollusques: ["moule", "moules", "huitre", "huitres", "poulpe", "calamar", "calamars", "seiche", "praire", "praires", "palourde", "palourdes", "coquille", "escargot", "escargots"],
  moutarde: ["moutarde"],
  soja: ["soja", "tofu", "edamame"],
  celeri: ["celeri"],
  fruits_a_coque: ["amande", "amandes", "noisette", "noisettes", "noix", "pistache", "pistaches", "cajou", "macadamia"],
};

// Casse/accents ignorés partout où on compare des noms de produits (recherche garde-manger,
// rapprochement scan, détection allergènes...). Traite aussi œ/æ explicitement : ce sont des
// ligatures qui ne se décomposent PAS via normalize("NFD") (contrairement à é/è/ê...), donc
// "bœuf" tapé "boeuf" sans accent ne matchait jamais avant cet ajout (bug réel signalé,
// 2026-08) — la lettre œ finissait juste supprimée par le filtre [^a-z0-9], coupant le mot en
// deux ("b" + "uf") au lieu de devenir "boeuf".
const normalizeDiacritics = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

// Recherche "insensible" utilisée dans toutes les barres de recherche de l'app (garde-manger,
// assistant ingrédient, sélecteur de ligne de recette) — avant cet ajout ces filtres faisaient
// juste .toLowerCase().includes(), donc ni les accents ni œ/æ n'étaient ignorés.
const textIncludes = (haystack, needle) => normalizeDiacritics(haystack).includes(normalizeDiacritics(needle));

const normalizeAllergenText = (s) => normalizeDiacritics(s).replace(/[^a-z0-9]+/g, " ").trim();

// Nom source (toujours français), indépendant de la langue d'interface — utilisé pour
// toute détection par mots-clés (allergènes, féculents...) afin de rester cohérent
// quelle que soit la langue choisie par l'utilisateur.
function ingredientSourceName(ing) {
  return ing?.catalogId && CATALOG_MAP[ing.catalogId] ? CATALOG_MAP[ing.catalogId].fr : ing?.name || "";
}

function detectAllergenCodesSet(lines, ingredientsList) {
  const set = new Set();
  lines.forEach((l) => {
    const ing = ingredientsList.find((i) => i.id === l.ingredientId);
    if (!ing) return;
    if (ing.catalogId && ALLERGEN_MAP[ing.catalogId]) ALLERGEN_MAP[ing.catalogId].forEach((a) => set.add(a));

    const tokens = new Set(normalizeAllergenText(ingredientSourceName(ing)).split(" ").filter(Boolean));
    Object.entries(ALLERGEN_NAME_KEYWORDS).forEach(([allergen, keywords]) => {
      if (keywords.some((k) => tokens.has(k))) set.add(allergen);
    });
  });
  return set;
}

function detectAllergens(lines, ingredientsList, lang) {
  return Array.from(detectAllergenCodesSet(lines, ingredientsList)).map((a) => ALLERGEN_LABELS[a][lang]).join(", ");
}

// Codes bruts (indépendants de la langue), utilisés par la carte digitale publique pour afficher
// des logos d'allergène traduits dans la langue choisie par le client — jamais dans le texte libre
// `allergens` (déjà figé dans la langue de l'app du restaurateur au moment du calcul).
function detectAllergenCodes(lines, ingredientsList) {
  return Array.from(detectAllergenCodesSet(lines, ingredientsList)).sort();
}

// Reconstruit les codes bruts à partir du texte allergènes tapé À LA MAIN (2026-08-19) — sans ça,
// un allergène ajouté manuellement (`allergensAuto: false`) apparaissait bien sur la fiche
// imprimée (qui affiche le texte brut) mais jamais sur la carte digitale (qui n'affiche que des
// icônes basées sur `allergenCodes`, jamais mis à jour par une saisie manuelle) — bug réel
// signalé par l'utilisateur. Compare chaque segment séparé par une virgule aux 11 libellés connus
// dans les 3 langues (le restaurateur peut avoir tapé en FR, ES ou EN selon la langue de l'app) ;
// un mot non reconnu (faute de frappe, allergène non listé) ne récupère simplement pas d'icône —
// il reste malgré tout visible tel quel sur la fiche imprimée, qui ne dépend pas de cette fonction.
function matchAllergenCodesFromText(text) {
  const tokens = (text || "").split(",").map((s) => normalizeAllergenText(s)).filter(Boolean);
  const codes = new Set();
  tokens.forEach((tok) => {
    Object.entries(ALLERGEN_LABELS).forEach(([code, langs]) => {
      const variants = [langs.fr, langs.es, langs.en].map((s) => normalizeAllergenText(s));
      if (variants.includes(tok)) codes.add(code);
    });
  });
  return Array.from(codes).sort();
}

// Détection "féculent" pour les suggestions contextuelles de marge (2026-08). Ce n'est pas
// une catégorie CATEGORIES à part entière (riz/pâtes sont rangés en "epicerie", pomme de
// terre en "legumes"), donc mots-clés sur le nom source — même principe qu'ALLERGEN_NAME_KEYWORDS.
// Chaque entrée est une phrase (liste de tokens, dans l'ordre) ; un "s" final est toléré
// automatiquement par matchesFeculentKeywords (pluriel), pas besoin de lister les deux formes.
// Liste non-exhaustive par nature, comme les autres listes de mots-clés de ce fichier — à
// enrichir avec l'usage réel des fournisseurs de l'utilisateur.
const FECULENT_NAME_KEYWORDS = [
  ["riz"], ["pate"], ["spaghetti"], ["tagliatelle"], ["penne"], ["macaroni"], ["nouille"],
  ["vermicelle"], ["patate"], ["frite"], ["semoule"], ["couscous"], ["quinoa"], ["boulgour"],
  ["polenta"], ["lentille"], ["pain"], ["baguette"], ["pomme", "de", "terre"],
  ["pois", "chiche"], ["haricot", "blanc"], ["haricot", "rouge"],
];

function matchesFeculentKeywords(tokens) {
  return FECULENT_NAME_KEYWORDS.some((phrase) => {
    for (let i = 0; i <= tokens.length - phrase.length; i++) {
      if (phrase.every((pt, j) => tokens[i + j] === pt || tokens[i + j] === pt + "s")) return true;
    }
    return false;
  });
}

function isProteinIngredient(ing) {
  return ing?.category === "viandes" || ing?.category === "poissons";
}

function isFeculentIngredient(ing) {
  if (!ing) return false;
  const tokens = normalizeAllergenText(ingredientSourceName(ing)).split(" ").filter(Boolean);
  return matchesFeculentKeywords(tokens);
}

// Suggestion contextuelle d'optimisation de marge : règles déterministes (pas d'appel IA),
// pour garantir qu'on ne mentionne jamais une protéine/féculent absent de la recette.
// Priorité : protéine présente > féculent sans protéine > ni l'un ni l'autre (dessert,
// boisson, entrée simple), auquel cas on pointe l'ingrédient le plus cher de la recette.
function recipeSuggestion(recipe, ingredientsList, lineCostFn, displayNameFn, lang) {
  const tr = (key) => (TR[lang] && TR[lang][key]) || TR.fr[key];
  const linesWithIng = recipe.lines
    .map((l) => ({ line: l, ing: ingredientsList.find((i) => i.id === l.ingredientId) }))
    .filter((x) => x.ing);
  if (linesWithIng.some((x) => isProteinIngredient(x.ing))) return tr("suggestionProtein");
  if (linesWithIng.some((x) => isFeculentIngredient(x.ing))) return tr("suggestionFeculent");

  let priciest = null;
  linesWithIng.forEach((x) => {
    const cost = lineCostFn(x.line);
    if (cost > 0 && (!priciest || cost > priciest.cost)) priciest = { name: displayNameFn(x.ing), cost };
  });
  return priciest ? tr("suggestionOtherWithIngredient")(priciest.name) : tr("suggestionOther");
}

export const TR = {
  fr: {
    appTitle: "Chefup", saved: "Enregistré", loading: "Chargement…", greeting: "Bonjour Chef",
    dataUnavailable: "Données locales indisponibles", resetData: "Réinitialiser mes données",
    resetDataConfirm: "Effacer toutes tes données ? Cette action est irréversible.",
    pantry: "Garde-manger", newIngredient: "Nouvel ingrédient", addIngredient: "Ajouter un ingrédient",
    searchPlaceholder: "Rechercher un ingrédient…", pantryFilterPlaceholder: "Filtrer le garde-manger…",
    allCategories: "Tous", createCustom: (q) => `Créer "${q}"`, noMatch: "Aucun résultat dans le catalogue",
    noFilterMatch: "Aucun ingrédient ne correspond.",
    supplier: "fournisseur", newSupplier: "Nouveau fournisseur",
    recipes: "Recettes", newRecipe: "Nouvelle recette", newRecipeName: "Nouvelle recette",
    recipeListViewTooltip: "Vue liste", recipeGridViewTooltip: "Vue grille",
    ticket: "Ticket", overview: "Vue d'ensemble", recipeCol: "Recette", costPortionCol: "Coût/portion",
    sellPriceCol: "Prix vente TTC", marginCol: "Marge", noRecipes: "Aucune recette pour l'instant.",
    overviewHint: "Touche une ligne pour ouvrir le ticket. Couleur = distance à ta marge cible.",
    noRecipeYet: "Aucune recette. Crée-en une pour commencer.",
    duplicate: "Dupliquer", print: "Imprimer", printTicket: "Imprimer (avec prix)", portions: "Portions", line: "Ajouter un ingrédient",
    qtyHintToggle: "Repères cuillères/pincées",
    qtyHintText: "1 cuillère à soupe ≈ 15g · 1 cuillère à café ≈ 5g · 1 pincée ≈ 1g (approximatif, à ajuster selon l'ingrédient).",
    total: "Coût total", costPerPortion: "Coût / portion", sellPriceTTC: "Prix de vente (TTC)",
    sellPriceHT: "Prix HT", vat: "TVA", targetMargin: "Marge cible", suggestedPrice: "Prix conseillé (TTC)",
    use: "Utiliser", marginLabel: "marge", lowMarginWarning: `En dessous de ${CRITICAL_MARGIN}%, à surveiller`,
    marginExcellentTitle: "Marge excellente", marginExcellentDetail: "Déjà au-dessus de ton objectif, aucun ajustement de prix nécessaire.",
    simulateHigherMargin: (v) => `Simuler ${v}%`,
    excellentMarginBadge: "Rentabilité optimale",
    notes: "Notes / Instructions", notesPlaceholder: "Ex : Faire mariner la viande, mijoter 3h, dresser avec persil…",
    allergens: "Allergènes", allergensPlaceholder: "ex : gluten, lait, céleri…",
    allergensAutoBadge: "détecté auto", allergensReset: "Revenir à la détection auto",
    createdOn: "Créé le", settings: "Paramètres", logout: "Se déconnecter", defaultVat: "TVA par défaut",
    minMarginLabel: "Marge minimale souhaitée", close: "Fermer",
    emailRemindersLabel: "Recevoir les rappels par email",
    emailRemindersHint: "Un rappel si tu n'as rien scanné depuis un moment, ou si une recette passe sous ta marge cible.",
    billingTrialBanner: (n) => n > 1 ? `Essai gratuit : ${n} jours restants` : n === 1 ? "Essai gratuit : dernier jour" : "Essai gratuit : se termine aujourd'hui",
    billingPaywallTitle: "Ton essai gratuit est terminé", billingPaywallBody: (p) => `Abonne-toi pour continuer à utiliser Chefup — ${p}€/mois, résiliable à tout moment.`,
    billingFounderStory: "Chefup est né d'une vraie expérience en restauration — recalculer ses marges à la main à chaque hausse de prix fournisseur, ça rend fou.",
    billingBenefit1: "Scan de facture automatique par IA", billingBenefit2: "Marge recalculée à l'instant à chaque changement de prix", billingBenefit3: "Alerte dès qu'un plat descend sous ta marge cible",
    billingPaywallReminder: "Tes recettes et leurs marges déjà calculées t'attendent — ne perds pas ce que tu as construit.",
    // Offre de lancement (2026-08-26) — 50 places, tarif bloqué à vie. Voir api/_lib.js.
    launchBadge: "Offre de lancement",
    launchSpotsLeft: (n) => (n > 1 ? `Plus que ${n} places sur 50` : n === 1 ? "Dernière place sur 50" : "Les 50 places sont prises"),
    launchFounderPrice: (f, s) => `${f}€/mois à vie au lieu de ${s}€`,
    launchForLife: "à vie",
    launchLifetimeLock: "Ce tarif reste le tien tant que ton abonnement reste actif, même quand le prix augmentera.",
    launchCondition: "Ta place est réservée dès ton inscription et confirmée si tu t'abonnes avant la fin de tes 7 jours d'essai.",
    launchTrialBanner: (n, f) =>
      n > 1
        ? `Tarif fondateur ${f}€/mois à vie : encore ${n} jours pour le garder`
        : n === 1
        ? `Tarif fondateur ${f}€/mois à vie : dernier jour pour le garder`
        : `Tarif fondateur ${f}€/mois à vie : ça se termine aujourd'hui`,
    launchPaywallTitle: (f) => `Garde ton tarif fondateur : ${f}€/mois à vie`,
    billingSubscribeButton: "S'abonner maintenant", billingSecureNote: "Paiement sécurisé par Stripe.", billingCheckoutError: "Impossible d'ouvrir la page de paiement, réessaie dans un instant.",
    billingManageSubscription: "Abonnement", billingPortalError: "Impossible d'ouvrir la page d'abonnement, réessaie dans un instant.",
    myAccount: "Mon compte",
    installAppButton: "Installer l'app", installModalTitle: "Installer Chefup",
    installBannerText: "Installe Chefup sur ton téléphone pour l'ouvrir en un tap, comme une vraie app.",
    installDiagramShareLabel: "Partager", installDiagramMenuLabel: "Menu", installDiagramHomeLabel: "Écran d'accueil", installDiagramInstallLabel: "Installer",
    installInstructionsIOS: "Appuie sur le bouton Partager (le carré avec la flèche) en bas de Safari, puis choisis « Sur l'écran d'accueil ».",
    installInstructionsIOSChrome: "Appuie sur le bouton Partager ou le menu ⋯ de Chrome (selon la position sur ton téléphone), puis choisis « Ajouter à l'écran d'accueil ».",
    installInstructionsAndroid: "Appuie sur le menu ⋮ de Chrome, puis choisis « Installer l'application » (ou « Ajouter à l'écran d'accueil »).",
    installInstructionsGeneric: "Cherche « Ajouter à l'écran d'accueil » ou « Installer l'application » dans le menu de ton navigateur.",
    contactButton: "Nous contacter", contactModalTitle: "Nous contacter",
    contactHint: "Un bug, une idée d'amélioration ? Écris-nous, on te répond directement par email.",
    contactPlaceholder: "Décris ton problème ou ta suggestion...",
    contactAttachButton: "Joindre une capture d'écran",
    contactSendButton: "Envoyer", contactSuccessMessage: "Message envoyé ! On te répond généralement sous 24-48h.",
    contactError: "Erreur pendant l'envoi, réessaie.",
    scanInvoice: "Scanner une facture", scanning: "Analyse de la facture en cours…",
    scanError: "Erreur pendant l'analyse", scanRetry: "Réessayer",
    // ---- Échecs de scan (2026-08-24) : jamais de détail technique, toujours une cause
    // compréhensible + des actions concrètes. Codes gérés : voir SCAN_ERR_CODES dans le composant.
    scanningPatience: "Ça peut prendre 1 à 2 minutes sur une facture longue ou dense — reste sur cet écran, ne le ferme pas.",
    scanSplitTip: "Facture de plus de 15 lignes ? Coupe-la en plusieurs photos (haut/bas, ou en 3 si elle est vraiment longue) plutôt qu'une seule — c'est nettement plus fiable qu'une seule photo très dense.",
    scanStep_prepare: "Préparation du document…",
    scanStep_ocr: "Lecture du texte…",
    scanStep_ai: "Analyse des lignes…",
    scanErrWhatToDo: "Ce que tu peux faire",
    scanRetrySamePhoto: "Réessayer avec la même photo",
    scanRetryOtherFile: "Autre fichier",
    scanReportProblem: "Nous signaler",
    scanReportPrefill: "Bonjour, je n'arrive pas à scanner ma facture. Voici ce que je faisais :",
    scanErrTitle_offline: "Connexion perdue",
    scanErrBody_offline: "Ta facture n'a pas pu être envoyée : l'appareil n'était plus connecté à internet pendant l'analyse.",
    scanErrTips_offline: ["Vérifie ton wifi ou tes données mobiles", "Éloigne-toi des murs épais si tu es en réserve ou en cave", "Puis appuie sur Réessayer : ta photo est gardée, rien à reprendre"],
    scanErrTitle_ai_timeout: "L'analyse a été trop longue",
    scanErrBody_ai_timeout: "Le document n'a pas pu être analysé dans le temps imparti. C'est presque toujours une facture très chargée ou une connexion lente.",
    scanErrTips_ai_timeout: ["Ta facture fait 40 lignes ou plus ? C'est presque toujours la cause : coupe-la en 2 ou 3 photos, jamais une seule photo pour un document aussi long", "Sinon, réessaie une fois : ça passe parfois du deuxième coup", "Si ton fournisseur t'envoie un PDF, utilise-le : c'est plus rapide et plus fiable qu'une photo"],
    scanErrTitle_ai_busy: "Trop de demandes en ce moment",
    scanErrBody_ai_busy: "L'analyse est momentanément saturée. Rien n'est perdu de ton côté.",
    scanErrTips_ai_busy: ["Attends une minute, puis appuie sur Réessayer", "Si ça se reproduit trois fois de suite, préviens-nous : on regarde tout de suite"],
    scanErrTitle_ai_unavailable: "Analyse indisponible pour le moment",
    scanErrBody_ai_unavailable: "Le souci vient de notre côté, pas de ta facture ni de ton téléphone. Aucune de tes données n'est touchée.",
    scanErrTips_ai_unavailable: ["Réessaie dans quelques minutes", "Si c'est toujours bloqué, appuie sur « Nous signaler » : le message part avec ce qu'il nous faut pour comprendre, et on te répond", "En attendant, tu peux saisir tes prix à la main dans le garde-manger"],
    scanErrTitle_ai_unreadable: "Résultat inexploitable",
    scanErrBody_ai_unreadable: "Le document a bien été reçu, mais l'analyse n'a rien renvoyé d'utilisable.",
    scanErrTips_ai_unreadable: ["Réessaie : le résultat change souvent d'un essai à l'autre", "Recadre sur le tableau des produits, sans le reste de la page", "Si tu as le PDF du fournisseur, envoie-le plutôt que la photo"],
    scanErrTitle_file_unreadable: "Fichier impossible à ouvrir",
    scanErrBody_file_unreadable: "Ce fichier n'a pas pu être lu comme une image ni comme un PDF. Certains formats de photo ne sont pas reconnus par le navigateur.",
    scanErrTips_file_unreadable: ["Reprends la facture en photo directement depuis Chefup", "Ou choisis la photo dans ta galerie plutôt que dans l'application Fichiers", "Un PDF envoyé par ton fournisseur fonctionne aussi très bien"],
    scanErrTitle_file_password_protected: "PDF protégé par un mot de passe",
    scanErrBody_file_password_protected: "Ce PDF demande un mot de passe pour être ouvert — Chefup ne peut pas l'analyser tant que la protection n'est pas retirée.",
    scanErrTips_file_password_protected: ["Ouvre le PDF et enregistre-le/exporte-le à nouveau sans mot de passe, puis réessaie", "Ou prends simplement la facture en photo à la place", "Si tu ne sais pas retirer la protection, demande à ton fournisseur de t'envoyer une version sans mot de passe"],
    scanErrTitle_file_pdf_ios_issue: "Souci de lecture PDF sur iPhone",
    scanErrBody_file_pdf_ios_issue: "Les iPhone ont un bug connu pour lire certains PDF depuis une app web — ça touche tous les navigateurs de l'iPhone (Safari, Chrome...), pas qu'un seul en particulier.",
    scanErrTips_file_pdf_ios_issue: ["Prends la facture en photo à la place : ça fonctionne très bien et évite complètement ce souci", "Changer de navigateur sur iPhone ne réglera rien, ils ont tous le même souci", "Sur ordinateur ou Android, ce PDF fonctionnerait probablement sans problème"],
    scanErrTitle_file_too_big: "Document trop lourd",
    scanErrBody_file_too_big: "Le fichier envoyé dépasse la taille acceptée.",
    scanErrTips_file_too_big: ["Prends la facture en photo depuis Chefup plutôt que d'envoyer un fichier très lourd", "Si c'est un PDF de plusieurs dizaines de pages, envoie seulement la page des produits"],
    scanErrTitle_bad_request: "Document non reçu",
    scanErrBody_bad_request: "Aucun document exploitable n'est arrivé jusqu'à l'analyse.",
    scanErrTips_bad_request: ["Recommence en sélectionnant à nouveau ta facture", "Si ça se répète, préviens-nous"],
    scanErrTitle_auth_expired: "Ta connexion a expiré",
    scanErrBody_auth_expired: "Par sécurité, ta session s'est terminée pendant l'analyse. Ta facture n'a pas été perdue.",
    scanErrTips_auth_expired: ["Appuie sur Réessayer : dans la plupart des cas ça repart tout seul", "Si ça recommence, déconnecte-toi puis reconnecte-toi, et relance l'analyse", "Rien n'a été modifié dans ton garde-manger"],
    scanErrTitle_auth_required: "Connexion nécessaire",
    scanErrBody_auth_required: "L'analyse d'une facture demande d'être connecté à ton compte Chefup.",
    scanErrTips_auth_required: ["Appuie sur Réessayer", "Si le problème persiste, déconnecte-toi puis reconnecte-toi", "Rien n'a été modifié dans ton garde-manger"],
    scanErrTitle_unknown: "Le scan n'a pas abouti",
    scanErrBody_unknown: "Quelque chose s'est mal passé pendant l'analyse. Rien n'a été modifié dans ton garde-manger.",
    scanErrTips_unknown: ["Appuie sur Réessayer : ça suffit dans la plupart des cas", "Si le problème revient, appuie sur « Nous signaler » — on te répond vite", "Tes recettes et tes prix ne sont jamais touchés par un scan raté"],
    scanNoItemsTips: ["Recadre la photo sur le tableau des produits, sans l'en-tête ni le bas de page", "Pose la facture bien à plat, sans pli ni ombre, avec une bonne lumière", "Sur une facture longue, fais deux photos : la moitié haute, puis la moitié basse", "Si ton fournisseur t'envoie un PDF, utilise-le : c'est la méthode la plus fiable"],
    scanResultTitle: "Résultat du scan", scanImagePreviewLabel: "Voir l'image envoyée à l'IA (diagnostic)", scanRotateHint: "Photo de travers ? Pivote-la avant d'analyser.", scanAnalyzeButton: "Analyser", scanSupplier: "Fournisseur",
    scanDate: "Date", scanAssignTo: "Associer à", scanNewIngredient: "🆕 Nouvel ingrédient",
    scanLinkedSure: "Ingrédient existant", scanLinkedGuess: "Suggestion, vérifie",
    scanRenameWarning: (n) => `Remplace "${n}" partout où il est utilisé`,
    scanCreateSeparateLabel: (n) => `Créer "${n}" comme ingrédient séparé`,
    scanCreateSeparateHint: "L'ingrédient existant reste inchangé",
    scanPriceCorrected: "prix recalculé (total ÷ qté)",
    scanPriceCorrectedHint: "Le prix unitaire lu semblait incohérent avec le total, on l'a recalculé automatiquement.",
    scanPriceSame: "Prix inchangé", scanPriceDecrease: "Prix en baisse",
    scanBulkPackaging: "Conditionnement groupé — vérifie",
    scanPriceInconsistent: "Écart avec le total imprimé, vérifie",
    scanExpectedTotal: "attendu", scanPrintedTotal: "imprimé :",
    scanLowConfidence: "Lecture incertaine (document flou/dense) — compare avec le papier avant de valider",
    scanUnitChangeWarning: (oldU, newU) => `Cet ingrédient est utilisé dans au moins une recette en "${oldU}" — passer à "${newU}" changerait le sens des quantités déjà saisies. Vérifie ces recettes après import.`,
    scanConfirmUncertain: "Confirmer malgré le doute",
    scanPriceDoubtLabel: "Vérifie ce prix avant d'importer",
    scanBigChangeNote: "Écart de prix important par rapport à ton dernier prix — jette un œil avant d'importer.",
    scanManyUpWarning: "Plusieurs prix semblent en forte hausse par rapport à tes prix connus — vérifie que le document est bien net avant d'importer.",
    scanLowConfidenceBanner: "Photo un peu floue : vérifie bien les lignes en orange avant d'importer.",
    scanReviewSection: "À vérifier avant d'importer", scanSafeSection: "Aucune alerte détectée",
    scanSafeHint: "Ça ne veut pas dire que c'est forcément juste — vérifie les prix avant de confirmer.",
    scanSummaryNew: (name, price, unit) => `Tu vas créer "${name}" à ${price}€/${unit}.`,
    scanSummaryUpdate: (name, price, unit) => `Tu vas mettre à jour "${name}" à ${price}€/${unit}.`,
    scanItemsToReview: (n) => `${n} produit${n > 1 ? "s" : ""} à vérifier`,
    scanVerifyOneByOne: "Vérifier un par un", scanValidate: "Valider", scanModify: "Modifier",
    viewDetailsLabel: "Modifier",
    viewDetailsTooltip: "Prix, catégorie, pertes, fournisseurs...", unitToggleTooltip: "Changer d'unité",
    pickerSearchPlaceholder: "Tape 2 lettres…", pickerTypeToSearch: "Tape pour chercher…", pickerNoResults: "Aucun résultat",
    unitPieceLabel: "pièce", unitFieldLabel: "Unité",
    quickAddNamePlaceholder: "Ajouter un ingrédient…", quickAddKnown: "connu", quickAddButton: "Ajouter",
    quickAddPriceLabel: "prix",
    scalePortionsLabel: "Adapter les quantités pour", scalePortionsButton: "Recalculer",
    quickAddHint: "Entrée pour passer à la quantité, Entrée pour ajouter.",
    legacyPantryHint: "Ton garde-manger contient encore l'ancienne liste de démonstration (~200 ingrédients). Charge la nouvelle version allégée (7 ingrédients essentiels) pour repartir sur une base plus claire.",
    legacyPantryButton: "Charger le nouveau garde-manger",
    cancelLabel: "Annuler", resetConfirmButton: "Oui, tout réinitialiser",
    welcomeBannerText: "Bienvenue sur Chefup ! La recette ci-dessous est un exemple avec des prix fictifs, pour te montrer comment l'app calcule tes marges. Scanne ta première vraie facture pour remplacer ces prix par les tiens.",
    welcomeBannerButton: "Scanner ma première facture",
    firstIngredientPrompt: "Ajoute ton premier ingrédient",
    marginLegendToggle: "Que veulent dire les couleurs ?",
    deleteLineTooltip: "Retirer cet ingrédient de la recette",
    editLinePriceTooltip: "Corriger le prix (met à jour le garde-manger)",
    lineUnitMismatchWarning: (oldU, newU) => `Cet ingrédient est passé de "${oldU}" à "${newU}" depuis la saisie de cette quantité — vérifie qu'elle est toujours correcte.`,
    recipeUnitMismatchHint: "Une unité d'ingrédient a changé depuis la saisie — vérifie les quantités",
    ingredientsSectionLabel: "Ingrédients", pricingSectionLabel: "Prix & marge",
    scanStackProgress: (cur, total) => `${cur} / ${total} à vérifier`,
    scanAllReviewed: "Tout est vérifié !", scanAllReviewedDetail: "Les mises à jour sont prêtes à être importées au garde-manger.", scanContinue: "Continuer",
    scanSkipAllAndClose: "Ignorer le reste et fermer",
    scanUpcoming: "Suivants",
    scanExistingLabel: "existant", scanProposedLabel: "nom proposé",
    scanRawLabelPrefix: "Facture :",
    scanChooseNameLabel: "Quel nom garder ?",
    scanRelinkLabel: "Relier à un autre ingrédient / créer nouveau :",
    scanKeepName: "Garder l'existant", scanUseNewName: "Utiliser ce nouveau nom",
    scanPricingUnknown: "Prix par pièce/sachet détecté",
    scanPricingUnknownHint: "Ce produit se vend au poids/volume, mais le poids ou volume d'une pièce n'est pas indiqué sur ce document. Indique-le ci-dessous pour calculer le prix au kilo/litre automatiquement :",
    scanCalcSourcePrice: "Prix lu sur la facture",
    scanCalcContentLabel: "Poids ou volume d'une pièce",
    scanCalcResult: (price, unit) => `= ${price} €/${unit}`,
    scanSearchIngredientPlaceholder: "Rechercher un ingrédient existant…",
    scanBackToCard: "Retour",
    scanSkip: "Ne pas ajouter cet ingrédient", scanSkippedSection: "Ignorés", scanUndoSkip: "Annuler",
    scanDoneSection: "Déjà ajoutés",
    scanNonFoodExcluded: (n) => `${n} article${n > 1 ? "s" : ""} écarté${n > 1 ? "s" : ""} du garde-manger (non-alimentaire ou consigne/frais — clique pour en récupérer un) :`,
    scanRestoreNonFood: "Ajouter quand même à la vérification",
    scanRestoreDeposit: "Consigne / frais (port, service...) — ajouter quand même à la vérification",
    scanPriceLabel: "Prix (modifiable) :",
    estimatedPriceBadge: "estimé", estimatedPriceHint: "Prix de départ estimé, jamais confirmé par un scan ou une saisie manuelle — vérifie-le avec ton vrai fournisseur.",
    estimatedPriceLegend: "Prix estimé, pas encore vérifié avec ton fournisseur",
    lossPercentLabel: "Rendement / Perte (%)",
    lossLineBadge: (pct) => `Perte ${pct}%`,
    declareLossesButton: "Pertes à la découpe / épluchage",
    declareLossesTitle: "Pertes de préparation",
    declareLossesHint: "Renseigne ici le % perdu à la découpe, au parage ou à l'épluchage pour chaque ingrédient de cette recette (ex : 20% sur du poisson brut). Le coût réel de la recette en tient compte automatiquement, et ça s'applique partout où l'ingrédient est utilisé, pas seulement dans cette recette.",
    priceVariationHint: "Variation par rapport à la dernière mise à jour de prix de cet ingrédient",
    suggestionTitle: "Piste d'optimisation :",
    suggestionProtein: "Cette marge est sous ton objectif. Pistes : réajuster légèrement le grammage de la protéine, ou augmenter le prix de vente.",
    suggestionFeculent: "Cette marge est sous ton objectif. Pistes : ajuster la portion de féculent/accompagnement, ou le prix de vente.",
    suggestionOtherWithIngredient: (name) => `Cette marge est sous ton objectif. L'ingrédient le plus coûteux de cette recette est ${name} — revois son dosage, ou ajuste le prix de vente.`,
    suggestionOther: "Cette marge est sous ton objectif. Pistes : ajuste le prix de vente, ou revois le dosage des ingrédients les plus chers.",
    pantryEmptyPrompt: "Choisis une catégorie ci-dessus ou lance une recherche pour voir tes ingrédients.",
    coefLabel: "Coef.",
    printRecipeSheet: "Imprimer la fiche recette", printMenuLabel: "Imprimer",
    exampleRecipeBadge: "Recette exemple",
    wizardStep1Title: "Modifier ou créer un ingrédient", wizardPriceStepTitle: "Prix et unité", wizardCategoryStepTitle: "Quelle catégorie ?",
    wizardEstimatePrice: "Pas le prix sous les yeux ? Estimer un prix temporaire",
    wizardBack: "Précédent", wizardNext: "Suivant", wizardSave: "Enregistrer", wizardCreate: "Créer l'ingrédient",
    wizardSuccess: "Ajouté au garde-manger !", wizardUpdated: "Prix mis à jour !",
    wizardExistingSection: "Ingrédients existants — modifier le prix", wizardCatalogSection: "Suggestions",
    wizardSearchHint: "Tape le nom d'un ingrédient pour le chercher ou en créer un nouveau.",
    recentIngredients: "Récents", noRecentIngredients: "Aucun ingrédient scanné ou modifié récemment.",
    selectAllRecent: "Tout sélectionner", deselectAll: "Tout désélectionner",
    deleteSelectedButton: (n) => `Supprimer (${n})`,
    deleteSelectedConfirm: (n) => `Supprimer définitivement ${n} ingrédient${n > 1 ? "s" : ""} sélectionné${n > 1 ? "s" : ""} ? Cette action est irréversible.`,
    pantryOnboardingHint: "Ces prix sont juste des exemples pour la recette de démonstration. Scanne tes propres factures pour remplir ton garde-manger avec tes vrais prix fournisseurs.",
    pantryReclassifyHint: (n) => `${n} ingrédient${n > 1 ? "s" : ""} dans "Autres" peuvent être classés automatiquement.`,
    pantryReclassifyButton: "Classer maintenant",
    categoryLabel: "Catégorie",
    recentToday: "Aujourd'hui", recentWeek: "Cette semaine", recentMonth: "Ce mois-ci",
    deleteRecipeConfirm: (name) => `Supprimer définitivement la recette "${name}" ?`,
    allergenSheetLink: "Fiche allergènes", allergenSheetTitle: "Fiche allergènes — toutes les recettes",
    allergenSheetNone: "Aucun allergène renseigné",
    digitalMenuButton: "Carte digitale", digitalMenuTitle: "Ma carte digitale",
    digitalMenuHint: "Génère une carte publique (avec QR code) à partir de tes recettes. Elle se met à jour toute seule dès que tu changes un prix.",
    digitalMenuPublishLabel: "Publier ma carte", digitalMenuPublishHint: "Tant que c'est désactivé, personne ne peut voir la carte, même avec le lien.",
    digitalMenuRestaurantNameLabel: "Nom du restaurant", digitalMenuRestaurantNamePlaceholder: "ex : Chez Marge",
    digitalMenuDesignLabel: "Design", digitalMenuDesignClassic: "Classique", digitalMenuDesignModern: "Moderne",
    digitalMenuDesignElegant: "Élégant", digitalMenuDesignBistro: "Bistrot",
    digitalMenuCategoriesLabel: "Sections de la carte", digitalMenuCategoryAdd: "Ajouter",
    digitalMenuCategoryAddPlaceholder: "ex : Pizzas, Sauces…",
    digitalMenuSimpleItemsLabel: "Articles simples (boissons, etc.)",
    digitalMenuSimpleItemsHint: "Pour ce qui est revendu tel quel (Coca, Perrier…) — pas besoin de créer une recette.",
    digitalMenuSimpleItemNamePlaceholder: "Nom (ex : Coca 33cl)",
    digitalMenuSimpleItemCostLabel: "Coût d'achat :", digitalMenuSimpleItemAddCost: "+ ajouter un coût d'achat",
    digitalMenuConvertToRecipe: "Connaître sa marge",
    digitalMenuCopyLink: "Copier le lien", digitalMenuLinkCopied: "Copié !", digitalMenuDownloadQr: "Télécharger le QR code",
    digitalMenuRecipesLabel: "Recettes affichées sur la carte", digitalMenuNoRecipes: "Crée une recette pour pouvoir l'ajouter à la carte.",
    digitalMenuDescriptionPlaceholder: "Description pour le client (optionnel)",
    publicMenuNotAvailable: "Cette carte n'est pas disponible pour le moment.",
    publicMenuNoDishes: "Aucun plat sur la carte pour le moment.",
    publicMenuPoweredBy: "Carte générée avec Chefup",
    digitalMenuLogoLabel: "Logo", digitalMenuLogoUpload: "Choisir une image", digitalMenuLogoRemove: "Retirer",
    digitalMenuLogoError: "Image illisible, réessaie avec une autre photo.",
    digitalMenuPreview: "Voir la carte", digitalMenuTranslateHint: "Traduire vers :",
    digitalMenuTranslateError: "Traduction impossible, réessaie.", digitalMenuTranslating: "Traduction en cours…",
    digitalMenuCategoryNone: "Sans section",
    scanImport: "Ajouter au garde-manger", scanImported: "Ajouté au garde-manger ✓", scanImportAll: "Importer ces lignes",
    scanPriceIncrease: "Prix en hausse", scanNoItems: "Aucun produit identifié avec certitude sur ce document — plutôt que d'inventer, l'app préfère ne rien proposer. Réessaie avec une photo plus nette, mieux cadrée sur le tableau des produits (sans le reste de la page), ou envoie un PDF si tu en as un.",    scanHint: "Vérifie et corrige chaque ligne avant d'importer — l'IA peut se tromper.",
    scanWeightLabel: "Poids d'1 pièce (laisse à 0 si vraiment à l'unité) :",
    scanRecipeButton: "Scanner une fiche", scanningRecipe: "Lecture de la fiche en cours…",
    scanRecipeResultTitle: "Fiche recette scannée",
    scanRecipeHint: "Vérifie le nom des ingrédients, les quantités et les rapprochements avant de créer la recette — l'IA peut se tromper. Fonctionne mieux sur une fiche recette simple (liste d'ingrédients directe) ; une fiche pro très détaillée avec plusieurs sous-recettes (sauces, bases...) demandera plus de vérification.",
    scanRecipeIngredientsLabel: "Ingrédients détectés", scanRecipeNoLines: "Aucun ingrédient détecté — tu pourras les ajouter manuellement.",
    scanRecipeImpreciseWarning: (raw) => `Quantité imprécise sur la fiche ("${raw}") — indique le poids/volume réel`,
    scanRecipeCreateButton: "Créer la recette", scanRecipeRemoveLine: "Retirer cette ligne",
    scanTab: "Scanner", scanTabHint: "Importe le PDF de ta facture Métro, Promocash, Transgourmet (ou prends-la en photo) — l'IA s'occupe du reste.",
    scanTabHintIOS: "Prends ta facture en photo — l'IA s'occupe du reste. (Le PDF n'est pas encore disponible sur iPhone, un bug d'Apple empêche pour l'instant de le lire de façon fiable.)",
    scanTakePhoto: "Prendre une photo", scanUploadFile: "Importer un fichier (PDF, photo...)", scanUploadFileIOS: "Importer une photo (galerie)",
    scanRecommendedBadge: "Recommandé — plus précis",
    scanTipTitle: "💡 Astuce pour un scan optimal :",
    scanTipBody: "Pour une précision maximale, privilégie l'import du fichier PDF original de ton fournisseur (METRO, Transgourmet, etc.). Si tu prends une photo, pose la facture bien à plat sous une bonne lumière. Attention : le flou, les ombres, les pliures et les reflets altèrent la précision de l'IA.",
    scanTipBodyIOS: "Facture reçue en PDF (par mail, etc.) ? Ouvre-la, mets ton téléphone à l'horizontale si le tableau est large pour bien voir la colonne des prix, puis fais une CAPTURE D'ÉCRAN (pas une photo à l'appareil) — c'est net et net vaut mieux que flou. Si tout ne rentre pas dans une seule capture, fais-en 2 (gauche/droite ou haut/bas). Importe ensuite la ou les captures avec le bouton \"Importer une photo\" ci-dessus : elles sont dans ta pellicule comme n'importe quelle photo.",
    scanColisUnit: "colis",
    marginExcellentMsg: "Marge excellente !", marginGoodMsg: "Belle marge, tu es au-dessus de ton objectif.",
    marginCloseMsg: "Juste en dessous de ta marge souhaitée, mais la marge reste bonne sur ce plat.",
    marginWatchMsg: "En dessous de ta marge souhaitée — à surveiller sur ce plat.",
    marginLowMsg: "Marge largement insuffisante : ce plat n'est pas assez rentable en l'état.",
    marginLowFixMsg: "Marge insuffisante, à corriger rapidement.",
    vatOption10Hint: "restauration FR/ES", vatOption21Hint: "TVA Espagne",
    recipeLineIngredientPlaceholder: "Choisir un ingrédient…",
    recipeCreateIngredientFromLine: "Créer un nouvel ingrédient",
    recipeTargetReached: "Objectif de cette recette atteint",
    marginLegendWithOrange: (green, crit) => `Vert ≥ ${green}% · Orange entre ${crit}–${green}% · Rouge < ${crit}%`,
    marginLegendNoOrange: (crit) => `Vert ≥ ${crit}% · Rouge < ${crit}% (pas de zone orange avec ce seuil)`,
    deleteRecipeButton: "Supprimer cette recette",
    deleteLabel: "Supprimer", deleteIngredientButton: "Supprimer l'ingrédient",
    authLoginTitle: "Connexion", authSignupTitle: "Créer un compte", authForgotTitle: "Mot de passe oublié", authResetTitle: "Nouveau mot de passe",
    authEmailLabel: "Email", authPasswordLabel: "Mot de passe", authNewPasswordLabel: "Nouveau mot de passe", authConfirmPasswordLabel: "Confirme le mot de passe",
    authEmailPlaceholder: "toi@exemple.com", authPasswordPlaceholder: "6 caractères minimum", authConfirmPasswordPlaceholder: "Retape le même mot de passe",
    authLoginButton: "Se connecter", authSignupButton: "Créer mon compte", authForgotButton: "Envoyer le lien de réinitialisation", authResetButton: "Valider le nouveau mot de passe",
    authForgotLink: "Mot de passe oublié ?", authSwitchToSignup: "Pas encore de compte ? Créer un compte", authSwitchToLogin: "Déjà un compte ? Se connecter", authBackToLogin: "Retour à la connexion",
    authSignupSuccessInfo: "Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse (regarde aussi tes spams/courriers indésirables), puis connecte-toi.",
    authForgotSuccessInfo: "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.",
    authContinueButton: "Continuer", authMagicLinkSignupButton: "Recevoir un code par email",
    authMagicLinkButton: "Recevoir un code par email", authMagicLinkInfo: "Code envoyé ! Vérifie ta boîte mail (et tes spams).",
    authOrDivider: "ou",
    authOtpTitle: "Vérifie ton email", authOtpSubtitle: (email) => `On vient d'envoyer un code à ${email}.`,
    authOtpVerifyButton: "Valider le code", authOtpResend: "Renvoyer le code", authOtpBack: "← Retour",
    authErrorOtpInvalid: "Code incorrect ou expiré. Réessaie, ou renvoie un nouveau code.",
    authErrorRateLimit: "Trop de tentatives — réessaie dans une minute.",
    authErrorInvalidCredentials: "Email ou mot de passe incorrect.", authErrorAlreadyRegistered: "Un compte existe déjà avec cet email.",
    authAlreadyRegisteredGoLogin: "Me connecter avec ce compte",
    authErrorEmailNotConfirmed: "Confirme d'abord ton adresse email avant de te connecter — le lien est parti par mail, pense à vérifier aussi tes spams/courriers indésirables.",
    authResendConfirmationButton: "Renvoyer le mail de confirmation",
    authResendConfirmationSent: "Mail renvoyé ! Vérifie ta boîte de réception ET tes spams.",
    authErrorPasswordTooShort: "Le mot de passe doit contenir au moins 6 caractères.", authErrorInvalidEmail: "Adresse email invalide.",
    authErrorGeneric: "Une erreur est survenue. Réessaie.", authErrorPasswordMismatch: "Les deux mots de passe ne correspondent pas.",
    authTagline: "Calcule tes marges en toute simplicité", authSignupFreeNote: "7 jours d'essai gratuit, aucune carte bancaire requise.",
    landingHeroTitle: "Ta carte cache des plats qui te coûtent de l'argent",
    landingHeroSubtitle: "Rentre tes chiffres, regarde ta vraie marge. Ça prend 10 secondes.",
    landingHowItWorksTitle: "Comment ça marche",
    landingStep1Title: "Scanne ta facture", landingStep1Desc: "Photo ou fichier — les prix de ton garde-manger se mettent à jour tout seuls.",
    landingStep2Title: "Ta marge se calcule", landingStep2Desc: "Coût, TVA, prix de vente : ta marge apparaît instantanément, plat par plat.",
    landingStep3Title: "Génère ta carte digitale", landingStep3Desc: "Un QR code avec tes prix toujours à jour, sans jamais rien retaper.",
    landingPreviewDish: "Bœuf bourguignon", landingPreviewMarginLabel: "de marge",
    landingPreviewCost: "Coût / portion", landingPreviewPrice: "Prix de vente",
    landingCtaStart: "Commencer gratuitement", landingCtaLogin: "J'ai déjà un compte",
    landingFeatureScanTitle: "Scan de factures par IA", landingFeatureScanDesc: "Prends en photo ou importe ta facture : les prix de ton garde-manger se mettent à jour tout seuls.",
    landingFeatureMarginTitle: "Marge par recette en temps réel", landingFeatureMarginDesc: "Coût des ingrédients, TVA, prix de vente : ta marge se recalcule instantanément à chaque changement.",
    landingFeaturePrintTitle: "Fiches prêtes à imprimer", landingFeaturePrintDesc: "Fiche technique (avec ou sans prix) et fiche allergènes de toutes tes recettes, prêtes pour la cuisine ou un contrôle.",
    landingFeatureMenuTitle: "Carte digitale avec QR code", landingFeatureMenuDesc: "Génère une carte publique à partir de tes recettes — le prix se met à jour tout seul dès que tu le changes dans l'app.",
    landingFeaturePantryTitle: "Garde-manger multi-fournisseurs", landingFeaturePantryDesc: "Historique des prix, plusieurs fournisseurs par ingrédient, pertes à la préparation prises en compte.",
    calcTitle: "Essaie tout de suite",
    calcSubtitle: "Prends un de tes plats, mets tes chiffres.",
    calcCostLabel: "Ce que te coûtent les ingrédients, par portion",
    calcPriceLabel: "Ton prix de vente, TTC",
    calcResultLabel: "Ta marge",
    calcVerdictHigh: "Bonne marge, ce plat travaille pour toi.",
    calcVerdictMid: "Marge correcte, mais il y a mieux à faire.",
    calcVerdictLow: "Marge trop faible : ce plat te coûte plus qu'il ne te rapporte.",
    calcVatNote: (v) => `Calculé hors taxes, TVA ${v}% (restauration sur place) — exactement comme dans l'app.`,
    firstRunTitle: "Ton premier plat",
    firstRunHint: "On crée sa fiche tout de suite. Tu ajouteras ses ingrédients juste après, et sa marge apparaîtra.",
    firstRunDishLabel: "Nom du plat",
    firstRunDishPlaceholder: "Burger maison, salade César…",
    firstRunPriceLabel: "Ton prix de vente, TTC",
    firstRunPriceHint: "Le prix d'une assiette, tel qu'il est sur ta carte.",
    firstRunCreate: "Créer ma fiche recette",
    firstRunSkip: "Passer, je regarde par moi-même",
    calcMoreTitle: "Ça, c'est un plat. Dans Chefup :",
    calcMore1: "Ce coût se remplit tout seul : tu photographies ta facture, les prix se mettent à jour dans tes recettes.",
    calcMore2: "Toute ta carte est recalculée à chaque hausse de prix fournisseur, et tu es alerté quand un plat passe sous ton objectif.",
    calcMore3: "Fiches techniques, fiche allergènes imprimables et carte digitale avec QR code comprises.",
    calcCta: "Faire ça pour toute ma carte",
    landingPricingTitle: "Un seul tarif, tout inclus", landingPricingTrial: "7 jours d'essai gratuit, sans carte bancaire",
    landingPricingCta: "Démarrer mon essai gratuit", landingPricingPerMonth: "/ mois",
    landingLegalNotice: "Mentions légales", landingTerms: "CGV", landingPrivacy: "Confidentialité",
    consentText: "On aimerait mesurer si la publicité qui t'a amené ici fonctionne. Ça implique un traceur TikTok. Tu peux refuser, le site marche exactement pareil.",
    consentAccept: "Accepter", consentRefuse: "Refuser",
    landingPricingFeature1: "Recettes et marges illimitées", landingPricingFeature2: "Scan de factures par IA",
    landingPricingFeature3: "Fiches techniques & allergènes imprimables", landingPricingFeature4: "Carte digitale avec QR code", landingPricingFeature5: "Résiliable à tout moment",
  },
  es: {
    appTitle: "Chefup", saved: "Guardado", loading: "Cargando…", greeting: "Hola Chef",
    dataUnavailable: "Datos locales no disponibles", resetData: "Restablecer mis datos",
    resetDataConfirm: "¿Borrar todos tus datos? Esta acción es irreversible.",
    pantry: "Despensa", newIngredient: "Nuevo ingrediente", addIngredient: "Añadir ingrediente",
    searchPlaceholder: "Buscar un ingrediente…", pantryFilterPlaceholder: "Filtrar la despensa…",
    allCategories: "Todos", createCustom: (q) => `Crear "${q}"`, noMatch: "Sin resultados en el catálogo",
    noFilterMatch: "Ningún ingrediente coincide.",
    supplier: "proveedor", newSupplier: "Nuevo proveedor",
    recipes: "Recetas", newRecipe: "Nueva receta", newRecipeName: "Nueva receta",
    recipeListViewTooltip: "Vista lista", recipeGridViewTooltip: "Vista cuadrícula",
    ticket: "Ticket", overview: "Resumen", recipeCol: "Receta", costPortionCol: "Coste/ración",
    sellPriceCol: "Precio venta IVA inc.", marginCol: "Margen", noRecipes: "Todavía no hay recetas.",
    overviewHint: "Toca una fila para abrir el ticket. Color = distancia a tu margen objetivo.",
    noRecipeYet: "No hay recetas. Crea una para empezar.",
    duplicate: "Duplicar", print: "Imprimir", printTicket: "Imprimir (con precios)", portions: "Raciones", line: "Añadir un ingrediente",
    qtyHintToggle: "Referencias cucharadas/pizcas",
    qtyHintText: "1 cucharada sopera ≈ 15g · 1 cucharadita ≈ 5g · 1 pizca ≈ 1g (aproximado, a ajustar según el ingrediente).",
    total: "Coste total", costPerPortion: "Coste / ración", sellPriceTTC: "Precio de venta (IVA inc.)",
    sellPriceHT: "Precio sin IVA", vat: "IVA", targetMargin: "Margen objetivo", suggestedPrice: "Precio sugerido (IVA inc.)",
    use: "Usar", marginLabel: "margen", lowMarginWarning: `Por debajo del ${CRITICAL_MARGIN}%, vigilar`,
    marginExcellentTitle: "Margen excelente", marginExcellentDetail: "Ya por encima de tu objetivo, sin necesidad de ajustar el precio.",
    simulateHigherMargin: (v) => `Simular ${v}%`,
    excellentMarginBadge: "Rentabilidad óptima",
    notes: "Notas / Instrucciones", notesPlaceholder: "Ej : Marinar la carne, cocinar a fuego lento 3h, emplatar con perejil…",
    allergens: "Alérgenos", allergensPlaceholder: "ej: gluten, lácteos, apio…",
    allergensAutoBadge: "detectado auto", allergensReset: "Volver a la detección automática",
    createdOn: "Creado el", settings: "Ajustes", logout: "Cerrar sesión", defaultVat: "IVA por defecto",
    minMarginLabel: "Margen mínimo deseado", close: "Cerrar",
    emailRemindersLabel: "Recibir recordatorios por email",
    emailRemindersHint: "Un aviso si hace tiempo que no escaneas nada, o si una receta baja de tu margen objetivo.",
    billingTrialBanner: (n) => n > 1 ? `Prueba gratuita: quedan ${n} días` : n === 1 ? "Prueba gratuita: último día" : "Prueba gratuita: termina hoy",
    billingPaywallTitle: "Tu prueba gratuita ha terminado", billingPaywallBody: (p) => `Suscríbete para seguir usando Chefup — ${p}€/mes, cancelable en cualquier momento.`,
    billingFounderStory: "Chefup nació de una experiencia real en restauración — recalcular tus márgenes a mano cada vez que sube un proveedor puede volverte loco.",
    billingBenefit1: "Escaneo automático de facturas por IA", billingBenefit2: "Margen recalculado al instante con cada cambio de precio", billingBenefit3: "Alerta en cuanto un plato baja de tu margen objetivo",
    billingPaywallReminder: "Tus recetas y sus márgenes ya calculados te esperan — no pierdas lo que has construido.",
    launchBadge: "Oferta de lanzamiento",
    launchSpotsLeft: (n) => (n > 1 ? `Solo quedan ${n} plazas de 50` : n === 1 ? "Última plaza de 50" : "Las 50 plazas están ocupadas"),
    launchFounderPrice: (f, s) => `${f}€/mes de por vida en lugar de ${s}€`,
    launchForLife: "de por vida",
    launchLifetimeLock: "Este precio sigue siendo tuyo mientras tu suscripción siga activa, incluso cuando el precio suba.",
    launchCondition: "Tu plaza se reserva al registrarte y se confirma si te suscribes antes de que acaben tus 7 días de prueba.",
    launchTrialBanner: (n, f) =>
      n > 1
        ? `Precio fundador ${f}€/mes de por vida: te quedan ${n} días para conservarlo`
        : n === 1
        ? `Precio fundador ${f}€/mes de por vida: último día para conservarlo`
        : `Precio fundador ${f}€/mes de por vida: termina hoy`,
    launchPaywallTitle: (f) => `Conserva tu precio fundador: ${f}€/mes de por vida`,
    billingSubscribeButton: "Suscribirme ahora", billingSecureNote: "Pago seguro con Stripe.", billingCheckoutError: "No se pudo abrir la página de pago, inténtalo de nuevo en un momento.",
    billingManageSubscription: "Suscripción", billingPortalError: "No se pudo abrir la página de suscripción, inténtalo de nuevo en un momento.",
    myAccount: "Mi cuenta",
    installAppButton: "Instalar la app", installModalTitle: "Instalar Chefup",
    installBannerText: "Instala Chefup en tu teléfono para abrirla en un toque, como una app de verdad.",
    installDiagramShareLabel: "Compartir", installDiagramMenuLabel: "Menú", installDiagramHomeLabel: "Pantalla de inicio", installDiagramInstallLabel: "Instalar",
    installInstructionsIOS: "Toca el botón Compartir (el cuadrado con la flecha) en la parte inferior de Safari y elige «Añadir a pantalla de inicio».",
    installInstructionsIOSChrome: "Toca el botón Compartir o el menú ⋯ de Chrome (según la posición en tu teléfono) y elige «Añadir a pantalla de inicio».",
    installInstructionsAndroid: "Toca el menú ⋮ de Chrome y elige «Instalar aplicación» (o «Añadir a pantalla de inicio»).",
    installInstructionsGeneric: "Busca «Añadir a pantalla de inicio» o «Instalar aplicación» en el menú de tu navegador.",
    contactButton: "Contáctanos", contactModalTitle: "Contáctanos",
    contactHint: "¿Un fallo, una idea de mejora? Escríbenos, te respondemos directamente por email.",
    contactPlaceholder: "Describe tu problema o tu sugerencia...",
    contactAttachButton: "Adjuntar una captura de pantalla",
    contactSendButton: "Enviar", contactSuccessMessage: "¡Mensaje enviado! Normalmente respondemos en 24-48h.",
    contactError: "Error al enviar, inténtalo de nuevo.",
    scanInvoice: "Escanear una factura", scanning: "Analizando la factura…",
    scanError: "Error durante el análisis", scanRetry: "Reintentar",
    scanningPatience: "Puede tardar 1-2 minutos en una factura larga o densa — quédate en esta pantalla, no la cierres.",
    scanSplitTip: "¿Factura de más de 15 líneas? Divídela en varias fotos (arriba/abajo, o en 3 si es muy larga) en vez de una sola — es mucho más fiable que una sola foto muy densa.",
    scanStep_prepare: "Preparando el documento…",
    scanStep_ocr: "Leyendo el texto…",
    scanStep_ai: "Analizando las líneas…",
    scanErrWhatToDo: "Qué puedes hacer",
    scanRetrySamePhoto: "Reintentar con la misma foto",
    scanRetryOtherFile: "Otro archivo",
    scanReportProblem: "Avisarnos",
    scanReportPrefill: "Hola, no consigo escanear mi factura. Esto es lo que estaba haciendo:",
    scanErrTitle_offline: "Conexión perdida",
    scanErrBody_offline: "Tu factura no se pudo enviar: el dispositivo perdió la conexión a internet durante el análisis.",
    scanErrTips_offline: ["Comprueba el wifi o los datos móviles", "Aléjate de los muros gruesos si estás en el almacén o la bodega", "Luego pulsa Reintentar: tu foto se ha guardado, no hay que repetirla"],
    scanErrTitle_ai_timeout: "El análisis ha tardado demasiado",
    scanErrBody_ai_timeout: "No se pudo analizar el documento a tiempo. Casi siempre es una factura muy cargada o una conexión lenta.",
    scanErrTips_ai_timeout: ["¿Tu factura tiene 40 líneas o más? Casi siempre es la causa: divídela en 2 o 3 fotos, nunca una sola foto para un documento tan largo", "Si no, reintenta una vez: a veces funciona al segundo intento", "Si tu proveedor te envía un PDF, úsalo: es más rápido y más fiable que una foto"],
    scanErrTitle_ai_busy: "Demasiadas peticiones ahora mismo",
    scanErrBody_ai_busy: "El análisis está saturado momentáneamente. No has perdido nada.",
    scanErrTips_ai_busy: ["Espera un minuto y pulsa Reintentar", "Si se repite tres veces seguidas, avísanos: lo miramos enseguida"],
    scanErrTitle_ai_unavailable: "Análisis no disponible por ahora",
    scanErrBody_ai_unavailable: "El problema es nuestro, no de tu factura ni de tu teléfono. Ninguno de tus datos se ve afectado.",
    scanErrTips_ai_unavailable: ["Reintenta dentro de unos minutos", "Si sigue bloqueado, pulsa «Avisarnos»: el mensaje sale con lo que necesitamos para entenderlo y te respondemos", "Mientras tanto, puedes introducir tus precios a mano en la despensa"],
    scanErrTitle_ai_unreadable: "Resultado inutilizable",
    scanErrBody_ai_unreadable: "El documento llegó bien, pero el análisis no devolvió nada aprovechable.",
    scanErrTips_ai_unreadable: ["Reintenta: el resultado suele cambiar de un intento a otro", "Reencuadra sobre la tabla de productos, sin el resto de la página", "Si tienes el PDF del proveedor, envíalo en vez de la foto"],
    scanErrTitle_file_unreadable: "No se puede abrir el archivo",
    scanErrBody_file_unreadable: "Este archivo no se pudo leer como imagen ni como PDF. El navegador no reconoce algunos formatos de foto.",
    scanErrTips_file_unreadable: ["Vuelve a fotografiar la factura directamente desde Chefup", "O elige la foto en tu galería en vez de en la aplicación Archivos", "Un PDF enviado por tu proveedor también funciona muy bien"],
    scanErrTitle_file_password_protected: "PDF protegido con contraseña",
    scanErrBody_file_password_protected: "Este PDF pide una contraseña para abrirse — Chefup no puede analizarlo mientras la protección no se retire.",
    scanErrTips_file_password_protected: ["Abre el PDF y guárdalo/expórtalo de nuevo sin contraseña, luego reintenta", "O simplemente fotografía la factura en su lugar", "Si no sabes quitar la protección, pide a tu proveedor una versión sin contraseña"],
    scanErrTitle_file_pdf_ios_issue: "Problema al leer el PDF en iPhone",
    scanErrBody_file_pdf_ios_issue: "Los iPhone tienen un problema conocido para leer ciertos PDF desde una app web — afecta a todos los navegadores del iPhone (Safari, Chrome...), no a uno en particular.",
    scanErrTips_file_pdf_ios_issue: ["Fotografía la factura en su lugar: funciona muy bien y evita este problema por completo", "Cambiar de navegador en el iPhone no solucionará nada, todos tienen el mismo problema", "En un ordenador o Android, este PDF probablemente funcionaría sin problema"],
    scanErrTitle_file_too_big: "Documento demasiado pesado",
    scanErrBody_file_too_big: "El archivo enviado supera el tamaño admitido.",
    scanErrTips_file_too_big: ["Fotografía la factura desde Chefup en vez de enviar un archivo muy pesado", "Si es un PDF de decenas de páginas, envía solo la página de los productos"],
    scanErrTitle_bad_request: "Documento no recibido",
    scanErrBody_bad_request: "No llegó ningún documento aprovechable al análisis.",
    scanErrTips_bad_request: ["Empieza de nuevo seleccionando otra vez tu factura", "Si se repite, avísanos"],
    scanErrTitle_auth_expired: "Tu conexión ha caducado",
    scanErrBody_auth_expired: "Por seguridad, tu sesión ha terminado durante el análisis. Tu factura no se ha perdido.",
    scanErrTips_auth_expired: ["Pulsa Reintentar: en la mayoría de los casos vuelve a funcionar solo", "Si se repite, cierra sesión y vuelve a entrar, luego relanza el análisis", "No se ha modificado nada en tu despensa"],
    scanErrTitle_auth_required: "Hace falta iniciar sesión",
    scanErrBody_auth_required: "Analizar una factura requiere estar conectado a tu cuenta Chefup.",
    scanErrTips_auth_required: ["Pulsa Reintentar", "Si el problema continúa, cierra sesión y vuelve a entrar", "No se ha modificado nada en tu despensa"],
    scanErrTitle_unknown: "El escaneo no ha funcionado",
    scanErrBody_unknown: "Algo ha fallado durante el análisis. No se ha modificado nada en tu despensa.",
    scanErrTips_unknown: ["Pulsa Reintentar: basta en la mayoría de los casos", "Si el problema vuelve, pulsa «Avisarnos» — te respondemos rápido", "Tus recetas y tus precios nunca se ven afectados por un escaneo fallido"],
    scanNoItemsTips: ["Reencuadra la foto sobre la tabla de productos, sin el encabezado ni el pie de página", "Pon la factura bien plana, sin pliegues ni sombras, con buena luz", "En una factura larga, haz dos fotos: la mitad de arriba y luego la de abajo", "Si tu proveedor te envía un PDF, úsalo: es el método más fiable"],
    scanResultTitle: "Resultado del escaneo", scanImagePreviewLabel: "Ver la imagen enviada a la IA (diagnóstico)", scanRotateHint: "¿Foto torcida? Gírala antes de analizar.", scanAnalyzeButton: "Analizar", scanSupplier: "Proveedor",
    scanDate: "Fecha", scanAssignTo: "Asociar a", scanNewIngredient: "🆕 Nuevo ingrediente",
    scanLinkedSure: "Ingrediente existente", scanLinkedGuess: "Sugerencia, verifica",
    scanRenameWarning: (n) => `Reemplaza "${n}" en todos los sitios donde se usa`,
    scanCreateSeparateLabel: (n) => `Crear "${n}" como ingrediente aparte`,
    scanCreateSeparateHint: "El ingrediente existente no se modifica",
    scanPriceCorrected: "precio recalculado (total ÷ cant.)",
    scanPriceCorrectedHint: "El precio unitario leído parecía inconsistente con el total, se recalculó automáticamente.",
    scanPriceSame: "Precio sin cambios", scanPriceDecrease: "Precio a la baja",
    scanBulkPackaging: "Embalaje agrupado — verifica",
    scanPriceInconsistent: "Diferencia con el total impreso, verifica",
    scanExpectedTotal: "esperado", scanPrintedTotal: "impreso:",
    scanLowConfidence: "Lectura incierta (documento borroso/denso) — compara con el papel antes de validar",
    scanUnitChangeWarning: (oldU, newU) => `Este ingrediente se usa en al menos una receta en "${oldU}" — cambiar a "${newU}" cambiaría el sentido de las cantidades ya introducidas. Revisa esas recetas después de importar.`,
    scanConfirmUncertain: "Confirmar a pesar de la duda",
    scanPriceDoubtLabel: "Comprueba este precio antes de importar",
    scanBigChangeNote: "Diferencia de precio importante respecto a tu último precio — échale un vistazo antes de importar.",
    scanManyUpWarning: "Varios precios parecen estar muy al alza respecto a tus precios conocidos — verifica que el documento esté bien nítido antes de importar.",
    scanLowConfidenceBanner: "Foto un poco borrosa: revisa bien las líneas en naranja antes de importar.",
    scanReviewSection: "A verificar antes de importar", scanSafeSection: "Sin alertas detectadas",
    scanSafeHint: "Eso no significa que sea forzosamente correcto — revisa los precios antes de confirmar.",
    scanSummaryNew: (name, price, unit) => `Vas a crear "${name}" a ${price}€/${unit}.`,
    scanSummaryUpdate: (name, price, unit) => `Vas a actualizar "${name}" a ${price}€/${unit}.`,
    scanItemsToReview: (n) => `${n} producto${n > 1 ? "s" : ""} a verificar`,
    scanVerifyOneByOne: "Verificar uno por uno", scanValidate: "Validar", scanModify: "Modificar",
    viewDetailsLabel: "Editar",
    viewDetailsTooltip: "Precio, categoría, mermas, proveedores...", unitToggleTooltip: "Cambiar de unidad",
    pickerSearchPlaceholder: "Escribe 2 letras…", pickerTypeToSearch: "Escribe para buscar…", pickerNoResults: "Sin resultados",
    unitPieceLabel: "unidad", unitFieldLabel: "Unidad",
    quickAddNamePlaceholder: "Añadir un ingrediente…", quickAddKnown: "conocido", quickAddButton: "Añadir",
    quickAddPriceLabel: "precio",
    scalePortionsLabel: "Adaptar las cantidades para", scalePortionsButton: "Recalcular",
    quickAddHint: "Intro para pasar a la cantidad, Intro para añadir.",
    legacyPantryHint: "Tu despensa todavía tiene la antigua lista de demostración (~200 ingredientes). Carga la nueva versión reducida (7 ingredientes esenciales) para empezar con una base más clara.",
    legacyPantryButton: "Cargar la nueva despensa",
    cancelLabel: "Cancelar", resetConfirmButton: "Sí, reiniciar todo",
    welcomeBannerText: "¡Bienvenido a Chefup! La receta de abajo es un ejemplo con precios ficticios, para mostrarte cómo la app calcula tus márgenes. Escanea tu primera factura real para sustituir estos precios por los tuyos.",
    welcomeBannerButton: "Escanear mi primera factura",
    firstIngredientPrompt: "Añade tu primer ingrediente",
    marginLegendToggle: "¿Qué significan los colores?",
    deleteLineTooltip: "Quitar este ingrediente de la receta",
    editLinePriceTooltip: "Corregir el precio (actualiza el almacén)",
    lineUnitMismatchWarning: (oldU, newU) => `Este ingrediente pasó de "${oldU}" a "${newU}" desde que se introdujo esta cantidad — comprueba que sigue siendo correcta.`,
    recipeUnitMismatchHint: "La unidad de un ingrediente cambió desde que se introdujo — revisa las cantidades",
    ingredientsSectionLabel: "Ingredientes", pricingSectionLabel: "Precio y margen",
    scanStackProgress: (cur, total) => `${cur} / ${total} a verificar`,
    scanAllReviewed: "¡Todo verificado!", scanAllReviewedDetail: "Las actualizaciones están listas para importar a la despensa.", scanContinue: "Continuar",
    scanSkipAllAndClose: "Ignorar el resto y cerrar",
    scanUpcoming: "Siguientes",
    scanExistingLabel: "existente", scanProposedLabel: "nombre propuesto",
    scanRawLabelPrefix: "Factura :",
    scanChooseNameLabel: "¿Qué nombre mantener?",
    scanRelinkLabel: "Asociar a otro ingrediente / crear nuevo:",
    scanKeepName: "Mantener el existente", scanUseNewName: "Usar este nuevo nombre",
    scanPricingUnknown: "Precio por pieza/bolsa detectado",
    scanPricingUnknownHint: "Este producto se vende por peso/volumen, pero el peso o volumen de una pieza no está indicado en este documento. Indícalo abajo para calcular el precio por kilo/litro automáticamente:",
    scanCalcSourcePrice: "Precio leído en la factura",
    scanCalcContentLabel: "Peso o volumen de una pieza",
    scanCalcResult: (price, unit) => `= ${price} €/${unit}`,
    scanSearchIngredientPlaceholder: "Buscar un ingrediente existente…",
    scanBackToCard: "Volver",
    scanSkip: "No añadir este ingrediente", scanSkippedSection: "Omitidos", scanUndoSkip: "Deshacer",
    scanDoneSection: "Ya añadidos",
    scanNonFoodExcluded: (n) => `${n} artículo${n > 1 ? "s" : ""} excluido${n > 1 ? "s" : ""} de la despensa (no alimentario o depósito/gastos — toca para recuperar uno):`,
    scanRestoreNonFood: "Añadir de todos modos a la verificación",
    scanRestoreDeposit: "Depósito / gastos (envío, servicio...) — añadir de todos modos a la verificación",
    scanPriceLabel: "Precio (editable):",
    estimatedPriceBadge: "estimado", estimatedPriceHint: "Precio de partida estimado, nunca confirmado por un escaneo o entrada manual — verifícalo con tu proveedor real.",
    estimatedPriceLegend: "Precio estimado, aún no verificado con tu proveedor",
    lossPercentLabel: "Rendimiento / Merma (%)",
    lossLineBadge: (pct) => `Merma ${pct}%`,
    declareLossesButton: "Mermas de corte / pelado",
    declareLossesTitle: "Mermas de preparación",
    declareLossesHint: "Indica aquí el % que se pierde al cortar, despiezar o pelar cada ingrediente de esta receta (ej: 20% en pescado crudo). El coste real de la receta lo tiene en cuenta automáticamente, y se aplica en todas las recetas que usan este ingrediente, no solo en esta.",
    priceVariationHint: "Variación respecto a la última actualización de precio de este ingrediente",
    suggestionTitle: "Idea de optimización:",
    suggestionProtein: "Este margen está por debajo de tu objetivo. Ideas: reajustar ligeramente el gramaje de la proteína, o subir el precio de venta.",
    suggestionFeculent: "Este margen está por debajo de tu objetivo. Ideas: ajustar la ración de la guarnición, o el precio de venta.",
    suggestionOtherWithIngredient: (name) => `Este margen está por debajo de tu objetivo. El ingrediente más caro de esta receta es ${name} — revisa su cantidad, o ajusta el precio de venta.`,
    suggestionOther: "Este margen está por debajo de tu objetivo. Ideas: ajusta el precio de venta, o revisa la cantidad de los ingredientes más caros.",
    pantryEmptyPrompt: "Elige una categoría arriba o busca algo para ver tus ingredientes.",
    coefLabel: "Coef.",
    printRecipeSheet: "Imprimir la ficha de receta", printMenuLabel: "Imprimir",
    exampleRecipeBadge: "Receta de ejemplo",
    wizardStep1Title: "Modificar o crear un ingrediente", wizardPriceStepTitle: "Precio y unidad", wizardCategoryStepTitle: "¿Qué categoría?",
    wizardEstimatePrice: "¿No tienes el precio a mano? Estimar un precio temporal",
    wizardBack: "Atrás", wizardNext: "Siguiente", wizardSave: "Guardar", wizardCreate: "Crear el ingrediente",
    wizardSuccess: "¡Añadido a la despensa!", wizardUpdated: "¡Precio actualizado!",
    wizardExistingSection: "Ingredientes existentes — modificar el precio", wizardCatalogSection: "Sugerencias",
    wizardSearchHint: "Escribe el nombre de un ingrediente para buscarlo o crear uno nuevo.",
    recentIngredients: "Recientes", noRecentIngredients: "Ningún ingrediente escaneado o modificado recientemente.",
    selectAllRecent: "Seleccionar todo", deselectAll: "Deseleccionar todo",
    deleteSelectedButton: (n) => `Eliminar (${n})`,
    deleteSelectedConfirm: (n) => `¿Eliminar definitivamente ${n} ingrediente${n > 1 ? "s" : ""} seleccionado${n > 1 ? "s" : ""}? Esta acción es irreversible.`,
    pantryOnboardingHint: "Estos precios son solo ejemplos para la receta de demostración. Escanea tus propias facturas para llenar tu despensa con tus precios reales de proveedor.",
    pantryReclassifyHint: (n) => `${n} ingrediente${n > 1 ? "s" : ""} en "Otros" se pueden clasificar automáticamente.`,
    pantryReclassifyButton: "Clasificar ahora",
    categoryLabel: "Categoría",
    recentToday: "Hoy", recentWeek: "Esta semana", recentMonth: "Este mes",
    deleteRecipeConfirm: (name) => `¿Eliminar definitivamente la receta "${name}"?`,
    allergenSheetLink: "Ficha de alérgenos", allergenSheetTitle: "Ficha de alérgenos — todas las recetas",
    allergenSheetNone: "Sin alérgenos indicados",
    digitalMenuButton: "Carta digital", digitalMenuTitle: "Mi carta digital",
    digitalMenuHint: "Genera una carta pública (con código QR) a partir de tus recetas. Se actualiza sola en cuanto cambias un precio.",
    digitalMenuPublishLabel: "Publicar mi carta", digitalMenuPublishHint: "Mientras esté desactivado, nadie puede ver la carta, ni con el enlace.",
    digitalMenuRestaurantNameLabel: "Nombre del restaurante", digitalMenuRestaurantNamePlaceholder: "ej: Chez Marge",
    digitalMenuDesignLabel: "Diseño", digitalMenuDesignClassic: "Clásico", digitalMenuDesignModern: "Moderno",
    digitalMenuDesignElegant: "Elegante", digitalMenuDesignBistro: "Bistró",
    digitalMenuCategoriesLabel: "Secciones de la carta", digitalMenuCategoryAdd: "Añadir",
    digitalMenuCategoryAddPlaceholder: "ej: Pizzas, Salsas…",
    digitalMenuSimpleItemsLabel: "Artículos simples (bebidas, etc.)",
    digitalMenuSimpleItemsHint: "Para lo que se revende tal cual (Coca-Cola, Perrier…) — no hace falta crear una receta.",
    digitalMenuSimpleItemNamePlaceholder: "Nombre (ej: Coca-Cola 33cl)",
    digitalMenuSimpleItemCostLabel: "Coste de compra:", digitalMenuSimpleItemAddCost: "+ añadir coste de compra",
    digitalMenuConvertToRecipe: "Conocer su margen",
    digitalMenuCopyLink: "Copiar enlace", digitalMenuLinkCopied: "¡Copiado!", digitalMenuDownloadQr: "Descargar código QR",
    digitalMenuRecipesLabel: "Recetas mostradas en la carta", digitalMenuNoRecipes: "Crea una receta para poder añadirla a la carta.",
    digitalMenuDescriptionPlaceholder: "Descripción para el cliente (opcional)",
    publicMenuNotAvailable: "Esta carta no está disponible por el momento.",
    publicMenuNoDishes: "Todavía no hay platos en la carta.",
    publicMenuPoweredBy: "Carta generada con Chefup",
    digitalMenuLogoLabel: "Logo", digitalMenuLogoUpload: "Elegir una imagen", digitalMenuLogoRemove: "Quitar",
    digitalMenuLogoError: "Imagen ilegible, prueba con otra foto.",
    digitalMenuPreview: "Ver la carta", digitalMenuTranslateHint: "Traducir a:",
    digitalMenuTranslateError: "No se pudo traducir, inténtalo de nuevo.", digitalMenuTranslating: "Traduciendo…",
    digitalMenuCategoryNone: "Sin sección",
    scanImport: "Añadir a la despensa", scanImported: "Añadido a la despensa ✓", scanImportAll: "Importar estas líneas",
    scanPriceIncrease: "Precio en alza", scanNoItems: "Ningún producto identificado con certeza en este documento — en vez de inventar, la app prefiere no proponer nada. Intenta con una foto más nítida, mejor encuadrada en la tabla de productos (sin el resto de la página), o envía un PDF si tienes uno.",    scanHint: "Revisa y corrige cada línea antes de importar — la IA puede equivocarse.",
    scanWeightLabel: "Peso de 1 unidad (deja 0 si es realmente por unidad):",
    scanRecipeButton: "Escanear una ficha", scanningRecipe: "Leyendo la ficha…",
    scanRecipeResultTitle: "Ficha de receta escaneada",
    scanRecipeHint: "Revisa el nombre de los ingredientes, las cantidades y las coincidencias antes de crear la receta — la IA puede equivocarse. Funciona mejor con una ficha de receta simple (lista de ingredientes directa); una ficha profesional muy detallada con varias subrecetas (salsas, bases...) necesitará más revisión.",
    scanRecipeIngredientsLabel: "Ingredientes detectados", scanRecipeNoLines: "No se detectó ningún ingrediente — podrás añadirlos manualmente.",
    scanRecipeImpreciseWarning: (raw) => `Cantidad imprecisa en la ficha ("${raw}") — indica el peso/volumen real`,
    scanRecipeCreateButton: "Crear la receta", scanRecipeRemoveLine: "Quitar esta línea",
    scanTab: "Escanear", scanTabHint: "Importa el PDF de tu factura de Makro, Gros Mercat o cualquier otro proveedor (o hazle una foto) — la IA se encarga del resto.",
    scanTabHintIOS: "Haz una foto de tu factura — la IA se encarga del resto. (El PDF todavía no está disponible en iPhone, un fallo de Apple impide por ahora leerlo de forma fiable.)",
    scanTakePhoto: "Tomar una foto", scanUploadFile: "Importar un archivo (PDF, foto...)", scanUploadFileIOS: "Importar una foto (galería)",
    scanRecommendedBadge: "Recomendado — más preciso",
    scanTipTitle: "💡 Consejo para un escaneo óptimo:",
    scanTipBody: "Para una precisión máxima, prioriza la importación del archivo PDF original de tu proveedor (Makro, Gros Mercat, etc.). Si haces una foto, coloca la factura bien plana bajo una buena luz. Atención: el desenfoque, las sombras, los pliegues y los reflejos reducen la precisión de la IA.",
    scanTipBodyIOS: "¿Factura recibida en PDF (por correo, etc.)? Ábrela, pon el teléfono en horizontal si la tabla es ancha para ver bien la columna de precios, y haz una CAPTURA DE PANTALLA (no una foto con la cámara) — nítido siempre es mejor que borroso. Si no cabe todo en una sola captura, haz 2 (izquierda/derecha o arriba/abajo). Luego importa la(s) captura(s) con el botón \"Importar una foto\" de arriba: están en tu carrete como cualquier foto.",
    scanColisUnit: "paquete",
    marginExcellentMsg: "¡Margen excelente!", marginGoodMsg: "Buen margen, por encima de tu objetivo.",
    marginCloseMsg: "Justo por debajo de tu margen deseado, pero sigue siendo un buen plato.",
    marginWatchMsg: "Por debajo de tu margen deseado — a vigilar en este plato.",
    marginLowMsg: "Margen muy insuficiente: este plato no es rentable tal cual.",
    marginLowFixMsg: "Margen insuficiente, a corregir rápidamente.",
    vatOption10Hint: "hostelería España", vatOption21Hint: "IVA general España",
    recipeLineIngredientPlaceholder: "Elegir un ingrediente…",
    recipeCreateIngredientFromLine: "Crear un nuevo ingrediente",
    recipeTargetReached: "Objetivo de esta receta alcanzado",
    marginLegendWithOrange: (green, crit) => `Verde ≥ ${green}% · Naranja entre ${crit}–${green}% · Rojo < ${crit}%`,
    marginLegendNoOrange: (crit) => `Verde ≥ ${crit}% · Rojo < ${crit}% (sin zona naranja con este umbral)`,
    deleteRecipeButton: "Eliminar esta receta",
    deleteLabel: "Eliminar", deleteIngredientButton: "Eliminar ingrediente",
    authLoginTitle: "Conexión", authSignupTitle: "Crear una cuenta", authForgotTitle: "Contraseña olvidada", authResetTitle: "Nueva contraseña",
    authEmailLabel: "Email", authPasswordLabel: "Contraseña", authNewPasswordLabel: "Nueva contraseña", authConfirmPasswordLabel: "Confirma la contraseña",
    authEmailPlaceholder: "tu@ejemplo.com", authPasswordPlaceholder: "6 caracteres mínimo", authConfirmPasswordPlaceholder: "Escribe otra vez la misma contraseña",
    authLoginButton: "Iniciar sesión", authSignupButton: "Crear mi cuenta", authForgotButton: "Enviar el enlace de restablecimiento", authResetButton: "Confirmar la nueva contraseña",
    authForgotLink: "¿Contraseña olvidada?", authSwitchToSignup: "¿Aún no tienes cuenta? Crear una cuenta", authSwitchToLogin: "¿Ya tienes cuenta? Iniciar sesión", authBackToLogin: "Volver al inicio de sesión",
    authSignupSuccessInfo: "¡Cuenta creada! Revisa tu correo para confirmar tu dirección (mira también tu carpeta de spam), luego inicia sesión.",
    authForgotSuccessInfo: "Si existe una cuenta con este email, se acaba de enviar un enlace de restablecimiento.",
    authContinueButton: "Continuar", authMagicLinkSignupButton: "Recibir un código por email",
    authMagicLinkButton: "Recibir un código por email", authMagicLinkInfo: "¡Código enviado! Revisa tu bandeja de entrada (y spam).",
    authOrDivider: "o",
    authOtpTitle: "Revisa tu email", authOtpSubtitle: (email) => `Acabamos de enviar un código a ${email}.`,
    authOtpVerifyButton: "Confirmar código", authOtpResend: "Reenviar código", authOtpBack: "← Volver",
    authErrorOtpInvalid: "Código incorrecto o caducado. Inténtalo de nuevo o pide otro código.",
    authErrorRateLimit: "Demasiados intentos — inténtalo de nuevo en un minuto.",
    authErrorInvalidCredentials: "Email o contraseña incorrectos.", authErrorAlreadyRegistered: "Ya existe una cuenta con este email.",
    authAlreadyRegisteredGoLogin: "Iniciar sesión con esta cuenta",
    authErrorEmailNotConfirmed: "Confirma primero tu dirección de email antes de iniciar sesión — el enlace se envió por correo, revisa también tu carpeta de spam.",
    authResendConfirmationButton: "Reenviar el correo de confirmación",
    authResendConfirmationSent: "¡Correo reenviado! Revisa tu bandeja de entrada Y tu carpeta de spam.",
    authErrorPasswordTooShort: "La contraseña debe tener al menos 6 caracteres.", authErrorInvalidEmail: "Dirección de email inválida.",
    authErrorGeneric: "Ha ocurrido un error. Inténtalo de nuevo.", authErrorPasswordMismatch: "Las dos contraseñas no coinciden.",
    authTagline: "Calcula tus márgenes con toda sencillez", authSignupFreeNote: "7 días de prueba gratuita, sin necesidad de tarjeta bancaria.",
    landingHeroTitle: "Tu carta esconde platos que te cuestan dinero",
    landingHeroSubtitle: "Pon tus cifras, mira tu margen real. Tarda 10 segundos.",
    landingHowItWorksTitle: "Cómo funciona",
    landingStep1Title: "Escanea tu factura", landingStep1Desc: "Foto o archivo — los precios de tu despensa se actualizan solos.",
    landingStep2Title: "Tu margen se calcula", landingStep2Desc: "Coste, IVA, precio de venta: tu margen aparece al instante, plato por plato.",
    landingStep3Title: "Genera tu carta digital", landingStep3Desc: "Un código QR con tus precios siempre actualizados, sin volver a teclear nada.",
    landingPreviewDish: "Res a la Borgoña", landingPreviewMarginLabel: "de margen",
    landingPreviewCost: "Coste / ración", landingPreviewPrice: "Precio de venta",
    landingCtaStart: "Empezar gratis", landingCtaLogin: "Ya tengo una cuenta",
    landingFeatureScanTitle: "Escaneo de facturas con IA", landingFeatureScanDesc: "Haz una foto o importa tu factura: los precios de tu despensa se actualizan solos.",
    landingFeatureMarginTitle: "Margen por receta en tiempo real", landingFeatureMarginDesc: "Coste de ingredientes, IVA, precio de venta: tu margen se recalcula al instante con cada cambio.",
    landingFeaturePrintTitle: "Fichas listas para imprimir", landingFeaturePrintDesc: "Ficha técnica (con o sin precios) y ficha de alérgenos de todas tus recetas, listas para cocina o inspección.",
    landingFeatureMenuTitle: "Carta digital con código QR", landingFeatureMenuDesc: "Genera una carta pública a partir de tus recetas — el precio se actualiza solo en cuanto lo cambias en la app.",
    landingFeaturePantryTitle: "Despensa con varios proveedores", landingFeaturePantryDesc: "Historial de precios, varios proveedores por ingrediente, mermas de preparación incluidas.",
    calcTitle: "Pruébalo ahora mismo",
    calcSubtitle: "Coge uno de tus platos y pon tus cifras.",
    calcCostLabel: "Lo que te cuestan los ingredientes, por ración",
    calcPriceLabel: "Tu precio de venta, con IVA",
    calcResultLabel: "Tu margen",
    calcVerdictHigh: "Buen margen, este plato trabaja para ti.",
    calcVerdictMid: "Margen correcto, pero se puede mejorar.",
    calcVerdictLow: "Margen demasiado bajo: este plato te cuesta más de lo que te deja.",
    calcVatNote: (v) => `Calculado sin impuestos, IVA ${v}% (restauración) — igual que en la app.`,
    firstRunTitle: "Tu primer plato",
    firstRunHint: "Creamos su ficha ahora mismo. Añadirás sus ingredientes justo después y aparecerá su margen.",
    firstRunDishLabel: "Nombre del plato",
    firstRunDishPlaceholder: "Hamburguesa casera, ensalada César…",
    firstRunPriceLabel: "Tu precio de venta, con IVA",
    firstRunPriceHint: "El precio de un plato, tal y como está en tu carta.",
    firstRunCreate: "Crear mi ficha de receta",
    firstRunSkip: "Saltar, prefiero mirar por mi cuenta",
    calcMoreTitle: "Esto es un plato. En Chefup:",
    calcMore1: "Este coste se rellena solo: fotografías tu factura y los precios se actualizan en tus recetas.",
    calcMore2: "Toda tu carta se recalcula con cada subida de precio del proveedor, y te avisamos cuando un plato baja de tu objetivo.",
    calcMore3: "Fichas técnicas, ficha de alérgenos imprimible y carta digital con código QR incluidas.",
    calcCta: "Hacer esto con toda mi carta",
    landingPricingTitle: "Un único precio, todo incluido", landingPricingTrial: "7 días de prueba gratuita, sin tarjeta bancaria",
    landingPricingCta: "Empezar mi prueba gratuita", landingPricingPerMonth: "/ mes",
    landingLegalNotice: "Aviso legal", landingTerms: "Condiciones", landingPrivacy: "Privacidad",
    consentText: "Nos gustaría medir si el anuncio que te ha traído aquí funciona. Eso implica un rastreador de TikTok. Puedes rechazarlo, la web funciona exactamente igual.",
    consentAccept: "Aceptar", consentRefuse: "Rechazar",
    landingPricingFeature1: "Recetas y márgenes ilimitados", landingPricingFeature2: "Escaneo de facturas con IA",
    landingPricingFeature3: "Fichas técnicas y de alérgenos imprimibles", landingPricingFeature4: "Carta digital con código QR", landingPricingFeature5: "Cancelable en cualquier momento",
  },
  en: {
    appTitle: "Chefup", saved: "Saved", loading: "Loading…", greeting: "Hello Chef",
    dataUnavailable: "Local data unavailable", resetData: "Reset my data",
    resetDataConfirm: "Erase all your data? This action is irreversible.",
    pantry: "Pantry", newIngredient: "New ingredient", addIngredient: "Add ingredient",
    searchPlaceholder: "Search an ingredient…", pantryFilterPlaceholder: "Filter the pantry…",
    allCategories: "All", createCustom: (q) => `Create "${q}"`, noMatch: "No results in the catalog",
    noFilterMatch: "No ingredient matches.",
    supplier: "supplier", newSupplier: "New supplier",
    recipes: "Recipes", newRecipe: "New recipe", newRecipeName: "New recipe",
    recipeListViewTooltip: "List view", recipeGridViewTooltip: "Grid view",
    ticket: "Ticket", overview: "Overview", recipeCol: "Recipe", costPortionCol: "Cost/portion",
    sellPriceCol: "Sell price (incl. tax)", marginCol: "Margin", noRecipes: "No recipes yet.",
    overviewHint: "Tap a row to open the ticket. Color = distance to your target margin.",
    noRecipeYet: "No recipes yet. Create one to get started.",
    duplicate: "Duplicate", print: "Print", printTicket: "Print (with prices)", portions: "Servings", line: "Add an ingredient",
    qtyHintToggle: "Tablespoon/pinch reference",
    qtyHintText: "1 tablespoon ≈ 15g · 1 teaspoon ≈ 5g · 1 pinch ≈ 1g (rough estimate, adjust per ingredient).",
    total: "Total cost", costPerPortion: "Cost / serving", sellPriceTTC: "Sell price (incl. tax)",
    sellPriceHT: "Price excl. tax", vat: "Tax", targetMargin: "Target margin", suggestedPrice: "Suggested price (incl. tax)",
    use: "Use", marginLabel: "margin", lowMarginWarning: `Below ${CRITICAL_MARGIN}%, keep an eye on it`,
    marginExcellentTitle: "Excellent margin", marginExcellentDetail: "Already above your target, no price adjustment needed.",
    simulateHigherMargin: (v) => `Simulate ${v}%`,
    excellentMarginBadge: "Optimal profitability",
    notes: "Notes / Instructions", notesPlaceholder: "E.g.: Marinate the meat, simmer for 3h, plate with parsley…",
    allergens: "Allergens", allergensPlaceholder: "e.g.: gluten, milk, celery…",
    allergensAutoBadge: "auto-detected", allergensReset: "Back to auto-detection",
    createdOn: "Created on", settings: "Settings", logout: "Log out", defaultVat: "Default tax rate",
    minMarginLabel: "Desired minimum margin", close: "Close",
    emailRemindersLabel: "Receive email reminders",
    emailRemindersHint: "A nudge if you haven't scanned anything in a while, or if a recipe drops below your target margin.",
    billingTrialBanner: (n) => n > 1 ? `Free trial: ${n} days left` : n === 1 ? "Free trial: last day" : "Free trial: ends today",
    billingPaywallTitle: "Your free trial has ended", billingPaywallBody: (p) => `Subscribe to keep using Chefup — €${p}/month, cancel anytime.`,
    billingFounderStory: "Chefup was born out of real restaurant experience — recalculating margins by hand every time a supplier raises prices will drive you mad.",
    billingBenefit1: "Automatic AI invoice scanning", billingBenefit2: "Margin recalculated instantly with every price change", billingBenefit3: "Alert as soon as a dish drops below your target margin",
    billingPaywallReminder: "Your recipes and their already-calculated margins are waiting — don't lose what you've built.",
    launchBadge: "Launch offer",
    launchSpotsLeft: (n) => (n > 1 ? `Only ${n} spots left out of 50` : n === 1 ? "Last spot out of 50" : "All 50 spots are taken"),
    launchFounderPrice: (f, s) => `€${f}/month for life instead of €${s}`,
    launchForLife: "for life",
    launchLifetimeLock: "This price stays yours as long as your subscription stays active, even when the price goes up.",
    launchCondition: "Your spot is reserved when you sign up and confirmed if you subscribe before your 7-day trial ends.",
    launchTrialBanner: (n, f) =>
      n > 1
        ? `Founder price €${f}/month for life: ${n} days left to keep it`
        : n === 1
        ? `Founder price €${f}/month for life: last day to keep it`
        : `Founder price €${f}/month for life: ends today`,
    launchPaywallTitle: (f) => `Keep your founder price: €${f}/month for life`,
    billingSubscribeButton: "Subscribe now", billingSecureNote: "Secure payment by Stripe.", billingCheckoutError: "Couldn't open the payment page, try again in a moment.",
    billingManageSubscription: "Subscription", billingPortalError: "Couldn't open the subscription page, try again in a moment.",
    myAccount: "My account",
    installAppButton: "Install the app", installModalTitle: "Install Chefup",
    installBannerText: "Install Chefup on your phone to open it in one tap, like a real app.",
    installDiagramShareLabel: "Share", installDiagramMenuLabel: "Menu", installDiagramHomeLabel: "Home screen", installDiagramInstallLabel: "Install",
    installInstructionsIOS: "Tap the Share button (the square with an arrow) at the bottom of Safari, then choose \"Add to Home Screen\".",
    installInstructionsIOSChrome: "Tap Chrome's Share button or its ⋯ menu (position varies by phone), then choose \"Add to Home Screen\".",
    installInstructionsAndroid: "Tap Chrome's ⋮ menu, then choose \"Install app\" (or \"Add to Home screen\").",
    installInstructionsGeneric: "Look for \"Add to Home screen\" or \"Install app\" in your browser's menu.",
    contactButton: "Contact us", contactModalTitle: "Contact us",
    contactHint: "A bug, an idea to improve Chefup? Write to us, we'll reply directly by email.",
    contactPlaceholder: "Describe your issue or suggestion...",
    contactAttachButton: "Attach a screenshot",
    contactSendButton: "Send", contactSuccessMessage: "Message sent! We usually reply within 24-48h.",
    contactError: "Error sending the message, try again.",
    scanInvoice: "Scan an invoice", scanning: "Analyzing the invoice…",
    scanError: "Error during analysis", scanRetry: "Retry",
    scanningPatience: "This can take 1-2 minutes on a long or dense invoice — stay on this screen, don't close it.",
    scanSplitTip: "Invoice with more than 15 lines? Split it into several photos (top/bottom, or 3 if it's really long) instead of one — much more reliable than a single very dense photo.",
    scanStep_prepare: "Preparing the document…",
    scanStep_ocr: "Reading the text…",
    scanStep_ai: "Analyzing the lines…",
    scanErrWhatToDo: "What you can do",
    scanRetrySamePhoto: "Retry with the same photo",
    scanRetryOtherFile: "Another file",
    scanReportProblem: "Report it",
    scanReportPrefill: "Hi, I can't scan my invoice. Here is what I was doing:",
    scanErrTitle_offline: "Connection lost",
    scanErrBody_offline: "Your invoice could not be sent: the device lost its internet connection during the analysis.",
    scanErrTips_offline: ["Check your wifi or mobile data", "Move away from thick walls if you are in a storeroom or cellar", "Then tap Retry: your photo is kept, nothing to redo"],
    scanErrTitle_ai_timeout: "The analysis took too long",
    scanErrBody_ai_timeout: "The document could not be analyzed in time. It is almost always a very dense invoice or a slow connection.",
    scanErrTips_ai_timeout: ["Is your invoice 40 lines or more? That's almost always the cause: split it into 2 or 3 photos, never a single photo for such a long document", "Otherwise, try once more: it sometimes works on the second attempt", "If your supplier sends you a PDF, use it: faster and more reliable than a photo"],
    scanErrTitle_ai_busy: "Too many requests right now",
    scanErrBody_ai_busy: "The analysis is briefly overloaded. Nothing is lost on your side.",
    scanErrTips_ai_busy: ["Wait a minute, then tap Retry", "If it happens three times in a row, tell us: we look into it straight away"],
    scanErrTitle_ai_unavailable: "Analysis unavailable right now",
    scanErrBody_ai_unavailable: "The problem is on our side, not with your invoice or your phone. None of your data is affected.",
    scanErrTips_ai_unavailable: ["Try again in a few minutes", "If it is still stuck, tap \"Report it\": the message includes what we need to understand, and we reply", "In the meantime you can enter your prices by hand in the pantry"],
    scanErrTitle_ai_unreadable: "Unusable result",
    scanErrBody_ai_unreadable: "The document arrived fine, but the analysis returned nothing usable.",
    scanErrTips_ai_unreadable: ["Try again: the result often changes between attempts", "Crop tighter on the product table, without the rest of the page", "If you have the supplier's PDF, send that instead of a photo"],
    scanErrTitle_file_unreadable: "File could not be opened",
    scanErrBody_file_unreadable: "This file could not be read as an image or a PDF. Some photo formats are not recognized by the browser.",
    scanErrTips_file_unreadable: ["Photograph the invoice again directly from Chefup", "Or pick the photo from your gallery rather than from the Files app", "A PDF sent by your supplier also works very well"],
    scanErrTitle_file_password_protected: "Password-protected PDF",
    scanErrBody_file_password_protected: "This PDF needs a password to open — Chefup can't analyze it until the protection is removed.",
    scanErrTips_file_password_protected: ["Open the PDF and save/export it again without a password, then try again", "Or simply take a photo of the invoice instead", "If you don't know how to remove the protection, ask your supplier for a version without a password"],
    scanErrTitle_file_pdf_ios_issue: "PDF reading issue on iPhone",
    scanErrBody_file_pdf_ios_issue: "iPhones have a known bug reading certain PDFs from a web app — it affects every browser on the iPhone (Safari, Chrome...), not just one in particular.",
    scanErrTips_file_pdf_ios_issue: ["Take a photo of the invoice instead: it works very well and avoids this issue entirely", "Switching browsers on iPhone won't fix it, they all share the same issue", "On a computer or Android, this PDF would likely work fine"],
    scanErrTitle_file_too_big: "Document too heavy",
    scanErrBody_file_too_big: "The file you sent is larger than what we accept.",
    scanErrTips_file_too_big: ["Photograph the invoice from Chefup instead of sending a very heavy file", "If it is a PDF with dozens of pages, send only the products page"],
    scanErrTitle_bad_request: "Document not received",
    scanErrBody_bad_request: "No usable document reached the analysis.",
    scanErrTips_bad_request: ["Start again by selecting your invoice once more", "If it keeps happening, let us know"],
    scanErrTitle_auth_expired: "Your session expired",
    scanErrBody_auth_expired: "For security reasons your session ended during the analysis. Your invoice was not lost.",
    scanErrTips_auth_expired: ["Tap Retry: in most cases it goes through straight away", "If it happens again, sign out and sign back in, then run the analysis again", "Nothing was changed in your pantry"],
    scanErrTitle_auth_required: "Sign-in required",
    scanErrBody_auth_required: "Analyzing an invoice requires being signed in to your Chefup account.",
    scanErrTips_auth_required: ["Tap Retry", "If the problem persists, sign out and sign back in", "Nothing was changed in your pantry"],
    scanErrTitle_unknown: "The scan did not go through",
    scanErrBody_unknown: "Something went wrong during the analysis. Nothing was changed in your pantry.",
    scanErrTips_unknown: ["Tap Retry: that is enough in most cases", "If the problem comes back, tap \"Report it\" — we reply quickly", "Your recipes and prices are never touched by a failed scan"],
    scanNoItemsTips: ["Crop the photo to the product table, without the header or the footer", "Lay the invoice flat, no folds or shadows, with good light", "On a long invoice, take two photos: the top half, then the bottom half", "If your supplier sends you a PDF, use it: it is the most reliable method"],
    scanResultTitle: "Scan result", scanImagePreviewLabel: "View the image sent to the AI (diagnostic)", scanRotateHint: "Photo sideways? Rotate it before analyzing.", scanAnalyzeButton: "Analyze", scanSupplier: "Supplier",
    scanDate: "Date", scanAssignTo: "Assign to", scanNewIngredient: "🆕 New ingredient",
    scanLinkedSure: "Existing ingredient", scanLinkedGuess: "Suggestion, please check",
    scanRenameWarning: (n) => `Replaces "${n}" everywhere it's used`,
    scanCreateSeparateLabel: (n) => `Create "${n}" as a separate ingredient`,
    scanCreateSeparateHint: "The existing ingredient stays unchanged",
    scanPriceCorrected: "price recalculated (total ÷ qty)",
    scanPriceCorrectedHint: "The unit price read seemed inconsistent with the total, it was recalculated automatically.",
    scanPriceSame: "Price unchanged", scanPriceDecrease: "Price down",
    scanBulkPackaging: "Bulk packaging — please check",
    scanPriceInconsistent: "Mismatch with the printed total, please check",
    scanExpectedTotal: "expected", scanPrintedTotal: "printed:",
    scanLowConfidence: "Uncertain reading (blurry/dense document) — compare with the paper before validating",
    scanUnitChangeWarning: (oldU, newU) => `This ingredient is used in at least one recipe in "${oldU}" — switching to "${newU}" would change the meaning of quantities already entered. Check those recipes after importing.`,
    scanConfirmUncertain: "Confirm despite the uncertainty",
    scanPriceDoubtLabel: "Check this price before importing",
    scanBigChangeNote: "Big price gap compared to your last price — take a look before importing.",
    scanManyUpWarning: "Several prices seem sharply up compared to your known prices — check that the document is sharp before importing.",
    scanLowConfidenceBanner: "Photo a bit blurry: check the orange lines carefully before importing.",
    scanReviewSection: "To check before importing", scanSafeSection: "No alerts detected",
    scanSafeHint: "That doesn't mean it's necessarily right — check the prices before confirming.",
    scanSummaryNew: (name, price, unit) => `You're about to create "${name}" at ${price}€/${unit}.`,
    scanSummaryUpdate: (name, price, unit) => `You're about to update "${name}" to ${price}€/${unit}.`,
    scanItemsToReview: (n) => `${n} item${n > 1 ? "s" : ""} to check`,
    scanVerifyOneByOne: "Check one by one", scanValidate: "Validate", scanModify: "Edit",
    viewDetailsLabel: "Edit",
    viewDetailsTooltip: "Price, category, yield loss, suppliers...", unitToggleTooltip: "Change unit",
    pickerSearchPlaceholder: "Type 2 letters…", pickerTypeToSearch: "Type to search…", pickerNoResults: "No results",
    unitPieceLabel: "piece", unitFieldLabel: "Unit",
    quickAddNamePlaceholder: "Add an ingredient…", quickAddKnown: "known", quickAddButton: "Add",
    quickAddPriceLabel: "price",
    scalePortionsLabel: "Scale the amounts for", scalePortionsButton: "Recalculate",
    quickAddHint: "Enter to jump to the amount, Enter to add.",
    legacyPantryHint: "Your pantry still has the old demo list (~200 ingredients). Load the new lean version (7 essential ingredients) to start from a clearer base.",
    legacyPantryButton: "Load the new pantry",
    cancelLabel: "Cancel", resetConfirmButton: "Yes, reset everything",
    welcomeBannerText: "Welcome to Chefup! The recipe below is an example with made-up prices, to show you how the app calculates your margins. Scan your first real invoice to replace these prices with your own.",
    welcomeBannerButton: "Scan my first invoice",
    firstIngredientPrompt: "Add your first ingredient",
    marginLegendToggle: "What do the colors mean?",
    deleteLineTooltip: "Remove this ingredient from the recipe",
    editLinePriceTooltip: "Fix the price (updates the pantry)",
    lineUnitMismatchWarning: (oldU, newU) => `This ingredient switched from "${oldU}" to "${newU}" since this quantity was entered — check it's still correct.`,
    recipeUnitMismatchHint: "An ingredient's unit changed since it was entered — check the quantities",
    ingredientsSectionLabel: "Ingredients", pricingSectionLabel: "Price & margin",
    scanStackProgress: (cur, total) => `${cur} / ${total} to check`,
    scanAllReviewed: "All checked!", scanAllReviewedDetail: "The updates are ready to be imported to the pantry.", scanContinue: "Continue",
    scanSkipAllAndClose: "Skip the rest and close",
    scanUpcoming: "Next",
    scanExistingLabel: "existing", scanProposedLabel: "suggested name",
    scanRawLabelPrefix: "Invoice:",
    scanChooseNameLabel: "Which name to keep?",
    scanRelinkLabel: "Link to another ingredient / create new:",
    scanKeepName: "Keep existing", scanUseNewName: "Use this new name",
    scanPricingUnknown: "Price per piece/bag detected",
    scanPricingUnknownHint: "This product is sold by weight/volume, but the weight or volume of one piece isn't shown on this document. Enter it below to calculate the price per kilo/liter automatically:",
    scanCalcSourcePrice: "Price read on the invoice",
    scanCalcContentLabel: "Weight or volume of one piece",
    scanCalcResult: (price, unit) => `= ${price} €/${unit}`,
    scanSearchIngredientPlaceholder: "Search an existing ingredient…",
    scanBackToCard: "Back",
    scanSkip: "Don't add this ingredient", scanSkippedSection: "Skipped", scanUndoSkip: "Undo",
    scanDoneSection: "Already added",
    scanNonFoodExcluded: (n) => `${n} item${n > 1 ? "s" : ""} excluded from the pantry (non-food or deposit/fee — tap to restore one):`,
    scanRestoreNonFood: "Add to review anyway",
    scanRestoreDeposit: "Deposit / fee (shipping, service...) — add to review anyway",
    scanPriceLabel: "Price (editable):",
    estimatedPriceBadge: "estimated", estimatedPriceHint: "Starting estimated price, never confirmed by a scan or manual entry — check it with your actual supplier.",
    estimatedPriceLegend: "Estimated price, not yet verified with your supplier",
    lossPercentLabel: "Yield / Loss (%)",
    lossLineBadge: (pct) => `Loss ${pct}%`,
    declareLossesButton: "Trim / peeling losses",
    declareLossesTitle: "Prep losses",
    declareLossesHint: "Enter the % lost when trimming, cutting or peeling each ingredient in this recipe (e.g. 20% on raw fish). The recipe's real cost accounts for it automatically, and it applies everywhere this ingredient is used, not just in this recipe.",
    priceVariationHint: "Change since the last price update for this ingredient",
    suggestionTitle: "Optimization idea:",
    suggestionProtein: "This margin is below your target. Ideas: slightly reduce the protein portion, or raise the sell price.",
    suggestionFeculent: "This margin is below your target. Ideas: adjust the starch/side portion, or the sell price.",
    suggestionOtherWithIngredient: (name) => `This margin is below your target. The most expensive ingredient in this recipe is ${name} — review its amount, or adjust the sell price.`,
    suggestionOther: "This margin is below your target. Ideas: adjust the sell price, or review the amount of the most expensive ingredients.",
    pantryEmptyPrompt: "Pick a category above or search to see your ingredients.",
    coefLabel: "Coef.",
    printRecipeSheet: "Print recipe sheet", printMenuLabel: "Print",
    exampleRecipeBadge: "Sample recipe",
    wizardStep1Title: "Edit or create an ingredient", wizardPriceStepTitle: "Price and unit", wizardCategoryStepTitle: "Which category?",
    wizardEstimatePrice: "Don't have the price on hand? Estimate a temporary price",
    wizardBack: "Back", wizardNext: "Next", wizardSave: "Save", wizardCreate: "Create ingredient",
    wizardSuccess: "Added to the pantry!", wizardUpdated: "Price updated!",
    wizardExistingSection: "Existing ingredients — edit price", wizardCatalogSection: "Suggestions",
    wizardSearchHint: "Type an ingredient's name to search it or create a new one.",
    recentIngredients: "Recent", noRecentIngredients: "No ingredient scanned or edited recently.",
    selectAllRecent: "Select all", deselectAll: "Deselect all",
    deleteSelectedButton: (n) => `Delete (${n})`,
    deleteSelectedConfirm: (n) => `Permanently delete ${n} selected ingredient${n > 1 ? "s" : ""}? This action is irreversible.`,
    pantryOnboardingHint: "These prices are just examples for the demo recipe. Scan your own invoices to fill your pantry with your real supplier prices.",
    pantryReclassifyHint: (n) => `${n} ingredient${n > 1 ? "s" : ""} in "Other" can be classified automatically.`,
    pantryReclassifyButton: "Classify now",
    categoryLabel: "Category",
    recentToday: "Today", recentWeek: "This week", recentMonth: "This month",
    deleteRecipeConfirm: (name) => `Permanently delete the recipe "${name}"?`,
    allergenSheetLink: "Allergen sheet", allergenSheetTitle: "Allergen sheet — all recipes",
    allergenSheetNone: "No allergens listed",
    digitalMenuButton: "Digital menu", digitalMenuTitle: "My digital menu",
    digitalMenuHint: "Generate a public menu (with QR code) from your recipes. It updates itself automatically whenever you change a price.",
    digitalMenuPublishLabel: "Publish my menu", digitalMenuPublishHint: "While this is off, nobody can see the menu, even with the link.",
    digitalMenuRestaurantNameLabel: "Restaurant name", digitalMenuRestaurantNamePlaceholder: "e.g. Chez Marge",
    digitalMenuDesignLabel: "Design", digitalMenuDesignClassic: "Classic", digitalMenuDesignModern: "Modern",
    digitalMenuDesignElegant: "Elegant", digitalMenuDesignBistro: "Bistro",
    digitalMenuCategoriesLabel: "Menu sections", digitalMenuCategoryAdd: "Add",
    digitalMenuCategoryAddPlaceholder: "e.g. Pizzas, Sauces…",
    digitalMenuSimpleItemsLabel: "Simple items (drinks, etc.)",
    digitalMenuSimpleItemsHint: "For things resold as-is (Coke, Perrier…) — no need to create a recipe.",
    digitalMenuSimpleItemNamePlaceholder: "Name (e.g. Coke 330ml)",
    digitalMenuSimpleItemCostLabel: "Purchase cost:", digitalMenuSimpleItemAddCost: "+ add a purchase cost",
    digitalMenuConvertToRecipe: "See its margin",
    digitalMenuCopyLink: "Copy link", digitalMenuLinkCopied: "Copied!", digitalMenuDownloadQr: "Download QR code",
    digitalMenuRecipesLabel: "Recipes shown on the menu", digitalMenuNoRecipes: "Create a recipe to add it to the menu.",
    digitalMenuDescriptionPlaceholder: "Description for the customer (optional)",
    publicMenuNotAvailable: "This menu isn't available right now.",
    publicMenuNoDishes: "No dishes on the menu yet.",
    publicMenuPoweredBy: "Menu generated with Chefup",
    digitalMenuLogoLabel: "Logo", digitalMenuLogoUpload: "Choose an image", digitalMenuLogoRemove: "Remove",
    digitalMenuLogoError: "Couldn't read this image, try another one.",
    digitalMenuPreview: "View menu", digitalMenuTranslateHint: "Translate to:",
    digitalMenuTranslateError: "Couldn't translate, try again.", digitalMenuTranslating: "Translating…",
    digitalMenuCategoryNone: "No section",
    scanImport: "Add to pantry", scanImported: "Added to pantry ✓", scanImportAll: "Import these lines",
    scanPriceIncrease: "Price up", scanNoItems: "No product could be identified with confidence on this document — rather than guessing, the app prefers to show nothing. Try a sharper photo, cropped tighter on the product table (without the rest of the page), or send a PDF if you have one.",    scanHint: "Check and correct each line before importing — the AI can make mistakes.",
    scanWeightLabel: "Weight of 1 piece (leave at 0 if truly priced by unit):",
    scanRecipeButton: "Scan a recipe sheet", scanningRecipe: "Reading the recipe sheet…",
    scanRecipeResultTitle: "Scanned recipe sheet",
    scanRecipeHint: "Check the ingredient names, quantities and matches before creating the recipe — the AI can make mistakes. Works best on a simple recipe sheet (a direct ingredient list); a very detailed pro sheet with several sub-recipes (sauces, bases...) will need more review.",
    scanRecipeIngredientsLabel: "Detected ingredients", scanRecipeNoLines: "No ingredient detected — you'll be able to add them manually.",
    scanRecipeImpreciseWarning: (raw) => `Imprecise quantity on the sheet ("${raw}") — enter the real weight/volume`,
    scanRecipeCreateButton: "Create the recipe", scanRecipeRemoveLine: "Remove this line",
    scanTab: "Scanner", scanTabHint: "Import your invoice as a PDF from Bidfood, Brakes or any other supplier (or take a photo) — the AI takes care of the rest.",
    scanTabHintIOS: "Take a photo of your invoice — the AI takes care of the rest. (PDF isn't available on iPhone yet, an Apple bug currently prevents reading it reliably.)",
    scanTakePhoto: "Take a photo", scanUploadFile: "Import a file (PDF, photo...)", scanUploadFileIOS: "Import a photo (gallery)",
    scanRecommendedBadge: "Recommended — more accurate",
    scanTipTitle: "💡 Tip for an optimal scan:",
    scanTipBody: "For maximum accuracy, prefer importing the original PDF file from your supplier (Bidfood, Brakes, etc.). If you take a photo, lay the invoice flat under good lighting. Careful: blur, shadows, creases and glare all reduce the AI's accuracy.",
    scanTipBodyIOS: "Got the invoice as a PDF (by email, etc.)? Open it, turn your phone sideways if the table is wide so you can see the price column, then take a SCREENSHOT (not a camera photo) — sharp always beats blurry. If it doesn't all fit in one screenshot, take 2 (left/right or top/bottom). Then import the screenshot(s) with the \"Import a photo\" button above: they're in your camera roll like any photo.",
    scanColisUnit: "pack",
    marginExcellentMsg: "Excellent margin!", marginGoodMsg: "Good margin, you're above your target.",
    marginCloseMsg: "Just below your desired margin, but it's still a good margin on this dish.",
    marginWatchMsg: "Below your desired margin — keep an eye on this dish.",
    marginLowMsg: "Margin far too low: this dish isn't profitable as it stands.",
    marginLowFixMsg: "Margin too low, needs fixing quickly.",
    vatOption10Hint: "food service", vatOption21Hint: "Spain VAT",
    recipeLineIngredientPlaceholder: "Choose an ingredient…",
    recipeCreateIngredientFromLine: "Create a new ingredient",
    recipeTargetReached: "This recipe's target reached",
    marginLegendWithOrange: (green, crit) => `Green ≥ ${green}% · Orange between ${crit}–${green}% · Red < ${crit}%`,
    marginLegendNoOrange: (crit) => `Green ≥ ${crit}% · Red < ${crit}% (no orange zone with this threshold)`,
    deleteRecipeButton: "Delete this recipe",
    deleteLabel: "Delete", deleteIngredientButton: "Delete ingredient",
    authLoginTitle: "Log in", authSignupTitle: "Create an account", authForgotTitle: "Forgot password", authResetTitle: "New password",
    authEmailLabel: "Email", authPasswordLabel: "Password", authNewPasswordLabel: "New password", authConfirmPasswordLabel: "Confirm password",
    authEmailPlaceholder: "you@example.com", authPasswordPlaceholder: "6 characters minimum", authConfirmPasswordPlaceholder: "Type the same password again",
    authLoginButton: "Log in", authSignupButton: "Create my account", authForgotButton: "Send reset link", authResetButton: "Confirm new password",
    authForgotLink: "Forgot password?", authSwitchToSignup: "No account yet? Create one", authSwitchToLogin: "Already have an account? Log in", authBackToLogin: "Back to login",
    authSignupSuccessInfo: "Account created! Check your inbox to confirm your address (also check your spam/junk folder), then log in.",
    authForgotSuccessInfo: "If an account exists with this email, a reset link was just sent.",
    authContinueButton: "Continue", authMagicLinkSignupButton: "Get a code by email",
    authMagicLinkButton: "Get a code by email", authMagicLinkInfo: "Code sent! Check your inbox (and spam folder).",
    authOrDivider: "or",
    authOtpTitle: "Check your email", authOtpSubtitle: (email) => `We just sent a code to ${email}.`,
    authOtpVerifyButton: "Confirm code", authOtpResend: "Resend code", authOtpBack: "← Back",
    authErrorOtpInvalid: "Wrong or expired code. Try again, or send a new one.",
    authErrorRateLimit: "Too many attempts — try again in a minute.",
    authErrorInvalidCredentials: "Incorrect email or password.", authErrorAlreadyRegistered: "An account already exists with this email.",
    authAlreadyRegisteredGoLogin: "Log in with this account",
    authErrorEmailNotConfirmed: "Confirm your email address first before logging in — the link was sent by email, remember to check your spam/junk folder too.",
    authResendConfirmationButton: "Resend the confirmation email",
    authResendConfirmationSent: "Email resent! Check your inbox AND your spam folder.",
    authErrorPasswordTooShort: "Password must be at least 6 characters.", authErrorInvalidEmail: "Invalid email address.",
    authErrorGeneric: "Something went wrong. Please try again.", authErrorPasswordMismatch: "The two passwords don't match.",
    authTagline: "Calculate your margins with ease", authSignupFreeNote: "7-day free trial, no credit card required.",
    landingHeroTitle: "Your menu is hiding dishes that cost you money",
    landingHeroSubtitle: "Enter your numbers, see your real margin. Takes 10 seconds.",
    landingHowItWorksTitle: "How it works",
    landingStep1Title: "Scan your invoice", landingStep1Desc: "Photo or file — your pantry prices update themselves.",
    landingStep2Title: "Your margin gets calculated", landingStep2Desc: "Cost, tax, sell price: your margin shows up instantly, dish by dish.",
    landingStep3Title: "Generate your digital menu", landingStep3Desc: "A QR code with your prices always up to date, no retyping ever.",
    landingPreviewDish: "Beef Bourguignon", landingPreviewMarginLabel: "margin",
    landingPreviewCost: "Cost / serving", landingPreviewPrice: "Sell price",
    landingCtaStart: "Start for free", landingCtaLogin: "I already have an account",
    landingFeatureScanTitle: "AI invoice scanning", landingFeatureScanDesc: "Snap a photo or upload your invoice: your pantry prices update themselves.",
    landingFeatureMarginTitle: "Real-time margin per recipe", landingFeatureMarginDesc: "Ingredient cost, VAT, selling price: your margin recalculates instantly with every change.",
    landingFeaturePrintTitle: "Print-ready sheets", landingFeaturePrintDesc: "Spec sheet (with or without prices) and allergen sheet for every recipe, ready for the kitchen or an inspection.",
    landingFeatureMenuTitle: "Digital menu with QR code", landingFeatureMenuDesc: "Generate a public menu from your recipes — the price updates itself the moment you change it in the app.",
    landingFeaturePantryTitle: "Multi-supplier pantry", landingFeaturePantryDesc: "Price history, several suppliers per ingredient, prep loss taken into account.",
    calcTitle: "Try it right now",
    calcSubtitle: "Take one of your dishes and put in your own numbers.",
    calcCostLabel: "What the ingredients cost you, per portion",
    calcPriceLabel: "Your selling price, incl. VAT",
    calcResultLabel: "Your margin",
    calcVerdictHigh: "Good margin — this dish is working for you.",
    calcVerdictMid: "Decent margin, but you can do better.",
    calcVerdictLow: "Margin too low: this dish costs you more than it earns.",
    calcVatNote: (v) => `Calculated excluding tax, ${v}% VAT (dine-in) — exactly like in the app.`,
    firstRunTitle: "Your first dish",
    firstRunHint: "Let us create its sheet right now. You will add its ingredients straight after, and its margin will appear.",
    firstRunDishLabel: "Dish name",
    firstRunDishPlaceholder: "House burger, Caesar salad…",
    firstRunPriceLabel: "Your selling price, incl. VAT",
    firstRunPriceHint: "The price of one plate, as it appears on your menu.",
    firstRunCreate: "Create my recipe sheet",
    firstRunSkip: "Skip, I will look around myself",
    calcMoreTitle: "That is one dish. Inside Chefup:",
    calcMore1: "This cost fills itself in: photograph your invoice and the prices update across your recipes.",
    calcMore2: "Your whole menu is recalculated on every supplier price rise, and you are alerted when a dish drops below your target.",
    calcMore3: "Printable spec sheets, allergen sheet and QR-code digital menu included.",
    calcCta: "Do this for my whole menu",
    landingPricingTitle: "One price, everything included", landingPricingTrial: "7-day free trial, no credit card required",
    landingPricingCta: "Start my free trial", landingPricingPerMonth: "/ month",
    landingLegalNotice: "Legal notice", landingTerms: "Terms", landingPrivacy: "Privacy",
    consentText: "We would like to measure whether the ad that brought you here works. That involves a TikTok tracker. You can refuse — the site works exactly the same.",
    consentAccept: "Accept", consentRefuse: "Refuse",
    landingPricingFeature1: "Unlimited recipes and margins", landingPricingFeature2: "AI invoice scanning",
    landingPricingFeature3: "Printable spec & allergen sheets", landingPricingFeature4: "Digital menu with QR code", landingPricingFeature5: "Cancel anytime",
  },
};

const SEED_INGREDIENTS = [
  { id: "i1", name: "Bœuf (paleron / gîte)", unit: "kg", catalogId: "boeuf", category: "viandes", lossPercent: 10,
    selectedSupplierId: "s1", suppliers: [{ id: "s1", name: "Métro", price: 14.5, priceSource: "estimate" }],
    history: [{ date: "2026-05-02", price: 13.9, supplierName: "Métro" }] },
  { id: "i2", name: "Carottes", unit: "kg", catalogId: "carottes", category: "legumes", lossPercent: 10,
    selectedSupplierId: "s2", suppliers: [{ id: "s2", name: "Grossiste local", price: 1.2, priceSource: "estimate" }], history: [] },
  { id: "i3", name: "Oignons", unit: "kg", catalogId: "oignons", category: "legumes", lossPercent: 8,
    selectedSupplierId: "s3", suppliers: [{ id: "s3", name: "Grossiste local", price: 1.1, priceSource: "estimate" }], history: [] },
  { id: "i4", name: "Vin rouge de cuisine", unit: "L", catalogId: "vin_rouge", category: "boissons",
    selectedSupplierId: "s4", suppliers: [{ id: "s4", name: "Cavavin Pro", price: 4.5, priceSource: "estimate" }], history: [] },
  { id: "i5", name: "Lardons", unit: "kg", catalogId: null, category: "viandes",
    selectedSupplierId: "s5", suppliers: [{ id: "s5", name: "Métro", price: 9.8, priceSource: "estimate" }], history: [] },
  { id: "i6", name: "Champignons de Paris", unit: "kg", catalogId: "champignons", category: "legumes", lossPercent: 5,
    selectedSupplierId: "s6", suppliers: [{ id: "s6", name: "Grossiste local", price: 5.2, priceSource: "estimate" }], history: [] },
  { id: "i7", name: "Beurre doux", unit: "kg", catalogId: "beurre", category: "cremerie",
    selectedSupplierId: "s7",
    suppliers: [{ id: "s7", name: "Métro", price: 7.5, priceSource: "estimate" }, { id: "s7b", name: "Transgourmet", price: 7.1, priceSource: "estimate" }],
    history: [] },
  { id: "i8", name: "Tagliatelles", unit: "kg", catalogId: "tagliatelles", category: "epicerie",
    selectedSupplierId: "s8", suppliers: [{ id: "s8", name: "Métro", price: 2.8, priceSource: "estimate" }], history: [] },
];

// La recette de démo doit rester lisible quelle que soit la langue d'interface choisie dès le
// premier lancement — avant ce correctif, seul le nom/les champs UI étaient traduits, mais les
// instructions et l'allergène restaient toujours en français même en anglais/espagnol (repéré en
// test réel, 2026-08). "Bœuf bourguignon" reste inchangé dans les 3 langues (nom de plat reconnu
// tel quel), le "(recette exemple)" redondant avec le badge déjà traduit "RECETTE EXEMPLE" a été
// retiré plutôt que traduit.
const SEED_RECIPE_NOTES = {
  fr: "Détaillez le bœuf en cubes de 4-5 cm, salez, poivrez. Faites-le mariner 12h au frais dans le vin rouge avec thym, laurier et un oignon émincé. Égouttez la viande en réservant la marinade, épongez-la bien avant de la saisir à feu vif dans un mélange beurre/huile jusqu'à belle coloration ; réservez. Faites revenir les lardons, puis les oignons et les carottes coupés en rondelles. Remettez la viande, saupoudrez d'une cuillère de farine, mouillez avec la marinade filtrée et complétez avec un peu d'eau ou de fond si besoin pour bien couvrir. Portez à frémissement, couvrez et laissez mijoter 3h à feu très doux. Ajoutez les champignons 30 min avant la fin de cuisson. Rectifiez l'assaisonnement, montez la sauce avec le reste du beurre bien froid hors du feu pour la lier et la lustrer. Pendant ce temps, faites cuire les tagliatelles al dente dans l'eau bouillante salée, égouttez-les. Dressez le bœuf bourguignon et sa sauce sur les tagliatelles, parsemez de persil frais ciselé.",
  es: "Corta la carne de vacuno en dados de 4-5 cm, sala y pimienta. Déjala marinar 12h en la nevera en el vino tinto con tomillo, laurel y una cebolla picada. Escurre la carne reservando la marinada, sécala bien antes de sellarla a fuego fuerte en una mezcla de mantequilla/aceite hasta que quede bien dorada; reserva. Sofríe el bacon, luego la cebolla y las zanahorias cortadas en rodajas. Vuelve a añadir la carne, espolvorea con una cucharada de harina, moja con la marinada colada y completa con un poco de agua o caldo si hace falta para cubrir bien. Lleva a ebullición suave, tapa y cocina a fuego muy bajo durante 3h. Añade los champiñones 30 min antes de terminar la cocción. Rectifica la sazón, liga la salsa con el resto de la mantequilla bien fría fuera del fuego para espesarla y darle brillo. Mientras tanto, cuece los tallarines al dente en agua hirviendo con sal y escúrrelos. Sirve la carne y su salsa sobre los tallarines, espolvoreada con perejil fresco picado.",
  en: "Cut the beef into 4-5 cm cubes, season with salt and pepper. Marinate for 12h in the fridge in the red wine with thyme, bay leaf and a chopped onion. Drain the meat, keeping the marinade, and pat it dry before searing it over high heat in a butter/oil mix until nicely browned; set aside. Sauté the lardons, then the onions and carrots cut into rounds. Add the meat back in, sprinkle with a spoonful of flour, moisten with the strained marinade and top up with a little water or stock if needed to cover well. Bring to a gentle simmer, cover and cook on very low heat for 3h. Add the mushrooms 30 min before the end of cooking. Adjust the seasoning, then swirl in the rest of the cold butter off the heat to thicken and give the sauce a glossy finish. Meanwhile, cook the tagliatelle al dente in salted boiling water and drain. Plate the beef and its sauce over the tagliatelle, sprinkled with freshly chopped parsley.",
};
const SEED_RECIPE_ALLERGENS = { fr: "Sulfites (vin)", es: "Sulfitos (vino)", en: "Sulfites (wine)" };

// Vrai uniquement si LA recette de démo (id "r1") n'a jamais été modifiée (notes/allergènes
// encore identiques à l'une des 3 langues connues) — sert à décider si on peut la reconstruire
// dans une nouvelle langue sans risquer d'écraser un vrai texte tapé par l'utilisateur. Ne
// dépend PAS du nombre total de recettes : un utilisateur qui a déjà créé ses propres recettes
// à côté doit quand même voir la démo se traduire tant qu'il n'a personnellement rien changé dedans.
function isPristineSeedRecipe(r) {
  return !!r && r.id === "r1" && Object.values(SEED_RECIPE_NOTES).includes(r.notes) && Object.values(SEED_RECIPE_ALLERGENS).includes(r.allergens);
}

// Reconstruit la recette de démo dans la langue demandée — appelée au premier chargement (langue
// sauvegardée si elle existe) et à chaque changement de langue tant que l'utilisateur n'a pas
// modifié la recette lui-même (voir isPristineSeedRecipe, changeLang dans App).
function buildSeedRecipes(lang) {
  return [
    {
      id: "r1", name: "Bœuf bourguignon", portions: 6, sellPrice: 20.9, targetMargin: 75, isExample: true,
      notes: SEED_RECIPE_NOTES[lang] || SEED_RECIPE_NOTES.fr,
      allergens: SEED_RECIPE_ALLERGENS[lang] || SEED_RECIPE_ALLERGENS.fr,
      allergensAuto: false, createdAt: "2026-06-10",
      lines: [
        { ingredientId: "i1", qty: 1.2 }, { ingredientId: "i2", qty: 0.4 }, { ingredientId: "i3", qty: 0.3 },
        { ingredientId: "i4", qty: 0.75 }, { ingredientId: "i5", qty: 0.15 }, { ingredientId: "i6", qty: 0.25 },
        { ingredientId: "i7", qty: 0.08 }, { ingredientId: "i8", qty: 0.6 },
      ],
    },
  ];
}

const DEFAULT_SETTINGS = { vat: 10, minMargin: 75, emailRemindersEnabled: true };

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

// Prix réellement utilisable en cuisine une fois le parage/la perte pris en compte
// (ex: 20% de perte sur du poisson brut -> le kg utile coûte plus cher que le kg acheté).
// lossPercent vit sur l'ingrédient (pas sur la ligne de recette) : une seule vérité,
// modifiable depuis le garde-manger ou directement depuis une fiche recette.
// Le garde-fou à 95 évite une division par un nombre proche de 0 si une valeur
// aberrante (>=100) est un jour stockée.
function effectiveUnitPrice(ing) {
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
function priceVariation(ing) {
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
function logActivity(type, meta) {
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

// `onCommit` (2026-08-27) : appelé une seule fois, quand le champ perd le focus — c'est-à-dire
// quand la saisie est VRAIMENT terminée. `onChange`, lui, se déclenche à chaque touche frappée.
// La distinction est indispensable dès qu'une frappe a un effet durable : voir le bug de
// l'historique des prix corrigé le même jour (taper "1.70" créait une entrée d'historique "1"
// puis une entrée "1.7", donc une fausse hausse de +70% affichée sur un prix pourtant baissé).
function NumField({ value, onChange, onCommit, className, allowDecimal = true, ...rest }) {
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
      onBlur={() => {
        focusedRef.current = false;
        setLocal(value === 0 || !value ? "" : String(value));
        if (onCommit) onCommit(typeof value === "number" ? value : 0);
      }}
      className={className} {...rest}
    />
  );
}

// Affiche/édite les quantités de recette en g/mL (jamais en décimales de kg/L, ex : 50 g
// plutôt que 0.05), avec deux flèches empilées pour ajuster sans calcul mental — le clavier
// reste utilisable en plus. Le stockage interne (line.qty, prix au kg/L) ne change pas, seule
// la conversion d'affichage x1000 est appliquée. L'unité affichée (g/mL vs kg/L) ne se
// recalcule jamais pendant la frappe (focus), pour ne pas changer l'interprétation du texte
// en cours de saisie ; elle bascule automatiquement au-delà de 1000 (ex : 1000g -> 1 kg).
function QtyField({ qty, unit, onChange, className, t }) {
  const isSmallUnit = unit === "kg" || unit === "L";
  const focusedRef = useRef(false);

  // [2026-08-27, 2e passe] Retour à un affichage automatique en kg/L au-delà de 1000 g/mL,
  // demandé par l'utilisateur pour la LECTURE de la fiche recette ("plus facile à lire") — mais
  // SANS bouton de bascule manuelle : celui-là avait été supprimé le même jour, à raison, pour une
  // tout autre partie de l'app (la SAISIE rapide, `QuickAddLine`, qui elle reste TOUJOURS en
  // grammes/mL — un ingrédient qu'on ajoute se pense en grammes, pas en fraction de kilo). Les
  // deux besoins ne se contredisent pas : l'un est une saisie (toujours petite unité), l'autre un
  // affichage une fois la ligne déjà dans la recette (bascule automatique selon la grandeur).
  // L'unité affichée reste GELÉE pendant la frappe dans CE champ (via `smallAtFocus`, capturé une
  // seule fois au focus) : sans ça, taper "1000" ferait basculer l'affichage de g vers kg au
  // milieu de la frappe, changeant l'interprétation du texte en cours de saisie — piège déjà
  // rencontré et évité par le passé sur ce même champ, avant sa simplification temporaire du matin.
  const autoSmall = isSmallUnit && (qty || 0) < 1;
  const smallAtFocus = useRef(autoSmall);
  const displaySmall = focusedRef.current ? smallAtFocus.current : autoSmall;

  const factor = isSmallUnit && displaySmall ? 1000 : 1;
  const displayUnit = isSmallUnit ? (displaySmall ? (unit === "kg" ? "g" : "mL") : unit) : unit;
  const step = isSmallUnit ? (displaySmall ? 25 : 0.1) : unit === "pièce" ? 1 : 0.1;
  const rawValue = Math.round((qty || 0) * factor * 1000) / 1000;

  const [local, setLocal] = useState(rawValue === 0 ? "" : String(rawValue));
  useEffect(() => {
    if (focusedRef.current) return;
    setLocal(rawValue === 0 ? "" : String(rawValue));
  }, [rawValue]);

  const commit = (displayVal) => onChange(Math.max(0, displayVal) / factor);

  const handleChange = (e) => {
    let v = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
    const firstDot = v.indexOf(".");
    if (firstDot !== -1) v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    if (/^0[0-9]/.test(v)) v = v.replace(/^0+/, "");
    setLocal(v);
    const num = v === "" || v === "." ? 0 : parseFloat(v);
    commit(isNaN(num) ? 0 : num);
  };

  const bump = (dir) => commit(Math.round((rawValue + dir * step) * 1000) / 1000);

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <input
        type="text"
        inputMode="decimal"
        value={local}
        onChange={handleChange}
        onFocus={(e) => { smallAtFocus.current = autoSmall; focusedRef.current = true; e.target.select(); }}
        onBlur={() => { focusedRef.current = false; setLocal(rawValue === 0 ? "" : String(rawValue)); }}
        className={className}
      />
      <div className="flex flex-col print:hidden">
        <button type="button" onClick={() => bump(1)} className="text-black/30 hover:text-black/70 leading-none" style={{ padding: "0 1px" }}>
          <ChevronUp size={10} />
        </button>
        <button type="button" onClick={() => bump(-1)} className="text-black/30 hover:text-black/70 leading-none" style={{ padding: "0 1px" }}>
          <ChevronDown size={10} />
        </button>
      </div>
      <span className="text-black/40 text-[11px] shrink-0">{unitDisplayLabel(displayUnit, t)}</span>
    </div>
  );
}
// [SAISIE EN RAFALE, 2026-08-27] Ligne d'ajout rapide en tête de la liste d'ingrédients.
// Conçue pour enchaîner sans lever les doigts du clavier : on tape le nom, Entrée passe à la
// quantité (en grammes), Entrée valide et le focus revient sur le nom pour l'ingrédient suivant.
// Même principe que la saisie des articles de la carte digitale, que l'utilisateur trouvait
// rapide — par opposition à l'ancien parcours "créer une ligne vide → ouvrir un sélecteur →
// choisir → revenir saisir la quantité", jugé "vraiment chiant" en test réel.
// Les suggestions montrent d'abord le garde-manger (prix déjà connus, donc marge juste) puis le
// catalogue de référence ; un nom totalement inédit reste acceptable et crée l'ingrédient.
function QuickAddLine({ ingredients, ingredientDisplayName, lang, t, onAdd, guessUnit, guessPrice }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [picked, setPicked] = useState(null); // id si choisi dans le garde-manger, sinon null
  // [BUG confirmé et corrigé, 2026-08-27] `picked` ne suffit pas à savoir si une suggestion a été
  // choisie : un ingrédient qui vient du CATALOGUE (pas encore dans le garde-manger) a un id null
  // — exactement la même valeur que "rien n'a encore été choisi". Résultat signalé en test réel
  // ("lait entier" cliqué mais la liste de suggestions ne se refermait jamais, cachant les
  // pastilles g/mL/pièce juste en dessous) : `!picked` restait vrai après un clic sur une
  // suggestion du catalogue, donc la liste continuait de se réafficher. Un booléen séparé, qui ne
  // se soucie que de "une suggestion a-t-elle été cliquée", règle ça sans toucher au sens de
  // `picked` (toujours utilisé ailleurs comme l'id à transmettre à l'ajout).
  const [suggestionPicked, setSuggestionPicked] = useState(false);
  const [unit, setUnit] = useState("kg");
  // Vrai dès que l'utilisateur a choisi l'unité lui-même : on cesse alors de la deviner à sa
  // place, sinon on écraserait son choix à la frappe suivante.
  const unitTouched = useRef(false);
  const priceTouched = useRef(false);
  const nameRef = useRef(null);
  const amountRef = useRef(null);

  const q = name.trim();

  // L'unité ET le prix se devinent à partir du nom tapé, à chaque frappe, tant que l'utilisateur
  // n'y a pas touché lui-même. Le catalogue connaît l'unité de ses 195 entrées et le garde-manger
  // connaît les vrais prix déjà saisis : sans s'en servir, tout était saisi en grammes et un nom
  // inconnu tombait même en "pièce" (cas réel : "croûtons" ajouté à 5€ la pièce).
  useEffect(() => {
    if (suggestionPicked || q.length < 3) return;
    if (!unitTouched.current && guessUnit) {
      const g = guessUnit(q);
      setUnit((u) => (u === g ? u : g));
    }
    if (!priceTouched.current && guessPrice) {
      const gp = guessPrice(q);
      setPrice((cur) => (String(gp) === cur ? cur : gp ? String(gp) : ""));
    }
  }, [q, suggestionPicked, guessUnit, guessPrice]);

  const suggestions =
    q.length >= 2 && !suggestionPicked
      ? [
          ...ingredients
            .filter((i) => textIncludes(ingredientDisplayName(i), q))
            .slice(0, 4)
            .map((i) => ({ key: "ing-" + i.id, label: ingredientDisplayName(i), id: i.id, unit: normUnit(i.unit), price: activeSupplier(i)?.price || 0, known: true })),
          ...CATALOG.filter((c) => textIncludes(c[lang] || c.fr, q) && !ingredients.some((i) => i.catalogId === c.id))
            .slice(0, 3)
            .map((c) => ({ key: "cat-" + c.id, label: c[lang] || c.fr, id: null, unit: normUnit(c.unit), price: CATEGORY_ESTIMATE_PRICE[c.cat] || 5, known: false })),
        ]
      : [];

  // Le nombre saisi est exprimé dans l'unité AFFICHÉE ; l'unité de STOCKAGE reste kg/L.
  const placeholderAmount = unit === "L" ? "100" : unit === "pièce" ? "1" : "150";
  const priceUnitLabel = unit === "kg" ? "/kg" : unit === "L" ? "/L" : "/" + unitDisplayLabel("pièce", t);

  const pickUnit = (u) => {
    unitTouched.current = true;
    setUnit(u);
    amountRef.current?.focus();
  };

  const submit = () => {
    const n = parseFloat(String(amount).replace(",", "."));
    if (!q || !Number.isFinite(n) || n <= 0) return;
    const pr = parseFloat(String(price).replace(",", "."));
    onAdd({ existingId: picked, name: q, grams: n, unit, price: Number.isFinite(pr) && pr > 0 ? pr : 0 });
    setName("");
    setAmount("");
    setPrice("");
    setPicked(null);
    setSuggestionPicked(false);
    unitTouched.current = false;
    priceTouched.current = false;
    nameRef.current?.focus();
  };

  return (
    <div className="print:hidden mb-3">
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0 relative">
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => { setName(e.target.value); setPicked(null); setSuggestionPicked(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); amountRef.current?.focus(); } }}
            placeholder={t("quickAddNamePlaceholder")}
            className="w-full bg-white rounded-lg px-2.5 py-2.5 text-sm text-black outline-none border border-black/15 focus:border-[#8B5CF6]"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-lg border border-black/10 bg-white">
              {suggestions.map((sg) => (
                <button
                  key={sg.key}
                  type="button"
                  onClick={() => {
                    setName(sg.label);
                    setPicked(sg.id);
                    setSuggestionPicked(true);
                    // Unité ET prix viennent de la source choisie : le garde-manger si
                    // l'ingrédient existe déjà (ses valeurs font foi), le catalogue sinon.
                    unitTouched.current = false;
                    priceTouched.current = false;
                    setUnit(sg.unit || "kg");
                    setPrice(sg.price ? String(sg.price) : "");
                    amountRef.current?.focus();
                  }}
                  className="w-full text-left px-2.5 py-2 text-xs text-black/80 hover:bg-black/5 flex items-center gap-2 border-b border-black/5 last:border-0"
                >
                  <span className="flex-1 min-w-0 truncate">{sg.label}</span>
                  {/* Un ingrédient déjà dans le garde-manger a un vrai prix : le signaler évite
                      d'en recréer un doublon sans s'en rendre compte. */}
                  {sg.known && <span className="text-[9px] uppercase tracking-wide text-[#10B981] shrink-0">{t("quickAddKnown")}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          ref={amountRef}
          value={amount}
          inputMode="decimal"
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={placeholderAmount}
          className="w-14 shrink-0 bg-white rounded-lg px-2 py-2.5 text-sm text-black text-right outline-none border border-black/15 focus:border-[#8B5CF6]"
        />
        <button
          type="button"
          onClick={submit}
          className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white"
          style={{ background: BRAND_GRADIENT }}
          title={t("quickAddButton")}
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Unité et prix sur une deuxième ligne : tous deux pré-remplis automatiquement, donc
          rarement à toucher — mais VISIBLES, pour qu'on sache dans quoi on saisit et sur quel prix
          la marge va se calculer. C'est ce qui manquait à l'ancienne bascule kg/g minuscule, et ce
          qui a laissé passer un ingrédient ajouté à 5€ la pièce sans que personne ne le voie. */}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {[
          { u: "kg", label: "g" },
          { u: "L", label: "mL" },
          { u: "pièce", label: unitDisplayLabel("pièce", t) },
        ].map((opt) => (
          <button
            key={opt.u}
            type="button"
            onClick={() => pickUnit(opt.u)}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold border"
            style={
              unit === opt.u
                ? { background: BRAND_SOLID, borderColor: BRAND_SOLID, color: "#fff" }
                : { background: "transparent", borderColor: "rgba(0,0,0,0.15)", color: "rgba(0,0,0,0.45)" }
            }
          >
            {opt.label}
          </button>
        ))}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[10px] text-black/35">{t("quickAddPriceLabel")}</span>
          <input
            value={price}
            inputMode="decimal"
            onChange={(e) => { priceTouched.current = true; setPrice(e.target.value.replace(/[^0-9.,]/g, "")); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
            placeholder="0"
            className="w-14 bg-white rounded px-1.5 py-1 text-[12px] text-black text-right outline-none border border-black/15 focus:border-[#8B5CF6]"
          />
          <span className="text-[10px] text-black/35">€{priceUnitLabel}</span>
        </div>
      </div>
    </div>
  );
}
// Sélecteur d'ingrédient avec recherche (remplace un <select> qui deviendrait interminable).
// Tape au moins 2 lettres pour filtrer, clique une suggestion pour choisir. Sert désormais
// surtout à CORRIGER une ligne existante — l'ajout passe par QuickAddLine ci-dessus.
function IngredientPicker({
  ingredients, value, displayName, onChange, className, autoOpen, placeholder, onCreateNew, createNewLabel,
  searchPlaceholder = "Tape 2 lettres…", typeToSearchText = "Tape pour chercher…", noResultsText = "Aucun résultat",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const current = ingredients.find((i) => i.id === value);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    } else if (wrapRef.current) {
      // Recentre la carte à l'écran pour que les suggestions ne se retrouvent pas
      // masquées sous le clavier mobile.
      setTimeout(() => wrapRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 150);
    }
  }, [open]);

  // Rien affiché tant que l'utilisateur n'a pas commencé à taper (sinon les 8 premiers ingrédients
  // du garde-manger apparaissaient dès l'ouverture, avant même toute recherche — bruit inutile
  // repéré en test réel, 2026-08).
  const filtered =
    query.trim().length >= 2
      ? ingredients.filter((i) => textIncludes(displayName(i), query)).slice(0, 8)
      : [];

  return (
    <div className={`relative ${className || ""}`} ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left truncate outline-none"
      >
        {current ? displayName(current) : <span className="opacity-40">{placeholder || "…"}</span>}
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 w-56 max-w-[80vw] rounded-xl overflow-hidden shadow-xl border border-white/10" style={{ background: "#26221C" }}>
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-white/10">
            <Search size={12} className="text-white/40 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-white text-xs outline-none min-w-0"
              onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((i) => (
              <button
                key={i.id}
                onMouseDown={(e) => { e.preventDefault(); onChange(i.id); setOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-white/10 ${i.id === value ? "text-[#8B5CF6]" : "text-white/80"}`}
              >
                {displayName(i)}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2.5 py-2 text-xs text-white/30">
                {query.trim().length === 0 ? typeToSearchText : noResultsText}
              </div>
            )}
          </div>
          {onCreateNew && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onCreateNew(query.trim()); setOpen(false); }}
              className="w-full text-left px-2.5 py-2 text-xs text-[#8B5CF6] hover:bg-white/10 border-t border-white/10 flex items-center gap-1.5"
            >
              <Plus size={12} className="shrink-0" /> {createNewLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Exporté (2026-08-27) pour que le calculateur de la page d'accueil parle EXACTEMENT le même
// langage de couleurs que l'app : un visiteur qui voit du vert avant de créer son compte doit
// retrouver le même vert au même seuil une fois dedans. Dupliquer ces valeurs les aurait fait
// diverger au premier changement de seuil.
export const TIER_COLORS = { low: "#EF4444", mid: "#F59E0B", high: "#10B981" };
// Couleurs du badge de classement des recettes (TOP1/2/3), volontairement distinctes des
// TIER_COLORS ci-dessus qui ne servent qu'à la marge — or / argent / bronze, un rang = une couleur.
// Couleur de marque Chefup (2026-07-31), dégradé violet -> cyan, à ne jamais confondre avec
// TIER_COLORS/les indicateurs de statut (confiant/importé/prix en baisse = vert, à surveiller
// = orange, problème = rouge) qui restent inchangés — seul le chrome interactif générique
// (boutons, focus, sélection, onglets) passe à cette nouvelle couleur.
// Tarifs affichés (2026-08-26). Point unique de vérité pour tout ce qui est MONTRÉ à l'utilisateur
// (landing, écran de fin d'essai, emails) — ce qui est réellement facturé vient toujours de Stripe
// via STRIPE_PRICE_ID / STRIPE_FOUNDING_PRICE_ID sur Vercel. Les deux doivent rester cohérents :
// changer un prix ici sans créer le prix correspondant dans Stripe afficherait un montant faux.
// `founding` = offre de lancement, 50 places, verrouillé à vie (voir api/_lib.js, FOUNDING_SPOTS).
export const PRICING = { standard: 49, founding: 29 };

export const BRAND_SOLID = "#8B5CF6";
const BRAND_SOLID_PAPER = "#6D28D9";
export const BRAND_GRADIENT = "linear-gradient(135deg, #7C3AED 0%, #22D3EE 100%)";
export const BRAND_SHADOW = "inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 14px rgba(124,58,237,0.35)";
const TOP_BADGE_COLORS = ["#D4AF37", "#B4B8BC", "#C97F3F"];

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
const DESIGN_LABEL_KEYS = {
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
const priceChangeVisual = (item) => ({
  up: !!item.priceUp,
  color: item.priceUp ? (item.bigChange ? TIER_COLORS.low : TIER_COLORS.mid) : "#10B981",
});

const lightRawLabel = (raw) => {
  const s = (raw || "").trim();
  if (!s) return "";
  const cleaned = s.replace(/^[A-Z]{0,2}\d{3,8}\s+/i, "").trim();
  return cleaned || s;
};

// Choix explicite entre garder le nom existant, renommer l'ingrédient existant, ou créer un
// ingrédient séparé. Un seul bouton "Valider" ensuite applique toujours ce qui a été choisi ici
// — plus jamais de bouton "Valider" qui renomme silencieusement un ingrédient existant alors que
// l'intention était d'en créer un nouveau (les 3 issues possibles sont visibles au même endroit).
// `guessedIng` est résolu via `item.guessedMatchId`, qui reste stable même si l'utilisateur
// bascule sur "créer séparément" puis revient en arrière.
function ScanNameChoice({ item, guessedIng, ingredientDisplayName, onUpdate, t }) {
  if (!guessedIng) return null;
  const matchedName = ingredientDisplayName(guessedIng);
  const proposedName = item.name;
  const showRename = !!proposedName && proposedName !== matchedName;
  const selected = item.assignTo === "new" ? "new" : item.renameOnImport ? "rename" : "keep";

  const Option = ({ id, label, hint, hintColor, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-2 rounded-lg px-2.5 py-2 text-left"
      style={{
        background: selected === id ? `${BRAND_SOLID}22` : "rgba(255,255,255,0.05)",
        border: `1px solid ${selected === id ? BRAND_SOLID : "rgba(255,255,255,0.12)"}`,
      }}
    >
      <span
        className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center mt-0.5"
        style={{ border: `2px solid ${selected === id ? BRAND_SOLID : "rgba(255,255,255,0.3)"}` }}
      >
        {selected === id && <span className="w-2 h-2 rounded-full" style={{ background: BRAND_SOLID }} />}
      </span>
      <span className="min-w-0">
        <span className={`block text-xs font-medium ${selected === id ? "text-white" : "text-white/60"}`}>{label}</span>
        {hint && (
          <span className="block text-[10px] mt-0.5" style={{ color: hintColor || "rgba(255,255,255,0.3)" }}>
            {hint}
          </span>
        )}
      </span>
    </button>
  );

  return (
    <div className="space-y-1.5">
      <div className="text-[9px] uppercase tracking-wide text-white/35">{t("scanChooseNameLabel")}</div>
      <Option
        id="keep"
        label={matchedName}
        hint={t("scanExistingLabel")}
        onClick={() => onUpdate({ assignTo: item.guessedMatchId, renameOnImport: false })}
      />
      {showRename && (
        <Option
          id="rename"
          label={proposedName}
          hint={t("scanRenameWarning")(matchedName)}
          hintColor={TIER_COLORS.mid}
          onClick={() => onUpdate({ assignTo: item.guessedMatchId, renameOnImport: true })}
        />
      )}
      <Option
        id="new"
        label={t("scanCreateSeparateLabel")(proposedName || "?")}
        hint={t("scanCreateSeparateHint")}
        onClick={() => onUpdate({ assignTo: "new", renameOnImport: false })}
      />
    </div>
  );
}

// Convertit une contenance (poids ou volume d'une pièce) vers l'unité de base utilisée pour
// le prix au kg/L — kg et g se ramènent au kg, L et cl se ramènent au L.
const CALC_CONTENT_UNITS = {
  kg: { base: "kg", factor: 1 },
  g: { base: "kg", factor: 0.001 },
  L: { base: "L", factor: 1 },
  cl: { base: "L", factor: 0.01 },
  // Pour les produits vendus directement à la pièce (pas de poids/volume à convertir, ex: les
  // 3 PCE d'un plateau sans poids indiqué) : "1 pièce" vaut simplement 1, le prix final reste
  // exprimé en €/pièce sans passer par un faux calcul kg/L.
  pièce: { base: "pièce", factor: 1 },
};

// Calculateur guidé pour les lignes "prix par pièce/sachet/colis" sans poids ni volume indiqué
// (ex: "3 PCE x 28.90€" sans préciser si le sachet fait 800g ou 1kg) — évite d'imposer un calcul
// mental à l'utilisateur : il indique juste la contenance d'une pièce, le prix au kg/L en découle
// automatiquement et remplace le prix à 0€ imposé par défaut tant que rien n'est calculable.
function PricingCalculator({ item, onUpdate, t }) {
  const content = item.calcContent ?? 1;
  const contentUnit = item.calcContentUnit || "kg";
  const sourcePrice = item.printedUnitPriceHT || 0;
  const { base, factor } = CALC_CONTENT_UNITS[contentUnit];
  const baseContent = content * factor;
  // Arrondi à 4 décimales : sans lui, une division comme 11.80/3 affiche un flottant JS à
  // rallonge (ex: 0.33749999999999997) — bug réel trouvé en test (2026-08), calcul juste,
  // arrondi manquant.
  const computedPrice = baseContent > 0 ? Math.round((sourcePrice / baseContent) * 10000) / 10000 : 0;

  const recompute = (patch) => {
    const next = { calcContent: content, calcContentUnit: contentUnit, printedUnitPriceHT: sourcePrice, ...patch };
    const { base: nextBase, factor: nextFactor } = CALC_CONTENT_UNITS[next.calcContentUnit];
    const nextBaseContent = next.calcContent * nextFactor;
    const nextPrice = nextBaseContent > 0 ? Math.round((next.printedUnitPriceHT / nextBaseContent) * 10000) / 10000 : 0;
    onUpdate({ ...next, unit: nextBase, unitPriceHT: nextPrice });
  };

  // Le prix affiché par le calculateur (même la valeur par défaut, avant toute modification de
  // l'utilisateur) doit toujours être celui utilisé pour l'import — sinon "Valider" garde le
  // 0.00€ initial tant que l'utilisateur n'a pas lui-même touché un champ du calculateur.
  useEffect(() => {
    if (item.unitPriceHT !== computedPrice || item.unit !== base) {
      onUpdate({ calcContent: content, calcContentUnit: contentUnit, unit: base, unitPriceHT: computedPrice });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedPrice, base]);

  return (
    <div className="rounded-lg p-2.5 text-[11px] space-y-2" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
      <div className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle size={12} className="shrink-0" /> {t("scanPricingUnknown")}
      </div>
      <div className="text-white/60">{t("scanPricingUnknownHint")}</div>

      <div className="flex items-center gap-1.5">
        <span className="text-white/50 shrink-0">{t("scanCalcSourcePrice")}</span>
        <NumField
          value={sourcePrice}
          onChange={(v) => recompute({ printedUnitPriceHT: v })}
          className="w-16 bg-black/20 rounded px-1.5 py-1 text-right outline-none font-mono text-white"
        />
        <span className="text-white/50">€</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-white/50 shrink-0">{t("scanCalcContentLabel")}</span>
        <NumField
          value={content}
          onChange={(v) => recompute({ calcContent: v })}
          className="w-16 bg-black/20 rounded px-1.5 py-1 text-right outline-none font-mono text-white"
        />
        <select
          value={contentUnit}
          onChange={(e) => recompute({ calcContentUnit: e.target.value })}
          className="bg-black/20 rounded px-1.5 py-1 outline-none text-white"
          style={{ colorScheme: "dark" }}
        >
          <option value="kg">kg</option>
          <option value="g">g</option>
          <option value="L">L</option>
          <option value="cl">cl</option>
          <option value="pièce">pc</option>
        </select>
      </div>

      <div className="text-white font-semibold text-sm">{t("scanCalcResult")(computedPrice.toFixed(2), base)}</div>
    </div>
  );
}

// Redimensionne un logo uploadé en petit PNG (garde la transparence, contrairement à
// compressImageFile qui exporte en JPEG pour les photos de facture) — stocké directement en
// base64 dans menuSettings.logo (kv_store), pas de bucket de fichiers dédié dans ce projet, plus
// simple à mettre en place pour une v1 et une image de logo reste petite une fois compressée.
async function compressLogoFile(file) {
  const maxDim = 240;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  let { width, height } = bitmap;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/png");
}

// Appelle api/translate-menu-description.js (authentifié) — partagé par MenuRecipeRow (description
// d'un plat) et DigitalMenuModal (nom d'une section personnalisée). Sans `targetLang`, traduit vers
// les 2 langues restantes d'un coup. Renvoie null en cas d'échec (réseau, IA indisponible...) —
// jamais d'exception qui remonterait jusqu'à casser l'UI pour une simple traduction manquée.
async function translateMenuText(text, sourceLang, targetLang) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/translate-menu-description", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ text, sourceLang, targetLang }),
    });
    const data = await res.json();
    if (!res.ok) return null;
    return data;
  } catch (e) {
    return null;
  }
}

// Une ligne "recette" du panneau carte digitale : catégorie de menu (parmi les sections définies
// par le restaurateur) + une SEULE description à écrire (dans la langue de l'app du
// restaurateur). Traduction 100% automatique (2026-08-18, v4) : dès que le restaurateur arrête de
// taper une seconde, les 2 autres langues se remplissent toutes seules en arrière-plan — deux
// versions précédentes (un bouton générique, puis un clic par drapeau) ont toutes les deux été
// jugées pas claires par l'utilisateur ("je n'arrive pas à traduire", "ça n'apporte rien en plus,
// juste ça traduit et c'est ce qu'on veut de base"). Même principe de debounce que
// `useDebouncedSave` (sauvegarde des données), mais local au composant : l'effet se relance à
// chaque frappe et l'ancien minuteur est annulé par le cleanup, donc un seul appel part réellement
// une fois la frappe arrêtée.
function MenuRecipeRow({ r, lang, t, categories, onUpdate }) {
  const [translating, setTranslating] = useState(false);
  const [translateErr, setTranslateErr] = useState(false);
  const description = r.menuDescription?.[lang] || "";

  useEffect(() => {
    if (!description.trim()) return;
    const timer = setTimeout(async () => {
      setTranslating(true);
      setTranslateErr(false);
      const data = await translateMenuText(description, lang);
      if (data) onUpdate({ menuDescription: { ...(r.menuDescription || {}), ...data } });
      else setTranslateErr(true);
      setTranslating(false);
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, lang]);

  // Traduction automatique du NOM du plat (2026-08-19) — jusqu'ici seule la description était
  // traduite, mais un client étranger a d'abord besoin de comprendre le nom du plat lui-même
  // ("Faux filet sauce poivre") pour se décider, pas seulement sa description. `r.name` reste la
  // seule vérité utilisée partout ailleurs dans l'app (onglet Recettes, impression...) — seule une
  // copie traduite (`menuNameI18n`) est calculée pour l'affichage public. `_src` mémorise le texte
  // à partir duquel la traduction a été faite, pour ne jamais retraduire inutilement à chaque
  // réouverture de cette fenêtre tant que le nom de la recette n'a pas changé depuis.
  useEffect(() => {
    if (!r.name?.trim() || r.menuNameI18n?._src === r.name) return;
    translateMenuText(r.name, lang).then((data) => {
      if (data) onUpdate({ menuNameI18n: { ...data, _src: r.name } });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.name, lang, r.menuNameI18n?._src]);

  return (
    <div className="rounded-lg p-2.5" style={{ background: "#1B1815" }}>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!r.menuIncluded}
          onChange={(e) => onUpdate({ menuIncluded: e.target.checked })}
          className="shrink-0"
        />
        <span className="flex-1 min-w-0 text-white text-xs truncate">{r.name}</span>
      </label>
      {r.menuIncluded && (
        <div className="mt-2 space-y-2 pl-6">
          <select
            value={r.menuCategory || ""}
            onChange={(e) => onUpdate({ menuCategory: e.target.value || null })}
            className="bg-black/20 text-white/80 text-[11px] rounded px-2 py-1 outline-none"
            style={{ colorScheme: "dark" }}
          >
            <option value="">{t("digitalMenuCategoryNone")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{categoryLabel(c, lang)}</option>
            ))}
          </select>
          <textarea
            value={description}
            onChange={(e) => onUpdate({ menuDescription: { ...(r.menuDescription || {}), [lang]: e.target.value } })}
            placeholder={t("digitalMenuDescriptionPlaceholder")}
            rows={2}
            className="w-full bg-black/20 text-white/80 text-[11px] rounded px-2 py-1.5 outline-none resize-none"
          />
          {translating && (
            <span className="flex items-center gap-1 text-[10px] text-white/40">
              <Loader2 size={10} className="animate-spin" /> {t("digitalMenuTranslating")}
            </span>
          )}
          {translateErr && <p className="text-[10px] text-[#EF4444]">{t("digitalMenuTranslateError")}</p>}
        </div>
      )}
    </div>
  );
}

// Ligne d'un article simple déjà créé : nom/section/prix éditables en place, coût d'achat replié
// par défaut (n'apparaît que si on clique "+ ajouter un coût") — la plupart des restaurateurs n'en
// ont pas besoin ici, l'intérêt de ces articles est la rapidité, pas le suivi de marge. Prix et
// coût utilisent `NumField` (déjà utilisé partout ailleurs pour les nombres décimaux) plutôt qu'un
// input brut — un input qui reconvertit `parseFloat` à chaque frappe empêche de taper "0,20" (dès
// que le "0" est suivi du point, `parseFloat("0.")` vaut 0 et l'affichage revient à "0", effaçant
// le point) : bug réel signalé par l'utilisateur. `NumField` garde un texte local pendant la frappe
// et ne resynchronise qu'au blur, donc n'a pas ce problème.
function SimpleItemRow({ item, categories, lang, t, onUpdate, onRemove, onConvert }) {
  const [showCost, setShowCost] = useState(item.cost != null);

  // Traduction automatique du nom (2026-08-19), même principe débouncé que la description d'une
  // recette (`MenuRecipeRow`) — le nom est ici tapé en direct (contrairement à celui d'une
  // recette, fixé ailleurs), donc un vrai debounce est nécessaire pour ne pas relancer un appel à
  // chaque lettre. `_src` évite de retraduire tant que le nom n'a pas changé depuis.
  useEffect(() => {
    if (!item.name?.trim() || item.menuNameI18n?._src === item.name) return;
    const timer = setTimeout(async () => {
      const data = await translateMenuText(item.name, lang);
      if (data) onUpdate({ menuNameI18n: { ...data, _src: item.name } });
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.name, lang, item.menuNameI18n?._src]);

  return (
    <div className="rounded-lg p-2" style={{ background: "#1B1815" }}>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={item.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 min-w-0 bg-transparent text-white text-[11px] outline-none"
        />
        <select
          value={item.menuCategory || ""}
          onChange={(e) => onUpdate({ menuCategory: e.target.value || null })}
          className="bg-black/20 text-white/60 text-[10px] rounded px-1 py-1 outline-none shrink-0"
          style={{ colorScheme: "dark" }}
        >
          <option value="">{t("digitalMenuCategoryNone")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{categoryLabel(c, lang)}</option>
          ))}
        </select>
        <NumField
          value={item.sellPrice}
          onChange={(v) => onUpdate({ sellPrice: v })}
          className="w-14 bg-black/20 text-white text-[11px] rounded px-1.5 py-1 outline-none text-right shrink-0"
        />
        <button onClick={onRemove} className="shrink-0 text-white/30 hover:text-[#EF4444]">
          <X size={12} />
        </button>
      </div>
      {showCost ? (
        <div className="flex items-center gap-1.5 mt-1.5 pl-0.5">
          <span className="text-[10px] text-white/30 shrink-0">{t("digitalMenuSimpleItemCostLabel")}</span>
          <NumField
            value={item.cost || 0}
            onChange={(v) => onUpdate({ cost: v })}
            className="w-14 bg-black/20 text-white/70 text-[10px] rounded px-1.5 py-1 outline-none text-right"
          />
        </div>
      ) : (
        <button onClick={() => setShowCost(true)} className="text-[10px] text-white/25 hover:text-white/50 mt-1">
          {t("digitalMenuSimpleItemAddCost")}
        </button>
      )}
      {/* [PONT, 2026-08-27] Le passage d'un simple nom sur la carte à un plat dont on connaît la
          marge. Sans lui, un chef qui compose sa carte en saisie rapide reste bloqué dans un coin
          du produit qui ne parle jamais de marge — alors que c'est précisément là qu'il a sous les
          yeux la liste de tous les plats dont il aimerait connaître la rentabilité. */}
      {onConvert && (
        <button
          onClick={onConvert}
          className="flex items-center gap-1 text-[10px] mt-1.5 font-semibold"
          style={{ color: BRAND_SOLID }}
        >
          <Percent size={10} /> {t("digitalMenuConvertToRecipe")}
        </button>
      )}
    </div>
  );
}

// Articles simples de la carte digitale (2026-08-19) : ajout ultra-rapide pour les produits
// revendus tels quels (Coca, Perrier, chips...) sans passer par la création d'une recette —
// demandé explicitement par l'utilisateur ("il peut y en avoir des centaines, ça va polluer la
// section recette"). Volontairement séparés de `recipes` (nouvelle clé de stockage `simpleItems`,
// `src/App.jsx`) : n'apparaissent jamais dans l'onglet Recettes, le classement TOP, les fiches
// imprimées ou allergènes — seulement sur la carte publique. Champ nom + prix suffisent pour
// ajouter ; la ligne se vide et le focus revient sur le nom pour enchaîner rapidement.
function SimpleItemsSection({ items, setItems, categories, lang, t, onConvert }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const nameRef = useRef(null);

  const addItem = () => {
    const n = name.trim();
    const p = parseFloat((price || "").replace(",", "."));
    if (!n || !Number.isFinite(p) || p <= 0) return;
    setItems([...items, { id: uid(), name: n, sellPrice: p, cost: null, menuCategory: null }]);
    setName("");
    setPrice("");
    nameRef.current?.focus();
  };

  const updateItem = (id, patch) => setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id) => setItems(items.filter((it) => it.id !== id));

  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40 mb-1">
        <Package size={11} />
        {t("digitalMenuSimpleItemsLabel")}
      </div>
      <p className="text-[10px] text-white/30 mb-2">{t("digitalMenuSimpleItemsHint")}</p>

      {items.length > 0 && (
        <div className="space-y-1.5 mb-2 max-h-48 overflow-y-auto pr-0.5">
          {items.map((it) => (
            <SimpleItemRow
              key={it.id}
              item={it}
              categories={categories}
              lang={lang}
              t={t}
              onUpdate={(patch) => updateItem(it.id, patch)}
              onRemove={() => removeItem(it.id)}
              onConvert={onConvert ? () => onConvert(it) : null}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
          placeholder={t("digitalMenuSimpleItemNamePlaceholder")}
          className="flex-1 min-w-0 bg-black/20 text-white text-[11px] rounded px-2 py-1.5 outline-none"
        />
        <input
          type="text"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
          placeholder="€"
          className="w-16 bg-black/20 text-white text-[11px] rounded px-2 py-1.5 outline-none text-right"
        />
        <button
          onClick={addItem}
          className="shrink-0 text-[10px] uppercase tracking-wide px-2.5 py-1.5 rounded border border-white/20 text-white/70 hover:border-white/40"
        >
          {t("digitalMenuCategoryAdd")}
        </button>
      </div>
    </div>
  );
}

// Carte digitale publique (2026-08) : génère à la volée un QR code vers /menu/<userId> (voir
// src/PublicMenu.jsx + api/public-menu.js) et laisse le restaurateur choisir, recette par
// recette, ce qui doit apparaître dessus. Rien n'est jamais publié par défaut : `menuIncluded`
// et `menuSettings.published` démarrent tous les deux à false/undefined — un restaurateur qui
// n'ouvre jamais cette fenêtre ne change rien à ce qui existait avant.
function DigitalMenuModal({ open, onClose, menuSettings, setMenuSettings, recipes, setRecipes, simpleItems, setSimpleItems, userId, lang, t, onConvertToRecipe }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logoErr, setLogoErr] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const logoInputRef = useRef(null);

  const publicUrl = userId ? `${window.location.origin}/menu/${userId}` : null;

  useEffect(() => {
    if (!open || !menuSettings.published || !publicUrl) { setQrDataUrl(null); return; }
    let cancelled = false;
    setQrBusy(true);
    // Import dynamique (comme pdfjs-dist/tesseract.js ailleurs dans ce fichier) : cette librairie
    // ne doit peser sur le chargement de l'app que pour les restaurateurs qui ouvrent cette fenêtre.
    import("qrcode")
      .then((mod) => (mod.default || mod).toDataURL(publicUrl, { width: 240, margin: 1, color: { dark: "#1B1815", light: "#ffffff" } }))
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); })
      .finally(() => { if (!cancelled) setQrBusy(false); });
    return () => { cancelled = true; };
  }, [open, menuSettings.published, publicUrl]);

  // Sections définies par le restaurateur (2026-08-18, v2) — pré-remplies avec les 4 catégories
  // par défaut (mêmes ids qu'avant ce changement, donc compatible avec des recettes déjà
  // catégorisées) tant qu'il n'a jamais rien personnalisé lui-même.
  const categories = menuSettings.customCategories?.length ? menuSettings.customCategories : defaultMenuCategories();

  // Rattrapage automatique des sections créées avant la traduction automatique des noms de
  // section (v4, 2026-08-18) — ou dans l'ancien format "chaîne simple" (v3) : celles-ci restent
  // affichées dans une seule langue quel que soit le client, bug réel signalé le 2026-08-19. Se
  // relance à chaque rendu tant que la fenêtre est ouverte mais ne fait un appel réseau QUE s'il
  // reste vraiment une section incomplète (repli sur `defaultMenuCategories()` inoffensif : déjà
  // toujours complet dans les 3 langues, jamais concerné par cet effet).
  useEffect(() => {
    if (!open) return;
    const strCat = categories.find((c) => typeof c.name === "string");
    if (strCat) {
      setMenuSettings((prev) => ({
        ...prev,
        customCategories: (prev.customCategories?.length ? prev.customCategories : defaultMenuCategories()).map((c) =>
          c.id === strCat.id ? { ...c, name: { [lang]: c.name } } : c
        ),
      }));
      return;
    }
    const incomplete = categories.find((c) => !c.name.fr || !c.name.es || !c.name.en);
    if (!incomplete) return;
    const sourceLang = ["fr", "es", "en"].find((l) => incomplete.name[l]);
    if (!sourceLang) return;
    translateMenuText(incomplete.name[sourceLang], sourceLang).then((data) => {
      if (!data) return;
      setMenuSettings((prev) => ({
        ...prev,
        customCategories: (prev.customCategories?.length ? prev.customCategories : defaultMenuCategories()).map((c) =>
          c.id === incomplete.id ? { ...c, name: { ...c.name, ...data } } : c
        ),
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, categories, lang]);

  if (!open) return null;

  const updateRecipe = (id, patch) => setRecipes((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard?.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoErr(false);
    try {
      const dataUrl = await compressLogoFile(file);
      setMenuSettings({ ...menuSettings, logo: dataUrl });
    } catch (err) {
      setLogoErr(true);
    }
  };

  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const newCat = { id: uid(), name: { [lang]: name } };
    setMenuSettings({ ...menuSettings, customCategories: [...categories, newCat] });
    setNewCategoryName("");
    // Traduction automatique du nom de section vers les 2 autres langues — mêmes principes que la
    // description d'un plat (voir MenuRecipeRow), demandé explicitement le 2026-08-18 pour qu'une
    // section personnalisée (ex: "Pizzas") s'affiche correctement quelle que soit la langue
    // choisie par le client sur la carte publique.
    const translated = await translateMenuText(name, lang);
    if (translated) {
      setMenuSettings((prev) => ({
        ...prev,
        customCategories: (prev.customCategories || []).map((c) =>
          c.id === newCat.id ? { ...c, name: { ...c.name, ...translated } } : c
        ),
      }));
    }
  };
  const removeCategory = (id) => {
    setMenuSettings({ ...menuSettings, customCategories: categories.filter((c) => c.id !== id) });
    // Les recettes qui utilisaient cette section repassent "sans section" plutôt que de garder un
    // id orphelin — cohérent avec le comportement déjà existant d'une recette jamais catégorisée.
    setRecipes((rs) => rs.map((r) => (r.menuCategory === id ? { ...r, menuCategory: null } : r)));
  };
  // Ordre d'affichage des sections sur la carte publique (2026-08-19) — jusqu'ici uniquement
  // l'ordre de création, ce qui n'a aucune raison de correspondre à un ordre logique de menu
  // (bug réel signalé : "les entrées sont après les plats"). Simples flèches haut/bas plutôt qu'un
  // vrai glisser-déposer : une carte compte rarement plus de 5-6 sections, pas besoin de plus.
  const moveCategory = (index, direction) => {
    const next = [...categories];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setMenuSettings({ ...menuSettings, customCategories: next });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={onClose}>
      <div
        className="rounded-2xl p-5 w-full max-w-md max-h-[85vh] flex flex-col font-body border border-white/10"
        style={{ background: "#26221C" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <QrCode size={16} style={{ color: BRAND_SOLID }} className="shrink-0" />
          <h3 className="font-display text-white uppercase tracking-wide text-sm">{t("digitalMenuTitle")}</h3>
        </div>
        <p className="text-white/50 text-xs mb-4 leading-relaxed">{t("digitalMenuHint")}</p>

        <div className="overflow-y-auto pr-0.5 space-y-4">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!menuSettings.published}
              onChange={(e) => setMenuSettings({ ...menuSettings, published: e.target.checked })}
              className="mt-0.5 shrink-0"
            />
            <span>
              <span className="text-xs text-white/80 block font-semibold">{t("digitalMenuPublishLabel")}</span>
              <span className="text-[10px] text-white/40 block mt-0.5">{t("digitalMenuPublishHint")}</span>
            </span>
          </label>

          {menuSettings.published && (
            <>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-white/40 block mb-1">{t("digitalMenuRestaurantNameLabel")}</label>
                <input
                  type="text"
                  value={menuSettings.restaurantName}
                  onChange={(e) => setMenuSettings({ ...menuSettings, restaurantName: e.target.value })}
                  placeholder={t("digitalMenuRestaurantNamePlaceholder")}
                  className="w-full bg-black/20 text-white text-sm rounded px-2.5 py-2 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wide text-white/40 block mb-1">{t("digitalMenuLogoLabel")}</label>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden" style={{ background: "#1B1815" }}>
                    {menuSettings.logo ? <img src={menuSettings.logo} alt="" className="w-full h-full object-contain" /> : <Logo size={18} />}
                  </div>
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="text-[10px] uppercase tracking-wide px-2.5 py-1.5 rounded border border-white/20 text-white/70 hover:border-white/40"
                  >
                    {t("digitalMenuLogoUpload")}
                  </button>
                  {menuSettings.logo && (
                    <button
                      onClick={() => setMenuSettings({ ...menuSettings, logo: null })}
                      className="text-[10px] uppercase tracking-wide text-white/40 hover:text-[#EF4444]"
                    >
                      {t("digitalMenuLogoRemove")}
                    </button>
                  )}
                </div>
                {logoErr && <p className="text-[10px] text-[#EF4444] mt-1">{t("digitalMenuLogoError")}</p>}
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wide text-white/40 block mb-1">{t("digitalMenuDesignLabel")}</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {MENU_DESIGNS.map(({ id: d, bg }) => (
                    <button
                      key={d}
                      onClick={() => setMenuSettings({ ...menuSettings, design: d })}
                      className="flex items-center gap-2 text-xs py-2 px-2.5 rounded-lg border transition-colors"
                      style={
                        menuSettings.design === d
                          ? { borderColor: BRAND_SOLID, background: `${BRAND_SOLID}18`, color: "#fff" }
                          : { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }
                      }
                    >
                      <span className="w-4 h-4 rounded-full shrink-0 border border-white/20" style={{ background: bg }} />
                      {t(DESIGN_LABEL_KEYS[d])}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {MENU_ACCENT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setMenuSettings({ ...menuSettings, accentColor: c })}
                      className="w-6 h-6 rounded-full shrink-0"
                      style={{
                        background: c,
                        outline: (menuSettings.accentColor || MENU_ACCENT_COLORS[0]) === c ? "2px solid #fff" : "none",
                        outlineOffset: "2px",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-lg p-3 flex flex-col items-center gap-2" style={{ background: "#1B1815" }}>
                {qrBusy ? (
                  <div className="w-[140px] h-[140px] flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-white/40" />
                  </div>
                ) : qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR code" width={140} height={140} className="rounded" />
                ) : null}
                <div className="flex items-center gap-1.5 w-full">
                  <input readOnly value={publicUrl || ""} className="flex-1 min-w-0 bg-black/30 text-white/70 text-[11px] rounded px-2 py-1.5 outline-none truncate" />
                  <button onClick={copyLink} className="shrink-0 text-[10px] uppercase tracking-wide px-2 py-1.5 rounded border border-white/20 text-white/70 hover:border-white/40">
                    {copied ? t("digitalMenuLinkCopied") : t("digitalMenuCopyLink")}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {publicUrl && (
                    // Navigation normale dans le MÊME onglet (2026-08-19, 2e essai) — une iframe
                    // avait été tentée d'abord mais se comportait mal en pratique (signalé par
                    // l'utilisateur : renvoyait à l'écran Recettes de l'app, reproductible aussi
                    // bien sur ordinateur que sur téléphone). `?preview=1` fait apparaître un lien
                    // "Retour à Chefup" explicite sur la carte publique (`src/PublicMenu.jsx`) —
                    // fonctionne partout, y compris sans bouton retour visible (app ajoutée à
                    // l'écran d'accueil), puisque c'est un vrai lien cliquable, pas une dépendance
                    // au bouton retour du navigateur.
                    <a
                      href={`${publicUrl}?preview=1`}
                      className="text-[10px] uppercase tracking-wide text-white/50 hover:text-white underline"
                    >
                      {t("digitalMenuPreview")}
                    </a>
                  )}
                  {qrDataUrl && (
                    <a
                      href={qrDataUrl}
                      download="carte-chefup-qr.png"
                      className="text-[10px] uppercase tracking-wide text-white/50 hover:text-white underline"
                    >
                      {t("digitalMenuDownloadQr")}
                    </a>
                  )}
                </div>
              </div>
            </>
          )}

          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40 mb-2">
              <Tags size={11} />
              {t("digitalMenuCategoriesLabel")}
            </div>
            <div className="space-y-1 mb-2">
              {categories.map((c, i) => (
                <div key={c.id} className="flex items-center gap-1.5 text-[11px] text-white/70 bg-black/20 rounded-lg pl-1 pr-2.5 py-1">
                  <div className="flex flex-col shrink-0">
                    <button
                      onClick={() => moveCategory(i, -1)}
                      disabled={i === 0}
                      className="text-white/30 hover:text-white disabled:opacity-20 disabled:hover:text-white/30 leading-none"
                    >
                      <ChevronUp size={11} />
                    </button>
                    <button
                      onClick={() => moveCategory(i, 1)}
                      disabled={i === categories.length - 1}
                      className="text-white/30 hover:text-white disabled:opacity-20 disabled:hover:text-white/30 leading-none"
                    >
                      <ChevronDown size={11} />
                    </button>
                  </div>
                  <span className="flex-1 min-w-0 truncate">{categoryLabel(c, lang)}</span>
                  <button onClick={() => removeCategory(c.id)} className="text-white/30 hover:text-[#EF4444] shrink-0">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
                placeholder={t("digitalMenuCategoryAddPlaceholder")}
                className="flex-1 min-w-0 bg-black/20 text-white text-[11px] rounded px-2 py-1.5 outline-none"
              />
              <button
                onClick={addCategory}
                disabled={!newCategoryName.trim()}
                className="shrink-0 text-[10px] uppercase tracking-wide px-2.5 py-1.5 rounded border border-white/20 text-white/70 hover:border-white/40 disabled:opacity-40"
              >
                {t("digitalMenuCategoryAdd")}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40 mb-2">
              <Globe size={11} />
              {t("digitalMenuRecipesLabel")}
            </div>
            {recipes.length === 0 ? (
              <p className="text-white/30 text-xs">{t("digitalMenuNoRecipes")}</p>
            ) : (
              <div className="space-y-2">
                {recipes.map((r) => (
                  <MenuRecipeRow key={r.id} r={r} lang={lang} t={t} categories={categories} onUpdate={(patch) => updateRecipe(r.id, patch)} />
                ))}
              </div>
            )}
          </div>

          <SimpleItemsSection items={simpleItems} setItems={setSimpleItems} categories={categories} lang={lang} t={t} onConvert={onConvertToRecipe} />
        </div>

        <button onClick={onClose} className="w-full mt-4 text-xs font-display uppercase tracking-wide py-2 rounded border border-white/20 text-white/70 hover:border-[#8B5CF6] hover:text-[#8B5CF6] shrink-0">
          {t("close")}
        </button>
      </div>
    </div>
  );
}

// Carte d'un article scanné : correspondance affichée en grand (plutôt qu'un petit menu discret),
// bascule de renommage en vrai bouton, et une phrase en clair juste avant d'importer.
function ScanItemCard({ item, onUpdate, onImport, onSkip, ingredients, ingredientDisplayName, lang, t, skipMuted, startExpanded }) {
  const [expanded, setExpanded] = useState(!!startExpanded);
  const [editingPrice, setEditingPrice] = useState(false);
  const matchedIng = item.assignTo !== "new" ? ingredients.find((i) => i.id === item.assignTo) : null;
  const guessedIng = item.guessedMatchId ? ingredients.find((i) => i.id === item.guessedMatchId) : null;
  const needsRename = item.assignTo !== "new" && item.name && matchedIng && ingredientDisplayName(matchedIng) !== item.name;
  const matchColor = item.assignTo === "new" ? "#3B82F6" : item.matchConfident ? "#10B981" : TIER_COLORS.mid;

  const targetName = item.assignTo === "new" ? item.name : needsRename && item.renameOnImport ? item.name : matchedIng ? ingredientDisplayName(matchedIng) : "";
  const summary =
    item.assignTo === "new"
      ? t("scanSummaryNew")(targetName || "?", (item.unitPriceHT || 0).toFixed(2), item.unit)
      : t("scanSummaryUpdate")(targetName || "?", (item.unitPriceHT || 0).toFixed(2), item.unit);
  // Doute sur le PRIX (incohérent/illisible/IA peu sûre) : ne se résout jamais tout seul, reste
  // affiché jusqu'à l'import quel que soit le chemin emprunté (pile ou liste directe).
  const hasPriceDoubt = item.pricingUnknown || item.priceInconsistent || item.lowConfidence || item.unitChangeAffectsRecipes;
  // Doute sur le NOM (rapprochement pas confiant) : une fois que l'utilisateur a explicitement
  // tranché et validé dans la pile (item.reviewed), ce doute est résolu — le réafficher au moment
  // du clic final n'a plus de sens, ça ferait revivre une décision déjà prise (repéré en test réel,
  // 2026-08 : "Café grain arabica" gardait son bouton orange après validation explicite du nom).
  const hasUnresolvedNameDoubt = !item.matchConfident && item.assignTo !== "new" && !item.reviewed;
  // Un vrai souci d'identité/prix justifie un bouton d'alerte — une simple grosse variation de
  // prix (bigChange) non : le chef veut pouvoir valider normalement et juste voir la flèche/
  // pourcentage d'info affichée plus bas, pas se faire arrêter par un symbole danger pour un prix
  // qui monte.
  const hasIdentityIssue = hasPriceDoubt || hasUnresolvedNameDoubt;
  // Calculé dès qu'il y a un prix connu à comparer, même si la variation est nulle — avant ce
  // correctif, seules les lignes avec une VRAIE variation (>1%) affichaient quoi que ce soit,
  // ce qui donnait l'impression fausse que les autres lignes n'avaient pas été comparées du
  // tout. Signal demandé explicite de l'utilisateur (2026-08) : un badge doit être présent sur
  // CHAQUE ligne ayant un prix de référence, même pour dire "0%".
  // priceComparisonValid (2026-08-25) : jamais de pourcentage affiché quand l'unité a changé par
  // rapport à l'ingrédient existant (kg vs pièce, etc.) — la comparaison n'aurait aucun sens et
  // afficherait un pourcentage/sens trompeur (bug confirmé : "en hausse" affiché pour un prix en
  // réalité en baisse, juste comparé dans deux unités différentes).
  const priceChangePct =
    item.currentPrice !== null && item.currentPrice && item.priceComparisonValid !== false
      ? Math.round((Math.abs((item.unitPriceHT || 0) - item.currentPrice) / item.currentPrice) * 100)
      : null;

  return (
    <div
      className={`rounded-xl border ${item.imported ? "opacity-40" : ""}`}
      style={{ background: "#1B1815", borderColor: hasIdentityIssue ? `${TIER_COLORS.mid}80` : "rgba(255,255,255,0.1)" }}
    >
      {/* Ligne compacte : toujours visible, sans clic — le nom qui sera vraiment utilisé saute aux yeux */}
      <div className="px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <input
            value={item.name || ""}
            disabled={item.imported}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="flex-1 min-w-0 bg-transparent text-white text-sm font-medium outline-none"
          />
          <NumField
            value={item.quantity || 0}
            onChange={(v) => onUpdate({ quantity: v })}
            className="w-10 shrink-0 bg-transparent text-white/50 text-[11px] text-right outline-none"
          />
          <span className="text-white/40 text-[11px] shrink-0">{unitDisplayLabel(item.unit, t)}</span>
        </div>

        <div className="flex items-center gap-1.5 mt-1 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: matchColor }} />
          <span className="text-xs font-semibold truncate" style={{ color: matchColor }}>
            {targetName || "—"}
          </span>
          {needsRename && (
            <span className="text-[10px] text-white/35 truncate">({t("scanProposedLabel")} : {item.name})</span>
          )}
          {hasPriceDoubt && !item.imported && <AlertTriangle size={12} className="shrink-0 ml-auto" style={{ color: TIER_COLORS.mid }} />}
        </div>

        {/* Texte tel que lu sur la facture (débarrassé seulement du code fournisseur) : visible
            sans avoir à ouvrir "Modifier", pour vérifier d'un coup d'œil ce qui était vraiment
            imprimé. Modifiable ici pour corriger une erreur de lecture — n'affecte jamais le nom
            d'ingrédient ni le matching, uniquement la mémoire des rapprochements de ce texte. */}
        <div className="flex items-center gap-1 mt-1 min-w-0">
          <span className="text-[9px] uppercase tracking-wide text-white/25 shrink-0">{t("scanRawLabelPrefix")}</span>
          <input
            value={lightRawLabel(item.rawLabel)}
            disabled={item.imported}
            onChange={(e) => onUpdate({ rawLabel: e.target.value })}
            className="flex-1 min-w-0 bg-transparent text-white/45 text-[10px] outline-none focus:text-white/80"
          />
        </div>

        <div className="flex items-center gap-1.5 mt-1.5">
          {editingPrice ? (
            <NumField
              value={item.unitPriceHT || 0}
              onChange={(v) => onUpdate({ unitPriceHT: v })}
              className="w-16 bg-black/20 rounded px-1.5 py-1 text-right text-white text-sm font-mono outline-none"
            />
          ) : (
            <span className="text-white text-sm font-semibold">{(item.unitPriceHT || 0).toFixed(2)}€</span>
          )}
          <span className="text-white/40 text-[11px]">/{unitDisplayLabel(item.unit, t)}</span>
          {/* Variation de prix visible tout de suite, sans avoir à ouvrir "Modifier" — demande
              réelle de l'utilisateur (2026-08) : compact ici (icône + %), le détail avant/après
              reste disponible au survol et dans le panneau développé. Seule une vraie hausse
              change la couleur (orange, ou rouge si bigChange) — tout le reste (baisse ou prix
              stable) reste vert avec la flèche vers le bas, y compris à 0% : demande explicite de
              l'utilisateur, "pas augmenté" doit toujours rassurer visuellement de la même façon. */}
          {item.currentPrice !== null && item.currentPriceIsReal && priceChangePct !== null && (
            <span
              className="flex items-center gap-0.5 text-[10px] font-bold shrink-0"
              style={{ color: priceChangeVisual(item).color }}
              title={`${item.currentPrice.toFixed(2)}€ → ${(item.unitPriceHT || 0).toFixed(2)}€`}
            >
              {priceChangeVisual(item).up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {priceChangePct}%
            </span>
          )}
          {!item.imported && (
            <button onClick={() => setEditingPrice((v) => !v)} className="text-white/30 hover:text-white shrink-0">
              <Pencil size={12} />
            </button>
          )}

          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-0.5 text-[10px] text-white/35 hover:text-white ml-1"
          >
            {t("scanModify")} <ChevronDown size={12} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>

          <div className="flex-1" />

          {item.imported ? (
            <span className="text-[10px] text-[#10B981] font-semibold">{t("scanImported")}</span>
          ) : (
            <>
              {onSkip && (
                <button
                  onClick={onSkip}
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border transition-colors"
                  style={skipMuted ? { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.35)" } : { borderColor: "rgba(239,68,68,0.4)", color: "#EF4444" }}
                  onMouseEnter={skipMuted ? (e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; e.currentTarget.style.color = "#EF4444"; } : undefined}
                  onMouseLeave={skipMuted ? (e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "rgba(255,255,255,0.35)"; } : undefined}
                  title={t("scanSkip")}
                >
                  <X size={14} />
                </button>
              )}
              <button
                onClick={onImport}
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: hasIdentityIssue ? TIER_COLORS.mid : "#10B981" }}
                title={hasIdentityIssue ? t("scanConfirmUncertain") : t("scanImport")}
              >
                {hasIdentityIssue ? <AlertTriangle size={14} color="#fff" /> : <Check size={14} color="#fff" />}
              </button>
            </>
          )}
        </div>

        {/* Message visible en permanence (pas seulement au survol de la souris, invisible sur
            mobile) : un doute sur le prix doit rester impossible à manquer jusqu'à l'import,
            contrairement au doute sur le nom qui, lui, se résout une fois validé (voir
            hasUnresolvedNameDoubt plus haut). */}
        {hasPriceDoubt && !item.imported && (
          <div className="flex items-center gap-1 mt-1.5 text-[10px] font-semibold" style={{ color: TIER_COLORS.mid }}>
            <AlertTriangle size={11} className="shrink-0" /> {t("scanPriceDoubtLabel")}
          </div>
        )}
        {/* Un écart de prix de plus de 40% (dans un sens comme dans l'autre) garde la ligne hors de
            "Importer ces lignes" — sans cette note, une grosse BAISSE affichée en vert donnait
            l'impression d'une ligne parfaitement normale mise de côté sans raison visible. Le ton
            reste neutre : ce n'est pas une erreur détectée, juste un écart assez gros pour mériter
            un coup d'œil (un prix sous-estimé gonfle la marge à tort, exactement comme un prix
            surestimé la sous-estime). */}
        {item.bigChange && !hasPriceDoubt && !item.imported && (
          <div className="flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-white/50">
            <Info size={11} className="shrink-0" /> {t("scanBigChangeNote")}
          </div>
        )}
      </div>

      {expanded && !item.imported && (
        <div className="px-2.5 pb-2.5 pt-1 border-t border-white/5 space-y-2">
          {(item.packageCount || item.packageContent) && !item.pricingUnknown && (
            <div className="text-[10px] text-white/35 font-mono">
              {item.packageCount || 1} × {item.packageContent || 1}
              {item.packageContentUnit === "pièce" ? "" : item.packageContentUnit} @ {(item.printedUnitPriceHT || 0).toFixed(2)}€/
              {item.printedPriceUnit === "colis" ? t("scanColisUnit") : item.printedPriceUnit}
            </div>
          )}

          {item.pricingUnknown && <PricingCalculator item={item} onUpdate={onUpdate} t={t} />}

          {item.priceInconsistent && (
            <div className="flex items-center gap-1.5 text-[10px] rounded px-2 py-1" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
              <AlertTriangle size={11} className="shrink-0" />
              <span>
                {t("scanPriceInconsistent")}
                {item.expectedTotal !== null ? ` (${t("scanExpectedTotal")} ≈ ${item.expectedTotal.toFixed(2)}€, ${t("scanPrintedTotal")} ${(item.totalPriceHT || 0).toFixed(2)}€)` : ""}
              </span>
            </div>
          )}

          {item.lowConfidence && (
            <div className="flex items-center gap-1.5 text-[10px] rounded px-2 py-1" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
              <AlertTriangle size={11} className="shrink-0" />
              <span>{t("scanLowConfidence")}</span>
            </div>
          )}

          {item.unitChangeAffectsRecipes && (
            <div className="flex items-center gap-1.5 text-[10px] rounded px-2 py-1" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
              <AlertTriangle size={11} className="shrink-0" />
              <span>{t("scanUnitChangeWarning")(item.previousUnit, item.unit)}</span>
            </div>
          )}

          {guessedIng && (
            <ScanNameChoice item={item} guessedIng={guessedIng} ingredientDisplayName={ingredientDisplayName} onUpdate={onUpdate} t={t} />
          )}

          <div className={guessedIng ? "border-t border-white/5 pt-2" : ""}>
            <div className="text-[9px] uppercase tracking-wide text-white/35 mb-1">{t("scanRelinkLabel")}</div>
            <div className="flex items-center gap-1.5">
              <select
                value={item.unit || "kg"}
                onChange={(e) => onUpdate({ unit: e.target.value })}
                className="bg-black/20 text-white/70 text-xs outline-none rounded px-1.5 py-1.5 shrink-0"
                style={{ colorScheme: "dark" }}
              >
                <option value="kg">kg</option>
                <option value="L">L</option>
                <option value="pièce">{t("unitPieceLabel")}</option>
              </select>
              <IngredientPicker
                ingredients={ingredients}
                value={item.assignTo !== "new" ? item.assignTo : null}
                displayName={ingredientDisplayName}
                onChange={(id) => onUpdate({ assignTo: id, guessedMatchId: id, matchConfident: true, renameOnImport: false })}
                placeholder={t("scanSearchIngredientPlaceholder")}
                className="flex-1 min-w-0 bg-black/30 text-white text-xs rounded-lg px-2.5 py-2"
                searchPlaceholder={t("pickerSearchPlaceholder")}
                typeToSearchText={t("pickerTypeToSearch")}
                noResultsText={t("pickerNoResults")}
              />
              <button
                type="button"
                onClick={() => onUpdate({ assignTo: "new", renameOnImport: false })}
                className="shrink-0 text-[9px] uppercase tracking-wide px-2 py-2 rounded-lg font-semibold whitespace-nowrap"
                style={{ background: "#3B82F622", color: "#3B82F6" }}
              >
                {t("scanNewIngredient")}
              </button>
            </div>
          </div>

          {item.currentPrice !== null && item.currentPriceIsReal && priceChangePct !== null && (
            <div
              className="flex items-center gap-1 text-[10px]"
              style={{ color: priceChangeVisual(item).color }}
            >
              {priceChangeVisual(item).up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {item.priceUp
                ? `${t("scanPriceIncrease")} (+${priceChangePct}%) : ${item.currentPrice.toFixed(2)}€ → ${(item.unitPriceHT || 0).toFixed(2)}€`
                : item.priceDown
                ? `${t("scanPriceDecrease")} (-${priceChangePct}%) : ${item.currentPrice.toFixed(2)}€ → ${(item.unitPriceHT || 0).toFixed(2)}€`
                : t("scanPriceSame")}
            </div>
          )}

          <div className="text-[11px] text-white/45 italic border-t border-white/5 pt-1.5">{summary}</div>
        </div>
      )}
    </div>
  );
}
export function marginTier(m, minMargin) {
  if (m === null || m === undefined) return null;
  const rounded = Math.round(m);
  if (rounded < CRITICAL_MARGIN) return "low";
  const target = Math.max(minMargin ?? 75, CRITICAL_MARGIN);
  if (rounded < target) return "mid";
  return "high";
}

// Message qualitatif personnalisé, toujours cohérent avec la couleur affichée :
// il compare la marge réelle à la marge minimale souhaitée (réglage global), pas à autre chose.
function marginMessage(roundedMargin, effectiveTarget, tier, lang) {
  if (roundedMargin === null) return null;
  const tr = (key) => (TR[lang] && TR[lang][key]) || TR.fr[key];
  const gapAbove = roundedMargin - effectiveTarget; // positif si au-dessus de l'objectif
  const gapBelow = effectiveTarget - roundedMargin; // positif si en dessous
  if (tier === "high") {
    return gapAbove >= 10 ? tr("marginExcellentMsg") : tr("marginGoodMsg");
  }
  if (tier === "mid") {
    return gapBelow <= 3 ? tr("marginCloseMsg") : tr("marginWatchMsg");
  }
  // tier "low"
  return roundedMargin < 50 ? tr("marginLowMsg") : tr("marginLowFixMsg");
}

// Petite barre journalière en SVG plutôt qu'une vraie librairie de graphiques (2026-08-19) —
// "sobre et fonctionnel" demandé explicitement par l'utilisateur, et évite une dépendance de plus
// pour un simple graphique à barres. `series` = [{date, value}], la barre la plus haute définit
// l'échelle ; une valeur à 0 reste visible (trait fin) pour ne jamais donner l'impression d'un jour
// manquant dans les données.
// Petit schéma "étape 1 → étape 2" pour la fenêtre d'instructions d'installation (2026-08-23) —
// demandé par l'utilisateur, du texte seul étant jugé pas assez clair. Une icône représentant le
// bouton réel du navigateur (partage iOS / menu ⋮ Android), un point qui pulse pour attirer l'œil
// dessus, une flèche, et l'icône d'arrivée (écran d'accueil). Volontairement schématique plutôt
// qu'une vraie capture d'écran (qui se périmerait au moindre changement d'interface du navigateur).
function InstallDiagram({ sourceIcon: SourceIcon, sourceLabel, targetLabel }) {
  return (
    <div className="flex items-center justify-center gap-3 my-4 py-4 rounded-xl" style={{ background: "#1B1815" }}>
      <div className="flex flex-col items-center gap-1.5">
        <div className="relative">
          <div className="w-11 h-11 rounded-xl border border-white/20 flex items-center justify-center">
            <SourceIcon size={18} className="text-white/70" />
          </div>
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping" style={{ background: BRAND_SOLID }} />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full" style={{ background: BRAND_SOLID }} />
        </div>
        <span className="text-white/40 text-[10px]">{sourceLabel}</span>
      </div>
      <ArrowRight size={18} className="text-white/25 shrink-0" />
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: BRAND_GRADIENT }}>
          <Smartphone size={18} className="text-white" />
        </div>
        <span className="text-white/40 text-[10px]">{targetLabel}</span>
      </div>
    </div>
  );
}

function DailyBarChart({ series, color, height = 90 }) {
  const max = Math.max(1, ...series.map((d) => d.value));
  const barWidth = 100 / series.length;
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {series.map((d, i) => {
        const h = Math.max(1, (d.value / max) * (height - 4));
        return (
          <rect
            key={d.date}
            x={i * barWidth + barWidth * 0.15}
            y={height - h}
            width={barWidth * 0.7}
            height={h}
            fill={color}
            opacity={d.value === 0 ? 0.25 : 0.9}
          >
            <title>{`${d.date} : ${d.value}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

// Tableau de bord admin (2026-08-19), demandé par l'utilisateur pour suivre visites/clics/essais/
// abonnements/emails sans passer par des requêtes manuelles à chaque fois. Ouvert en plein écran
// depuis un bouton "Admin" dans la fenêtre "Mon compte" (voir `accountMenuOpen`), visible
// UNIQUEMENT depuis son propre compte (`isAdmin`) — jamais pour un autre utilisateur Chefup,
// revérifié aussi côté serveur (`api/admin-dashboard.js`, l'email pourrait en théorie être
// falsifié côté client).
//
// Refonte (2026-08-23) : la toute première version (KPI + flux global + tableau "Comptes" à
// fusionner soi-même en cliquant) a été jugée "pas pratique du tout" par l'utilisateur après ses
// 2 premiers essais gratuits réels. Nouvelle logique : 2 onglets — "Comptes" (par défaut, l'usage
// principal : suivre CE que fait une personne précise) présente une liste de cartes-comptes triée
// par activité la plus récente, avec un point vert "en ligne" quand < 5 min, un badge de statut
// coloré, et un clic déplie directement la chronologie de CE compte (icônes + temps relatif type
// "il y a 3 min" plutôt que des dates absolues à décoder) — plus besoin de cliquer puis remonter
// chercher un tableau séparé. "Aperçu" garde les KPI marketing (visites/clics/graphique), moins
// urgents pour du suivi en direct, écartés du premier écran pour ne pas noyer l'essentiel.
const ACTIVITY_LABELS = {
  login: "Connexion",
  recipe_created: "Recette créée",
  scan_invoice: "Scan facture",
  scan_recipe: "Scan fiche recette",
  scan_failed: "Scan ÉCHOUÉ",
};
const ACTIVITY_ICON = {
  login: { Icon: LogIn, color: "#9CA3AF" },
  recipe_created: { Icon: ChefHat, color: BRAND_SOLID },
  scan_invoice: { Icon: Receipt, color: "#38BDF8" },
  scan_recipe: { Icon: ClipboardList, color: "#F59E0B" },
  scan_failed: { Icon: AlertTriangle, color: TIER_COLORS.low },
};
// Codes d'échec de scan connus. Toute valeur hors de cette liste retombe sur "unknown" côté
// affichage, pour ne jamais montrer une clé de traduction brute au restaurateur.
const SCAN_ERR_CODES = ["offline", "ai_timeout", "ai_busy", "ai_unavailable", "ai_unreadable", "file_unreadable", "file_password_protected", "file_pdf_ios_issue", "file_too_big", "bad_request", "auth_expired", "auth_required"];
// Les mêmes codes traduits en clair pour le tableau de bord admin (usage interne, français).
const MODE_LABELS = { pdf: "PDF (natif)", pdf_text: "PDF texte", image: "photo" };
const SCAN_FAIL_REASONS = {
  offline: "connexion perdue côté client",
  ai_timeout: "délai dépassé (document trop long / réseau lent)",
  ai_busy: "service d'IA saturé",
  ai_unavailable: "service d'IA indisponible (à vérifier côté Vercel)",
  ai_unreadable: "réponse de l'IA illisible",
  file_unreadable: "fichier illisible par le navigateur",
  file_password_protected: "PDF protégé par un mot de passe",
  file_pdf_ios_issue: "bug connu iOS/WebKit avec les PDF (probable, pas certain)",
  file_too_big: "document trop volumineux",
  bad_request: "requête sans document",
  auth_expired: "session expirée (même après renouvellement automatique)",
  auth_required: "appel sans compte connecté",
  unknown: "cause inconnue",
};
function activityDetail(e) {
  const m = e.meta || {};
  if (e.type === "recipe_created") return m.name ? `« ${m.name} »` : "";
  if (e.type === "scan_failed") {
    const bits = [SCAN_FAIL_REASONS[m.code] || m.code || "cause inconnue"];
    if (m.httpStatus) bits.push(`HTTP ${m.httpStatus}`);
    // upstreamStatus (2026-08-25) : le vrai code renvoyé par Anthropic, distinct du code HTTP
    // normalisé ci-dessus — un 400 ici veut dire "notre requête est mal formée" (bug de code),
    // un 5xx veut dire "leur service est indisponible" (rien à faire de notre côté).
    if (m.upstreamStatus) bits.push(`Anthropic ${m.upstreamStatus}`);
    if (m.online === false) bits.push("appareil hors ligne");
    if (m.device) bits.push(m.device);
    // MODE_LABELS couvre "pdf" (nouveau, envoi natif) en plus des anciens "pdf_text"/"image" —
    // avant ce correctif, tout mode inconnu (dont "pdf") retombait à tort sur "photo" (bug trouvé
    // en test réel, 2026-08-25 : un échec PDF affichait "photo" dans le tableau de bord).
    if (m.mode) bits.push(MODE_LABELS[m.mode] || m.mode);
    if (m.fileType) bits.push(m.fileType);
    // Message technique brut (2026-08-25) : jusqu'ici perdu pour file_unreadable/unknown, laissant
    // "PDF illisible" sans aucun indice exploitable. Jamais du contenu de facture — juste le texte
    // d'une exception JS (ex: nom de la classe d'erreur pdfjs, message réseau...).
    if (m.errorMessage) bits.push(`"${m.errorMessage}"`);
    return bits.join(" · ");
  }
  if (e.type === "scan_invoice" || e.type === "scan_recipe") {
    if (m.zeroItems) return "Aucune ligne détectée";
    const bits = [`${m.foodItems ?? 0} ligne(s) alimentaire(s)`];
    if (m.excludedItems) bits.push(`${m.excludedItems} écartée(s)`);
    if (m.lowConfidenceItems) bits.push(`${m.lowConfidenceItems} confiance basse`);
    if (m.priceInconsistentItems) bits.push(`${m.priceInconsistentItems} prix incohérent`);
    if (m.pricingUnknownItems) bits.push(`${m.pricingUnknownItems} prix inconnu`);
    if (!m.supplierKnown) bits.push("fournisseur non lu");
    return bits.join(" · ");
  }
  return "";
}
// Temps relatif FR ("à l'instant", "il y a 3 min"...) — bien plus lisible d'un coup d'œil qu'une
// date absolue pour répondre à la vraie question de l'utilisateur : "est-il en train d'utiliser
// l'app là maintenant ?".
function relativeTimeFr(iso) {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "hier";
  if (diffD < 7) return `il y a ${diffD} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function accountStatusColor(status) {
  if (status === "Abonné actif") return TIER_COLORS.high;
  if (status === "Paiement en retard") return TIER_COLORS.mid;
  if (status.startsWith("Essai (")) return BRAND_SOLID;
  return TIER_COLORS.low; // Annulé / Essai expiré
}

function AdminDashboard() {
  const [state, setState] = useState({ status: "loading", data: null });
  const [days, setDays] = useState(30);
  const [dashTab, setDashTab] = useState("comptes"); // "comptes" | "apercu"
  // Compte dont la chronologie est dépliée (2026-08-23) — un seul à la fois, comme un accordéon.
  const [expandedEmail, setExpandedEmail] = useState(null);
  // Réinitialisation d'essai (2026-08-25) : "armed" = premier clic (bouton passe en rouge pour
  // confirmer, se désarme tout seul après quelques secondes) plutôt qu'une vraie boîte de dialogue
  // — évite un clic accidentel sans construire un modal pour une action interne admin-only.
  const [resetTrialArmed, setResetTrialArmed] = useState(null); // email en attente de confirmation
  const [resetTrialBusy, setResetTrialBusy] = useState(null); // email en cours de traitement
  const [resetTrialDone, setResetTrialDone] = useState({}); // { email: true } une fois confirmé cette session
  // Mail de déblocage groupé (2026-08-25) : même pattern "armé puis confirmé" que resetTrial,
  // mais pour un seul envoi global (tous les comptes jamais confirmés d'un coup), pas par compte.
  const [unlockEmailArmed, setUnlockEmailArmed] = useState(false);
  const [unlockEmailBusy, setUnlockEmailBusy] = useState(false);
  const [unlockEmailResult, setUnlockEmailResult] = useState(null); // { sentCount, total }
  const sendUnlockEmails = async () => {
    if (!unlockEmailArmed) {
      setUnlockEmailArmed(true);
      setTimeout(() => setUnlockEmailArmed(false), 4000);
      return;
    }
    setUnlockEmailArmed(false);
    setUnlockEmailBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin-dashboard", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "send_unlock_emails" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "échec");
      setUnlockEmailResult({ sentCount: data.sentCount, total: data.total });
    } catch (e) {
      alert("Erreur : " + (e.message || "échec de l'envoi."));
    } finally {
      setUnlockEmailBusy(false);
    }
  };
  const resetTrial = async (email) => {
    if (resetTrialArmed !== email) {
      setResetTrialArmed(email);
      setTimeout(() => setResetTrialArmed((cur) => (cur === email ? null : cur)), 4000);
      return;
    }
    setResetTrialArmed(null);
    setResetTrialBusy(email);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin-dashboard", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "reset_trial", email }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "échec");
      setResetTrialDone((d) => ({ ...d, [email]: true }));
    } catch (e) {
      alert("Erreur : " + (e.message || "échec de la réinitialisation."));
    } finally {
      setResetTrialBusy(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async (background) => {
      if (!background) setState((s) => ({ status: "loading", data: s.data }));
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/admin-dashboard?days=${days}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "dashboard error");
        if (!cancelled) setState({ status: "ready", data });
      } catch (e) {
        // En arrière-plan (rafraîchissement auto), on garde l'affichage précédent plutôt que
        // de basculer sur un écran d'erreur pour un simple raté réseau ponctuel.
        if (!cancelled && !background) setState({ status: "error", data: null });
      }
    };
    load(false);
    // Rafraîchissement automatique pendant que le tableau de bord reste ouvert (2026-08-23) —
    // demandé pour pouvoir suivre en direct l'activité d'un compte (connexions, scans, recettes)
    // sans avoir à rouvrir la fenêtre. 25s : assez réactif pour "suivre en direct", assez espacé
    // pour ne pas spammer l'API.
    const interval = setInterval(() => load(true), 25000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [days]);

  if (state.status === "loading" && !state.data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-white/40" size={24} />
      </div>
    );
  }
  if (state.status === "error") {
    return <p className="text-white/50 text-sm text-center py-10">Impossible de charger le tableau de bord.</p>;
  }

  const { kpis, dailySeries, users, activityFeed = [], bySource = [] } = state.data;

  // Dernière activité connue par compte (pour trier + savoir qui est "en ligne" maintenant) —
  // repli sur la date d'inscription pour un compte sans aucun événement encore enregistré.
  const lastActivityByEmail = new Map();
  activityFeed.forEach((e) => {
    const prev = lastActivityByEmail.get(e.email);
    if (!prev || new Date(e.createdAt) > new Date(prev)) lastActivityByEmail.set(e.email, e.createdAt);
  });
  const accountsSorted = [...users].sort((a, b) => {
    const at = new Date(lastActivityByEmail.get(a.email) || a.createdAt).getTime();
    const bt = new Date(lastActivityByEmail.get(b.email) || b.createdAt).getTime();
    return bt - at;
  });

  const kpiCards = [
    { label: "Visites", value: kpis.views },
    { label: "Clics « essai »", value: kpis.startClicks },
    { label: "Scans", value: kpis.scans },
    { label: "Comptes total", value: kpis.totalUsers },
    { label: "Essais en cours", value: kpis.activeTrials },
    { label: "Abonnés actifs", value: kpis.activeSubs },
    { label: "Annulés", value: kpis.canceled },
    { label: "Essais expirés", value: kpis.expiredNoSub },
    { label: "Emails non confirmés", value: kpis.unconfirmedEmails },
  ];

  const TabButton = ({ id, label }) => (
    <button
      onClick={() => setDashTab(id)}
      className="px-4 py-2 rounded-full text-xs font-medium transition"
      style={
        dashTab === id
          ? { background: BRAND_SOLID, color: "white" }
          : { background: "transparent", color: "rgba(255,255,255,0.5)" }
      }
    >
      {label}
    </button>
  );

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="font-display text-white/90 uppercase text-sm tracking-widest">Tableau de bord</h2>
        <div className="flex items-center gap-1 rounded-full p-1" style={{ background: "#1B1815" }}>
          <TabButton id="comptes" label="Comptes" />
          <TabButton id="apercu" label="Aperçu" />
        </div>
      </div>

      {dashTab === "comptes" ? (
        <div>
          <div className="text-white/30 text-[11px] mb-3">Tape un compte pour voir tout ce qu'il fait, dans l'ordre.</div>
          <div className="space-y-2">
            {accountsSorted.map((u) => {
              const lastAt = lastActivityByEmail.get(u.email) || u.createdAt;
              const isLive = Date.now() - new Date(lastAt).getTime() < 5 * 60 * 1000;
              const isOpen = expandedEmail === u.email;
              const timeline = activityFeed.filter((e) => e.email === u.email);
              const stats = {
                recipes: timeline.filter((e) => e.type === "recipe_created").length,
                scans: timeline.filter((e) => e.type === "scan_invoice" || e.type === "scan_recipe").length,
              };
              const initial = (u.email[0] || "?").toUpperCase();
              return (
                <div key={u.email} className="rounded-xl border border-white/10 overflow-hidden" style={{ background: "#26221C" }}>
                  <button
                    onClick={() => setExpandedEmail(isOpen ? null : u.email)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    <div className="relative shrink-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-display text-sm"
                        style={{ background: accountStatusColor(u.status) }}
                      >
                        {initial}
                      </div>
                      {isLive && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                          style={{ background: "#10B981", borderColor: "#26221C" }}
                          title="En ligne (actif il y a moins de 5 min)"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-white/90 text-sm truncate">{u.email}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${accountStatusColor(u.status)}25`, color: accountStatusColor(u.status) }}
                        >
                          {u.status}
                        </span>
                        {/* Compte interne (2026-08-26) : nos propres comptes restent listés ici
                            (utile pour vérifier qu'un correctif marche), mais ne comptent plus dans
                            aucun chiffre de l'onglet Aperçu — voir INTERNAL_EMAILS côté serveur. */}
                        {u.internal && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white/50"
                            style={{ background: "rgba(255,255,255,0.08)" }}
                            title="Compte interne : exclu des chiffres de l'onglet Aperçu"
                          >
                            interne
                          </span>
                        )}
                        {/* Email jamais confirmé (2026-08-25) : signal le plus important après un
                            incident de mails partis en spam — ce compte est peut-être bloqué à la
                            porte d'entrée sans jamais avoir pu utiliser l'app une seule fois. */}
                        {!u.emailConfirmed && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                            style={{ background: `${TIER_COLORS.low}25`, color: TIER_COLORS.low }}
                            title="N'a jamais cliqué le lien de confirmation reçu par email — vérifie qu'il n'est pas resté bloqué dans ses spams"
                          >
                            <MailWarning size={10} /> Email non confirmé
                          </span>
                        )}
                        <span className="text-white/40 text-[11px]">
                          {isLive ? "en ligne" : `vu ${relativeTimeFr(lastAt)}`}
                        </span>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 text-white/40 text-[11px] shrink-0">
                      <span className="flex items-center gap-1"><ChefHat size={12} /> {stats.recipes}</span>
                      <span className="flex items-center gap-1"><Receipt size={12} /> {stats.scans}</span>
                    </div>
                    <ChevronDown
                      size={16}
                      className="text-white/30 shrink-0 transition-transform"
                      style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-white/10 px-3 pb-3 pt-2">
                      {/* Réinitialisation d'essai (2026-08-25) : pour un compte dont l'essai a été
                          gâché par un vrai bug de l'app (ex: casavostra.ajaccio@gmail.com, cas réel
                          qui a motivé ce bouton) — remet le compteur à 7 jours pleins à partir de
                          maintenant, sans jamais toucher created_at (non modifiable via l'API
                          Supabase). Premier clic = armé (rouge, "Confirmer ?"), deuxième clic dans
                          les 4s = exécute réellement. */}
                      <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-white/10">
                        <span className="text-white/40 text-[11px]">Essai gâché par un bug de l'app ?</span>
                        {resetTrialDone[u.email] ? (
                          <span className="text-[11px] font-medium" style={{ color: TIER_COLORS.high }}>✓ Essai réinitialisé (7 jours)</span>
                        ) : (
                          <button
                            onClick={(ev) => { ev.stopPropagation(); resetTrial(u.email); }}
                            disabled={resetTrialBusy === u.email}
                            className="text-[11px] font-medium px-2.5 py-1 rounded-full disabled:opacity-50"
                            style={
                              resetTrialArmed === u.email
                                ? { background: `${TIER_COLORS.low}25`, color: TIER_COLORS.low }
                                : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }
                            }
                          >
                            {resetTrialBusy === u.email
                              ? "…"
                              : resetTrialArmed === u.email
                              ? "Confirmer ? (remet à J-7)"
                              : "Réinitialiser l'essai"}
                          </button>
                        )}
                      </div>
                      {timeline.length === 0 ? (
                        <div className="text-white/30 text-xs py-3 text-center">
                          Aucune action enregistrée pour ce compte pour l'instant.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {timeline.map((e) => {
                            const cfg = ACTIVITY_ICON[e.type] || { Icon: Clock, color: "#9CA3AF" };
                            const Icon = cfg.Icon;
                            return (
                              <div key={e.id} className="flex items-start gap-2.5">
                                <div
                                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                  style={{ background: `${cfg.color}25` }}
                                >
                                  <Icon size={13} style={{ color: cfg.color }} />
                                </div>
                                <div className="min-w-0 flex-1 pb-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-white/80 text-xs font-medium">{ACTIVITY_LABELS[e.type] || e.type}</span>
                                    <span className="text-white/30 text-[10px]">{relativeTimeFr(e.createdAt)}</span>
                                  </div>
                                  {activityDetail(e) && <div className="text-white/40 text-[11px] mt-0.5">{activityDetail(e)}</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-end mb-3">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-black/20 text-white/70 text-xs rounded px-2 py-1.5 outline-none"
              style={{ colorScheme: "dark" }}
            >
              <option value={7}>7 jours</option>
              <option value={30}>30 jours</option>
              <option value={90}>90 jours</option>
            </select>
          </div>

          {/* Rappel honnête sur ce que ces chiffres excluent réellement (2026-08-26). Les scans,
              comptes, essais et abonnés sont rattachés à un compte : nos comptes internes en sont
              donc retirés proprement. Les visites et clics de la page d'accueil, eux, sont
              anonymes par conception (aucune donnée personnelle enregistrée) — impossible de savoir
              après coup qu'une visite venait de nous. Le seul moyen reste `?notrack=1`, désormais
              mémorisé durablement sur l'appareil dès la première utilisation (voir Landing.jsx). */}
          <div className="text-white/35 text-[11px] mb-3 leading-relaxed">
            Scans, comptes, essais et abonnés : nos comptes internes sont exclus.
            <br />
            Visites et clics : anonymes, donc non rattachables — ouvre le site avec{" "}
            <span className="text-white/55">?notrack=1</span> une fois par appareil pour ne plus jamais y figurer.
          </div>

          {/* Mail de déblocage groupé (2026-08-25) : pour les comptes déjà inscrits mais jamais
              confirmés, qui ne savent probablement pas qu'ils peuvent maintenant se connecter sans
              confirmer leur email — voir CLAUDE.md, "Visibilité de la confirmation d'email". Envoi
              volontairement manuel/ponctuel (pas automatique), à la demande de l'utilisateur. */}
          {(kpis.unconfirmedEmails > 0 || unlockEmailResult) && (
            <div
              className="rounded-xl p-3 mb-4 flex items-center justify-between gap-3 flex-wrap"
              style={{ background: "#26221C", border: `1px solid ${TIER_COLORS.low}40` }}
            >
              <div className="flex items-center gap-2 text-white/70 text-xs">
                <MailWarning size={14} style={{ color: TIER_COLORS.low }} />
                {unlockEmailResult
                  ? `Mail envoyé à ${unlockEmailResult.sentCount} compte${unlockEmailResult.sentCount > 1 ? "s" : ""} (sur ${unlockEmailResult.total} non confirmés — les autres l'avaient déjà reçu).`
                  : `${kpis.unconfirmedEmails} compte${kpis.unconfirmedEmails > 1 ? "s" : ""} n'ont jamais confirmé leur email — ils ne savent probablement pas qu'ils peuvent se connecter sans confirmer.`}
              </div>
              {!unlockEmailResult && (
                <button
                  onClick={sendUnlockEmails}
                  disabled={unlockEmailBusy}
                  className="text-[11px] font-medium px-3 py-1.5 rounded-full disabled:opacity-50 shrink-0"
                  style={
                    unlockEmailArmed
                      ? { background: `${TIER_COLORS.low}25`, color: TIER_COLORS.low }
                      : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }
                  }
                >
                  {unlockEmailBusy ? "Envoi en cours…" : unlockEmailArmed ? "Confirmer l'envoi ?" : "Envoyer le mail de déblocage"}
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
            {kpiCards.map((c) => (
              <div key={c.label} className="rounded-xl p-3 border border-white/10" style={{ background: "#26221C" }}>
                <div className="text-white text-xl font-display">{c.value}</div>
                <div className="text-white/40 text-[10px] uppercase tracking-wide mt-0.5">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Provenance des visites (2026-08-26) : LA vue à regarder dès qu'on paie de la publicité.
              Sans elle, impossible de distinguer les visiteurs venus d'une campagne du trafic
              naturel — donc impossible de savoir si l'argent dépensé rapporte quoi que ce soit.
              "direct" regroupe tout ce qui arrive sans `?src=` : trafic naturel, liens partagés,
              MAIS AUSSI ses propres visites s'il n'a pas ouvert le site avec `?notrack=1` au moins
              une fois sur cet appareil — d'où le rappel affiché juste en dessous. */}
          {bySource.length > 0 && (
            <div className="rounded-xl p-4 border border-white/10 mb-5" style={{ background: "#26221C" }}>
              <div className="text-white/50 text-[10px] uppercase tracking-wide mb-3">Provenance — bilan complet</div>
              {/* Tableau plutôt qu'une liste : avec 5 chiffres par ligne, l'alignement en colonnes
                  est le seul moyen de comparer deux sources d'un coup d'œil. `overflow-x-auto` pour
                  que ça reste lisible sur un téléphone sans jamais faire déborder la page. */}
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-[11px] whitespace-nowrap">
                  <thead>
                    <tr className="text-white/35 text-[10px] uppercase tracking-wide">
                      <th className="text-left font-normal pb-2">Source</th>
                      <th className="text-right font-normal pb-2 pl-3">Visites</th>
                      <th className="text-right font-normal pb-2 pl-3">3s+</th>
                      <th className="text-right font-normal pb-2 pl-3">Calcul</th>
                      <th className="text-right font-normal pb-2 pl-3">Clics</th>
                      <th className="text-right font-normal pb-2 pl-3">Comptes</th>
                      <th className="text-right font-normal pb-2 pl-3">→ Compte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bySource.map((s) => {
                      // Le taux qui compte vraiment : sur 100 visiteurs amenés par cette source,
                      // combien sont allés jusqu'à créer un compte. C'est lui qui dit si une
                      // campagne payante est rentable, pas le nombre de visites brut.
                      const tauxCompte = s.views > 0 ? Math.round((s.accounts / s.views) * 100) : 0;
                      const estCampagne = s.source !== "direct";
                      return (
                        <tr key={s.source} className="border-t border-white/5">
                          <td className="py-2">
                            <span
                              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              style={
                                estCampagne
                                  ? { background: `${BRAND_SOLID}25`, color: BRAND_SOLID }
                                  : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }
                              }
                            >
                              {s.source}
                            </span>
                          </td>
                          <td className="text-right text-white pl-3">{s.views}</td>
                          {/* Un écart énorme entre "Visites" et "3s+" signifie que la page a été
                              chargée sans être regardée — trafic sans valeur, quelle que soit la
                              qualité de la page. */}
                          <td className="text-right text-white/70 pl-3">{s.engaged ?? 0}</td>
                          {/* Visiteurs ayant manipulé le calculateur : le vrai signal d'intérêt,
                              il précède le clic d'inscription dans le parcours. */}
                          <td className="text-right pl-3 font-semibold" style={{ color: (s.calcUsed ?? 0) > 0 ? BRAND_SOLID : "rgba(255,255,255,0.3)" }}>{s.calcUsed ?? 0}</td>
                          <td className="text-right text-white/70 pl-3">{s.startClicks}</td>
                          <td className="text-right text-white pl-3 font-semibold">{s.accounts}</td>
                          <td
                            className="text-right pl-3 font-bold"
                            style={{ color: tauxCompte > 0 ? TIER_COLORS.high : "rgba(255,255,255,0.3)" }}
                          >
                            {tauxCompte}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-white/30 text-[10px] mt-3 leading-relaxed">
                « 3s+ » = visiteurs restés au moins 3 secondes sur la page. Un écart énorme avec « Visites » signifie que la
                page a été chargée sans être regardée : trafic sans valeur, quelle que soit la qualité de la page.
                « Clics » = clics sur « Commencer ». « → Compte » = part des visiteurs de cette source qui sont allés
                jusqu'à créer un compte : c'est le chiffre qui dit si une campagne rapporte.
                <br />
                « direct » = sans paramètre de campagne : trafic naturel, liens partagés, et tes propres visites tant
                que tu n'as pas ouvert le site une fois avec <span className="text-white/50">?notrack=1</span> sur cet
                appareil. Les comptes créés avant la mise en place du suivi y sont aussi rattachés.
              </p>
            </div>
          )}

          <div className="rounded-xl p-4 border border-white/10 mb-5" style={{ background: "#26221C" }}>
            <div className="text-white/50 text-[10px] uppercase tracking-wide mb-2">Visites par jour</div>
            <DailyBarChart series={dailySeries.map((d) => ({ date: d.date, value: d.views }))} color={BRAND_SOLID} />
          </div>

          {/* Détail jour par jour (2026-08-19) — le graphique seul ne suffisait pas pour savoir
              précisément "ma vidéo TikTok du 19 août m'a rapporté combien de visites", demandé
              explicitement par l'utilisateur. Un chiffre exact par ligne, pas une barre à interpréter. */}
          <div className="rounded-xl border border-white/10 overflow-hidden" style={{ background: "#26221C" }}>
            <div className="text-white/50 text-[10px] uppercase tracking-wide p-4 pb-2">Détail par jour</div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/40 text-left border-b border-white/10">
                    <th className="px-4 py-2 font-normal">Date</th>
                    <th className="px-4 py-2 font-normal">Visites</th>
                    <th className="px-4 py-2 font-normal">Clics "essai"</th>
                    <th className="px-4 py-2 font-normal">Scans</th>
                  </tr>
                </thead>
                <tbody>
                  {[...dailySeries].reverse().map((d) => (
                    <tr key={d.date} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-2 text-white/80 whitespace-nowrap">
                        {new Date(d.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </td>
                      <td className="px-4 py-2 text-white/70 whitespace-nowrap">{d.views}</td>
                      <td className="px-4 py-2 text-white/70 whitespace-nowrap">{d.startClicks}</td>
                      <td className="px-4 py-2 text-white/70 whitespace-nowrap">{d.scans}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// [REFONTE 2026-08-27, après le premier test réel de l'utilisateur] Premier lancement guidé,
// version à UN SEUL écran : on demande le plat et son prix de vente, on crée la recette, et on
// dépose le chef directement dans sa VRAIE fiche recette pour qu'il y ajoute ses ingrédients.
//
// La version précédente proposait un mini-éditeur d'ingrédients maison en 3 étapes. Elle a été
// jugée inutilisable au premier test, pour trois raisons qui tenaient toutes à la même erreur —
// avoir redéveloppé en petit ce que la fiche recette fait déjà en grand :
//   1. la recherche était limitée au CATALOG (195 entrées) : l'ingrédient du chef n'y était pas,
//      et rien ne permettait d'en créer un ;
//   2. rien n'indiquait qu'on pouvait en ajouter plusieurs (le champ de recherche se vidait après
//      chaque ajout, ce qui donnait l'impression d'être limité à un seul) ;
//   3. les prix venaient d'estimations par catégorie, non modifiables : avec un seul ingrédient
//      bon marché, la marge affichée frôlait les 100% et ne voulait plus rien dire.
//
// La fiche recette, elle, sait déjà tout faire : chercher un ingrédient, en CRÉER un qui n'existe
// nulle part (avec catégorie et prix, estimé ou saisi), en ajouter autant qu'on veut, et corriger
// un prix en place. Dupliquer ça en moins bien était une faute — on y renvoie donc directement.
// Bonus : le chef apprend la vraie interface tout de suite au lieu d'un formulaire jetable.
function FirstRunWizard({ t, onFinish, onSkip }) {
  const [dishName, setDishName] = useState("");
  const [sellPrice, setSellPrice] = useState(0);
  const canCreate = dishName.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3 py-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 max-h-full overflow-y-auto" style={{ background: "#26221C" }}>
        <div className="p-5">
          <h2 className="font-display uppercase text-white text-sm tracking-wide mb-1">{t("firstRunTitle")}</h2>
          <p className="text-white/50 text-xs mb-4">{t("firstRunHint")}</p>

          <label className="block text-white/50 text-[11px] mb-1">{t("firstRunDishLabel")}</label>
          <input
            value={dishName}
            onChange={(e) => setDishName(e.target.value)}
            placeholder={t("firstRunDishPlaceholder")}
            className="w-full rounded-lg px-3 py-2.5 text-base text-white outline-none mb-3"
            style={{ background: "rgba(0,0,0,0.25)" }}
          />

          <label className="block text-white/50 text-[11px] mb-1">{t("firstRunPriceLabel")}</label>
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-2.5" style={{ background: "rgba(0,0,0,0.25)" }}>
            <NumField
              value={sellPrice}
              onChange={setSellPrice}
              className="w-full min-w-0 bg-transparent text-white text-base font-semibold outline-none text-right"
            />
            <span className="text-white/40 text-sm shrink-0">€</span>
          </div>
          <p className="text-white/30 text-[10px] mt-1.5">{t("firstRunPriceHint")}</p>

          <button
            type="button"
            disabled={!canCreate}
            onClick={() => onFinish({ dishName: dishName.trim(), sellPrice })}
            className="w-full mt-5 py-3 rounded-full font-display uppercase text-[11px] tracking-wide font-semibold disabled:opacity-40"
            style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
          >
            {t("firstRunCreate")}
          </button>

          <button type="button" onClick={onSkip} className="w-full mt-3 text-[11px] text-white/35 hover:text-white/70">
            {t("firstRunSkip")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [ingredients, setIngredients] = useState(SEED_INGREDIENTS);
  const [recipes, setRecipes] = useState(buildSeedRecipes("fr"));
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  // Mémoire des rapprochements fournisseur → ingrédient déjà validés lors d'un scan précédent
  // (clé = texte brut de la ligne facture normalisé, valeur = id de l'ingrédient du garde-manger).
  const [supplierMappings, setSupplierMappings] = useState([]);
  // Réglages de la carte digitale publique (2026-08) : `published` contrôle tout seul si la page
  // publique répond quoi que ce soit (voir api/public-menu.js) — même si des recettes ont
  // `menuIncluded: true`, rien n'est visible tant que ce drapeau n'est pas activé explicitement.
  const [menuSettings, setMenuSettings] = useState({ published: false, design: "classic", restaurantName: "", logo: null, accentColor: MENU_ACCENT_COLORS[0] });
  const [digitalMenuOpen, setDigitalMenuOpen] = useState(false);
  // Articles simples de la carte digitale (2026-08-19) : boissons/produits revendus tels quels
  // (Coca, Perrier...) — volontairement PAS des recettes (jamais dans `recipes`), pour ne pas
  // polluer l'onglet Recettes/le classement TOP/les fiches imprimées avec des centaines de lignes
  // sans rapport avec le calcul de marge. Coût d'achat optionnel (`cost`, souvent absent — l'idée
  // est un ajout ultra-rapide, pas un vrai suivi de marge comme pour les recettes).
  const [simpleItems, setSimpleItems] = useState([]);
  // Id du compte, utilisé uniquement pour construire l'URL publique /menu/<id> (voir
  // DigitalMenuModal) — jamais stocké, récupéré une fois depuis la session déjà active
  // (AuthGate garantit qu'il y en a toujours une à ce stade).
  const [menuUserId, setMenuUserId] = useState(null);
  // Tableau de bord admin (2026-08-19) : visible uniquement depuis le compte personnel de
  // l'utilisateur, jamais pour un autre compte Chefup — vérifié aussi côté serveur
  // (api/admin-dashboard.js) puisque l'email pourrait en théorie être falsifié côté client.
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminDashboardOpen, setAdminDashboardOpen] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setMenuUserId(data.session?.user?.id || null);
      setIsAdmin(data.session?.user?.email === "alexmollet0@gmail.com");
    });
  }, []);
  const [activeId, setActiveId] = useState("r1");
  const [activeTab, setActiveTab] = useState("recipes"); // 'recipes' | 'scanner' | 'pantry'
  const [hidePricesPrint, setHidePricesPrint] = useState(false);
  const [allergenSheetOpen, setAllergenSheetOpen] = useState(false);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [recipeSubView, setRecipeSubView] = useState("list"); // 'list' | 'detail'
  const [recipeListLayout, setRecipeListLayout] = useState(() => {
    try { return localStorage.getItem("chefup:recipeListLayout") || "list"; } catch { return "list"; }
  }); // 'list' | 'grid' — préférence d'affichage locale, pas une donnée métier (pas de sync compte)
  const [lang, setLang] = useState("fr");
  const [showSettings, setShowSettings] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalErr, setPortalErr] = useState("");
  const [showMarginLegend, setShowMarginLegend] = useState(false);
  const [ready, setReady] = useState(false);
  // Premier lancement guidé (2026-08-27). `null` = pas encore lu depuis le stockage : tant qu'on
  // ne sait pas, on n'affiche RIEN — afficher l'assistant à un utilisateur qui l'a déjà fait
  // serait bien pire que de ne pas l'afficher du tout à un nouveau.
  const [firstRunDone, setFirstRunDone] = useState(null);
  const [loadErr, setLoadErr] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);

  const [pantryQuery, setPantryQuery] = useState("");
  const [pantryCategory, setPantryCategory] = useState("none");
  const [expandedIngId, setExpandedIngId] = useState(null);
  // Sélection multiple dans la vue "Récents" uniquement — pour qu'un client qui a ajouté/scanné
  // une cinquantaine d'ingrédients par erreur (bug utilisateur réel évoqué par l'utilisateur)
  // puisse les retirer lui-même en un clic, sans dépendre d'une intervention manuelle sur sa
  // base de données. Réinitialisée en changeant de catégorie pour ne jamais garder une sélection
  // périmée (ex: sur des ingrédients qui ne sont plus dans "Récents" après suppression d'un autre).
  const [selectedRecentIds, setSelectedRecentIds] = useState(() => new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  useEffect(() => { setSelectedRecentIds(new Set()); }, [pantryCategory]);
  const [autoOpenIdx, setAutoOpenIdx] = useState(null);
  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [showQtyHint, setShowQtyHint] = useState(false);
  // Index de la ligne de recette dont le prix (du fournisseur actif) est en cours d'édition
  // directement depuis la fiche recette — demandé par l'utilisateur pour corriger rapidement un
  // prix estimé faux (ex: import scan) sans devoir aller jusqu'au garde-manger.
  const [editingLinePriceIdx, setEditingLinePriceIdx] = useState(null);
  // Nombre de portions cible pour "adapter les quantités" — distinct du champ portions de la
  // recette, qui lui ne recalcule rien (voir scaleRecipeToPortions).
  const [scaleTarget, setScaleTarget] = useState(0);

  // Formulaire de contact/réclamation : état totalement indépendant du reste.
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactErr, setContactErr] = useState(null);
  const [contactAttachment, setContactAttachment] = useState(null); // { base64, mediaType, fileName } | null
  const [contactAttaching, setContactAttaching] = useState(false);
  const fileInputContactRef = useRef(null);
  // Menu "Mon compte" (abonnement / nous contacter) : demandé par l'utilisateur pour ne plus les
  // enterrer dans la fenêtre Paramètres, plus accessible depuis l'en-tête comme dans la plupart
  // des apps (Paramètres reste réservé aux réglages de calcul : TVA, marge, rappels, réinitialiser).
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  // Installation sur l'écran d'accueil (2026-08-23) : bouton "Installer l'app" DANS le menu "Mon
  // compte", demandé par l'utilisateur après avoir cherché en vain un raccourci visible dans
  // l'app elle-même. `installPromptReady` reflète si Chrome/Edge a capturé l'invite native
  // (`window.__chefupInstallPrompt`, voir src/main.jsx) — si oui, un clic déclenche directement la
  // vraie boîte de dialogue d'installation du navigateur. Sinon (iOS Safari, qui n'expose AUCUN
  // moyen programmatique de déclencher "Sur l'écran d'accueil" — restriction Apple, pas une limite
  // de cette app — ou navigateur qui ne supporte pas l'installation), un clic affiche des
  // instructions à la place (`installInstructionsOpen`).
  const [installPromptReady, setInstallPromptReady] = useState(!!window.__chefupInstallPrompt);
  const [installInstructionsOpen, setInstallInstructionsOpen] = useState(false);
  // Bandeau discret sur l'écran d'accueil des recettes (2026-08-23) : le bouton dans "Mon compte"
  // était jugé trop caché par l'utilisateur. Ignorable sans y toucher (juste une croix, jamais
  // bloquant), mémorisé en localStorage pour ne plus jamais réapparaître une fois fermé.
  const [installBannerDismissed, setInstallBannerDismissed] = useState(() => {
    try { return localStorage.getItem("chefup:installBannerDismissed") === "1"; } catch { return false; }
  });
  const dismissInstallBanner = () => {
    setInstallBannerDismissed(true);
    try { localStorage.setItem("chefup:installBannerDismissed", "1"); } catch {}
  };
  const isStandaloneApp =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator?.standalone === true);
  const isIOSDevice = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  // Sur iOS, TOUS les navigateurs (Chrome, Firefox, Edge...) tournent sur le même moteur que
  // Safari (imposé par Apple) et ont donc la même restriction — mais pas la même interface, donc
  // pas le même endroit où chercher "Ajouter à l'écran d'accueil". Cas réel remonté par
  // l'utilisateur : sur iPhone + app Chrome, les instructions "façon Safari" (bouton Partager en
  // bas) ne collent pas à l'interface réellement affichée. Chrome iOS s'identifie par "CriOS" dans
  // le user-agent (le "Chrome/" habituel n'y figure pas sur iOS).
  const isIOSChromeDevice = isIOSDevice && /CriOS/i.test(navigator.userAgent);
  useEffect(() => {
    const handler = () => setInstallPromptReady(!!window.__chefupInstallPrompt);
    window.addEventListener("chefup:install-available", handler);
    return () => window.removeEventListener("chefup:install-available", handler);
  }, []);
  const handleInstallClick = async () => {
    setAccountMenuOpen(false);
    const promptEvent = window.__chefupInstallPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      try { await promptEvent.userChoice; } catch (e) {}
      window.__chefupInstallPrompt = null;
      setInstallPromptReady(false);
    } else {
      setInstallInstructionsOpen(true);
    }
  };

  const [addWizardOpen, setAddWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1); // 1 nom/recherche, 2 prix+unité, 3 catégorie (création only), "success"
  const [wizardQuery, setWizardQuery] = useState("");
  const [wizardData, setWizardData] = useState({ name: "", catalogId: null, unit: "kg", category: "autres", price: 0 });
  const [wizardEditId, setWizardEditId] = useState(null); // id de l'ingrédient existant en cours de modification, sinon null (création)
  // Index de la ligne de recette qui a ouvert l'assistant (création rapide depuis une recette),
  // pour lui assigner automatiquement l'ingrédient une fois créé/choisi — null si l'assistant a
  // été ouvert depuis le garde-manger, auquel cas rien de plus à faire après création.
  const [wizardReturnToLineIdx, setWizardReturnToLineIdx] = useState(null);

  const [scanOpen, setScanOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState(null);
  const [scanResult, setScanResult] = useState(null); // { supplier, date, items: [...] }
  // Aperçu de l'image EXACTE (déjà compressée) envoyée à l'IA — outil de diagnostic (2026-08) suite
  // à un cas réel où le scanner échouait systématiquement sur un téléphone précis alors qu'il
  // fonctionnait sur ordinateur avec la même facture papier, sans pouvoir accéder au téléphone pour
  // inspecter directement ce qui était envoyé. Permet à l'utilisateur de voir lui-même si l'image
  // est nette/bien orientée avant de suspecter le modèle d'IA.
  const [scanImagePreview, setScanImagePreview] = useState(null);
  const [scanImageZoomed, setScanImageZoomed] = useState(false);
  // Photo en attente de confirmation avant l'envoi à l'IA (2026-08) : une photo transmise par une
  // appli de messagerie a souvent perdu son étiquette de rotation EXIF (beaucoup d'applis la
  // suppriment ou l'altèrent en compressant à l'envoi) — dans ce cas `compressImageFile` n'a plus
  // rien à corriger automatiquement, la photo peut repartir tournée. Cas réel confirmé en test :
  // une vraie facture, envoyée par un tiers, restait tournée malgré le correctif d'orientation
  // automatique, et l'IA inventait des produits n'ayant aucun rapport avec le document plutôt que
  // d'admettre ne pas pouvoir le lire. Un bouton pivoter manuel avant analyse règle ce cas
  // universellement, sans dépendre de la fiabilité de la métadonnée EXIF.
  const [scanPendingImage, setScanPendingImage] = useState(null); // { base64, mediaType }
  // Étape en cours pendant l'analyse ("prepare" | "ocr" | "ai") — affichée à l'écran pour que
  // l'attente ne ressemble jamais à un blocage. Un scan peut prendre 30 à 60 secondes sur un
  // document dense : sans indication de progression, l'utilisateur croit que c'est planté et ferme.
  const [scanStep, setScanStep] = useState(null);
  // Dernière image réellement envoyée + par quel bouton le fichier est arrivé, pour proposer un
  // "Réessayer" en un seul tap après un échec au lieu de tout faire recommencer.
  const [lastScanImage, setLastScanImage] = useState(null); // { base64, mediaType }
  const [lastScanSource, setLastScanSource] = useState("file"); // "file" | "camera"
  const [reviewStackOpen, setReviewStackOpen] = useState(false);
  const [stackTotal, setStackTotal] = useState(0);
  const [expandedReviewIdx, setExpandedReviewIdx] = useState(null);
  const fileInputRef = useRef(null);
  const fileInputLibraryRef = useRef(null);

  // Scanner de fiche recette : état totalement séparé du scanner de factures ci-dessus (autre
  // fichier serveur, autre écran de vérification) pour ne jamais risquer de régresser le scanner
  // de factures existant en le touchant.
  const [scanRecipeOpen, setScanRecipeOpen] = useState(false);
  const [scanningRecipe, setScanningRecipe] = useState(false);
  const [scanRecipeErr, setScanRecipeErr] = useState(null);
  const [scanRecipeResult, setScanRecipeResult] = useState(null); // { name, portions, sellPrice, allergens, notes, lines: [...] }
  const fileInputRecipeLibraryRef = useRef(null);

  // Signale à main.jsx qu'un scan (facture ou fiche recette) est en cours — le mécanisme de
  // détection de bundle périmé (checkForNewVersion) recharge sinon la page sans avertissement dès
  // que l'onglet reprend le focus, ce qui arrive typiquement juste après avoir pris une photo avec
  // l'appareil photo natif du téléphone (quitter Chefup → photo → revenir = focus). Un rechargement
  // à ce moment précis efface la photo en attente et oblige à tout recommencer. Ce flag ne
  // supprime pas le rechargement, il le repousse simplement jusqu'à ce que le scan soit fermé.
  useEffect(() => {
    window.__chefupScanBusy = scanOpen || scanRecipeOpen;
    return () => { window.__chefupScanBusy = false; };
  }, [scanOpen, scanRecipeOpen]);

  const t = useCallback((key) => TR[lang][key] ?? TR.fr[key] ?? key, [lang]);
  const ingredientDisplayName = useCallback(
    (ing) => (ing?.catalogId && CATALOG_MAP[ing.catalogId] ? CATALOG_MAP[ing.catalogId][lang] : ing?.name || ""),
    [lang]
  );

  useEffect(() => {
    (async () => {
      try {
        let ing = null, rec = null, set = null, lg = null, sm = null, ms = null, si = null;
        try { const r = await storage.get("ingredients"); ing = r ? JSON.parse(r.value) : null; } catch (e) {}
        try { const r = await storage.get("recipes"); rec = r ? JSON.parse(r.value) : null; } catch (e) {}
        try { const r = await storage.get("settings"); set = r ? JSON.parse(r.value) : null; } catch (e) {}
        try { const r = await storage.get("lang"); lg = r ? JSON.parse(r.value) : null; } catch (e) {}
        try { const r = await storage.get("supplierMappings"); sm = r ? JSON.parse(r.value) : null; } catch (e) {}
        try { const r = await storage.get("menuSettings"); ms = r ? JSON.parse(r.value) : null; } catch (e) {}
        try { const r = await storage.get("simpleItems"); si = r ? JSON.parse(r.value) : null; } catch (e) {}
        // Drapeau du premier lancement guidé : stocké par COMPTE (kv_store) et non par appareil,
        // pour qu'un chef qui ouvre l'app sur son téléphone puis sur son ordinateur ne le revoie
        // pas une deuxième fois. Un échec de lecture laisse `false` : au pire l'assistant
        // s'affiche, il est passable en un clic.
        try { const r = await storage.get("firstRunDone"); setFirstRunDone(r ? JSON.parse(r.value) === true : false); }
        catch (e) { setFirstRunDone(false); }
        if (ing && ing.length) setIngredients(ing);
        // Nouvel utilisateur (rien encore enregistré) mais langue déjà connue (choisie avant que
        // le premier chargement se termine) : reconstruit la recette de démo dans cette langue
        // plutôt que de garder la version française par défaut du useState initial.
        if (rec && rec.length) { setRecipes(rec); setActiveId(rec[0].id); }
        else if (lg && lg !== "fr") { setRecipes(buildSeedRecipes(lg)); }
        if (set) setSettings({ ...DEFAULT_SETTINGS, ...set });
        if (lg) setLang(lg);
        if (sm && sm.length) setSupplierMappings(sm);
        if (ms) setMenuSettings({ published: false, design: "classic", restaurantName: "", logo: null, accentColor: MENU_ACCENT_COLORS[0], ...ms });
        if (si && si.length) setSimpleItems(si);
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
  useDebouncedSave("supplierMappings", supplierMappings, ready);
  useDebouncedSave("menuSettings", menuSettings, ready);
  useDebouncedSave("simpleItems", simpleItems, ready);

  useEffect(() => {
    if (!ready) return;
    setRecipes((rs) => rs.map((r) => {
      if (r.allergensAuto === false) return r;
      const computed = detectAllergens(r.lines, ingredients, lang);
      const codes = detectAllergenCodes(r.lines, ingredients);
      const sameCodes = r.allergenCodes && r.allergenCodes.length === codes.length && r.allergenCodes.every((c, i) => c === codes[i]);
      if (computed === r.allergens && sameCodes) return r;
      return { ...r, allergens: computed, allergenCodes: codes };
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

  // [AJOUT 2026-08-28] Renommer était techniquement possible dès l'ouverture (le nom est un champ
  // texte), mais rien ne le signalait — un gros titre "NOUVELLE RECETTE" en majuscules se lit comme
  // un titre déjà là, pas comme la toute première chose à faire. Demandé par l'utilisateur ("c'est
  // la première chose qu'on doit faire quand on crée une recette"). `recipeNameInputRef` + ce
  // drapeau focalisent le champ ET sélectionnent tout son texte dès l'ouverture d'une recette
  // FRAÎCHEMENT créée via `addRecipe` (jamais sur la démo, jamais en rouvrant une recette
  // existante) — la première frappe remplace directement le placeholder, sans avoir à cliquer ni
  // à comprendre que c'est éditable.
  const recipeNameInputRef = useRef(null);
  const [focusNameOnOpen, setFocusNameOnOpen] = useState(false);
  useEffect(() => {
    if (!focusNameOnOpen || !recipeNameInputRef.current) return;
    recipeNameInputRef.current.focus();
    recipeNameInputRef.current.select();
    setFocusNameOnOpen(false);
  }, [focusNameOnOpen, active?.id]);

  const lineCost = (line) => {
    const ing = ingredientById(line.ingredientId);
    return ing ? effectiveUnitPrice(ing) * line.qty : 0;
  };

  // Vrai si au moins une ligne de cette recette a une quantité saisie dans une unité qui a changé
  // depuis (voir updateLineQty/changeLineIngredient) — sert à afficher un repère dans la liste des
  // recettes, pour ne pas avoir à ouvrir chaque fiche pour le découvrir.
  const recipeHasUnitMismatch = (r) =>
    r.lines.some((l) => {
      const ing = ingredientById(l.ingredientId);
      return ing && l.unitAtEntry !== undefined && l.unitAtEntry !== ing.unit;
    });

  // Compte encore totalement vierge : la seule recette est la démo non modifiée ET aucun prix réel
  // n'a jamais été saisi ou scanné. Condition volontairement stricte — mieux vaut rater l'assistant
  // pour quelqu'un qui a déjà touché à un truc que l'imposer à un utilisateur installé.
  const looksBrandNew =
    recipes.length <= 1 &&
    (recipes.length === 0 || isPristineSeedRecipe(recipes[0])) &&
    ingredients.every((i) => (activeSupplier(i)?.priceSource || "estimate") === "estimate");
  const showFirstRun = ready && firstRunDone === false && looksBrandNew;

  const closeFirstRun = () => {
    setFirstRunDone(true);
    storage.set("firstRunDone", JSON.stringify(true)).catch(() => {});
  };

  // Crée la recette vide (nom + prix de vente) et ouvre sa fiche : c'est là que le chef ajoutera
  // ses ingrédients, avec la vraie interface — voir le commentaire de FirstRunWizard pour pourquoi
  // on ne construit plus d'éditeur d'ingrédients séparé. La recette n'a volontairement AUCUNE
  // ligne : grâce au correctif de , elle n'affiche donc pas de marge tant qu'aucun
  // ingrédient n'est saisi, au lieu d'un 100% absurde.
  const finishFirstRun = ({ dishName, sellPrice }) => {
    const newRecipe = {
      id: uid(),
      name: dishName || t('newRecipeName'),
      // 1 portion : le chef a saisi le prix de vente d'UNE assiette.
      portions: 1,
      sellPrice: sellPrice || 0,
      targetMargin: settings.minMargin ?? 75,
      notes: '',
      allergens: '',
      allergensAuto: true,
      createdAt: today(),
      lines: [],
    };
    setRecipes((rs) => [...rs, newRecipe]);
    setActiveId(newRecipe.id);
    setActiveTab('recipes');
    setRecipeSubView('detail');
    closeFirstRun();
    logActivity('recipe_created', { name: newRecipe.name, source: 'first_run' });
  };

  // [PONT CARTE DIGITALE → MARGE, 2026-08-27] Transforme un article simple de la carte (nom + prix,
  // saisi en rafale, sans recette derrière) en vraie recette dont on pourra connaître la marge.
  // C'est la pièce qui manquait pour que la carte digitale serve de porte d'entrée : le chef
  // compose d'abord sa carte en quelques minutes (gratifiant, visible, aucun effort), puis
  // découvre plat par plat ce que chacun lui rapporte — au lieu de devoir créer des recettes
  // complètes avant d'avoir la moindre carte à montrer.
  const convertSimpleItemToRecipe = (item) => {
    if (!item) return;
    const lines = [];
    // Un coût déjà saisi sur l'article n'a nulle part où aller dans une recette : sans ce
    // traitement, la conversion afficherait 100% de marge et perdrait l'information. On le
    // matérialise donc en ingrédient "à la pièce" — ce qui est d'ailleurs la modélisation juste
    // pour un produit revendu tel quel (une bouteille achetée = une pièce consommée).
    if (item.cost > 0) {
      const sId = uid();
      const ingId = uid();
      setIngredients((ings) => [
        ...ings,
        {
          id: ingId,
          name: item.name || t("newRecipeName"),
          unit: "pièce",
          catalogId: null,
          category: "autres",
          selectedSupplierId: sId,
          suppliers: [{ id: sId, name: t("supplier"), price: item.cost, priceSource: "manual" }],
          history: [],
          lastUpdated: today(),
        },
      ]);
      lines.push({ ingredientId: ingId, qty: 1, unitAtEntry: "pièce" });
    }

    const newRecipe = {
      id: uid(),
      name: item.name || t("newRecipeName"),
      // 1 portion : le prix saisi sur la carte est celui d'UNE assiette vendue.
      portions: 1,
      sellPrice: item.sellPrice || 0,
      targetMargin: settings.minMargin ?? 75,
      notes: "",
      allergens: "",
      allergensAuto: true,
      createdAt: today(),
      lines,
      // Reprend la place de l'article sur la carte publique, avec sa section et sa traduction déjà
      // calculée — sinon le plat disparaîtrait de la carte au moment de la conversion, alors que
      // le chef n'a rien demandé de tel.
      menuIncluded: true,
      menuCategory: item.menuCategory || null,
      menuNameI18n: item.menuNameI18n || null,
    };
    setRecipes((rs) => [...rs, newRecipe]);
    // Indispensable : sans cette suppression, le plat apparaîtrait EN DOUBLE sur la carte publique
    // (une fois comme article simple, une fois comme recette).
    setSimpleItems((items) => items.filter((i) => i.id !== item.id));

    setActiveId(newRecipe.id);
    setActiveTab("recipes");
    setRecipeSubView("detail");
    setDigitalMenuOpen(false);
    logActivity("recipe_created", { name: newRecipe.name, source: "menu_item" });
  };

  const recipeCost = (r) => r.lines.reduce((s, l) => s + lineCost(l), 0);
  const recipeCostPerPortion = (r) => (r.portions > 0 ? recipeCost(r) / r.portions : 0);
  const vatRate = settings.vat ?? 10;
  const priceHT = (ttc) => ttc / (1 + vatRate / 100);
  const recipeMargin = (r) => {
    // [CORRECTION 2026-08-27] Une recette sans le moindre ingrédient n'a pas une marge de 100%,
    // elle a une marge INCONNUE. Le cas ne se produisait presque jamais avant (une recette créée à
    // la main démarre à 0€ de prix de vente, donc sans marge calculable), mais le pont
    // "article de carte → recette" arrive maintenant avec un prix de vente DÉJÀ renseigné et
    // aucune ligne : sans ce garde-fou, le chef verrait un magnifique 100% vert, et la recette
    // décrocherait même un badge TOP1 au classement.
    if (!r.lines || r.lines.length === 0) return null;
    const cpp = recipeCostPerPortion(r);
    const ht = priceHT(r.sellPrice || 0);
    return ht > 0 ? ((ht - cpp) / ht) * 100 : null;
  };

  // Classement TOP1/2/3 : uniquement les recettes déjà au-dessus de leur objectif de marge
  // (objectif propre à la recette si réglé, sinon le réglage global — même seuil que la
  // couleur verte), classées par marge % décroissante.
  const topRecipeIds = recipes
    .map((r) => ({ id: r.id, m: recipeMargin(r), target: r.targetMargin ?? settings.minMargin }))
    .filter((x) => x.m !== null && marginTier(x.m, x.target) === "high")
    .sort((a, b) => b.m - a.m)
    .slice(0, 3)
    .map((x) => x.id);

  const totalCost = active ? recipeCost(active) : 0;
  const costPerPortion = active ? recipeCostPerPortion(active) : 0;
  const sellHT = active ? priceHT(active.sellPrice || 0) : 0;
  const margin = active ? recipeMargin(active) : null;
  const targetMargin = active?.targetMargin ?? 75;
  const suggestedHT = active && targetMargin < 100 ? costPerPortion / (1 - targetMargin / 100) : null;
  const suggestedTTC = suggestedHT !== null ? suggestedHT * (1 + vatRate / 100) : null;
  // Règle : on ne propose un prix conseillé que si la marge actuelle n'atteint pas encore l'objectif.
  // Si l'objectif est déjà atteint ou dépassé, on ne suggère jamais un prix plus bas.
  // On compare la valeur ARRONDIE (celle affichée à l'écran) pour éviter qu'un 74.8% affiché "75%" reste bloqué.
  const marginRounded = margin !== null ? Math.round(margin) : null;
  const isBelowTarget = marginRounded !== null && marginRounded < targetMargin;
  const isAtOrAboveTarget = marginRounded !== null && marginRounded >= targetMargin;
  const nextMarginStep = marginRounded !== null ? Math.min(99, Math.ceil((marginRounded + 5) / 5) * 5) : null;

  const updateRecipe = (patch) => setRecipes((rs) => rs.map((r) => (r.id === active.id ? { ...r, ...patch } : r)));
  // [2026-08-27] Adapter une recette à un autre nombre de portions EN RECALCULANT les quantités.
  // Volontairement séparé du champ "portions" lui-même, qui reste inchangé — les deux usages
  // existent et sont contradictoires si on les mélange :
  //  · changer le champ portions SANS toucher aux quantités : le chef a saisi une préparation
  //    entière (3 kg de viande) et veut juste savoir combien ça fait par portion ;
  //  · adapter les quantités : le chef a saisi UNE assiette et veut imprimer sa fiche pour 10
  //    couverts, avec les grammages qui suivent.
  // Un champ qui ferait les deux serait forcément faux pour la moitié des utilisateurs, d'où une
  // action explicite et nommée plutôt qu'un comportement implicite.
  // Pré-rempli avec le nombre de portions actuel à chaque changement de recette : le chef part
  // toujours de la valeur en cours plutôt que d'un champ vide à deviner.
  useEffect(() => { if (active) setScaleTarget(active.portions || 1); }, [active?.id, active?.portions]);

  const scaleRecipeToPortions = (target) => {
    if (!active || !(target > 0)) return;
    const from = active.portions > 0 ? active.portions : 1;
    if (target === from) return;
    const ratio = target / from;
    const newLines = active.lines.map((l) => ({ ...l, qty: Math.round((l.qty || 0) * ratio * 100000) / 100000 }));
    const patch = { lines: newLines, portions: target };
    if (active.allergensAuto !== false) {
      patch.allergens = detectAllergens(newLines, ingredients, lang);
      patch.allergenCodes = detectAllergenCodes(newLines, ingredients);
    }
    updateRecipe(patch);
  };

  const applyLinesChange = (newLines) => {
    const patch = { lines: newLines };
    if (active.allergensAuto !== false) {
      patch.allergens = detectAllergens(newLines, ingredients, lang);
      patch.allergenCodes = detectAllergenCodes(newLines, ingredients);
    }
    updateRecipe(patch);
  };
  // `unitAtEntry` mémorise l'unité de l'ingrédient au moment où la quantité a été saisie/modifiée
  // — si l'unité de l'ingrédient change ensuite (ex: un scan de facture retrouve "Ail" en kg alors
  // qu'il était en "pièce"), la quantité déjà tapée n'a plus le même sens (2 gousses ≠ 2 kg) sans
  // que rien ne le signale. Comparer `unitAtEntry` à l'unité actuelle permet d'avertir sur la ligne
  // concernée. `undefined` (lignes déjà existantes avant ce correctif) ne déclenche jamais
  // l'avertissement, pour ne pas signaler a posteriori tout le garde-manger existant.
  const updateLineQty = (idx, qty) =>
    updateRecipe({
      lines: active.lines.map((l, i) => (i === idx ? { ...l, qty, unitAtEntry: ingredientById(l.ingredientId)?.unit } : l)),
    });
  const removeLine = (idx) => applyLinesChange(active.lines.filter((_, i) => i !== idx));
  const addLine = () => {
    const newIdx = active.lines.length;
    applyLinesChange([...active.lines, { ingredientId: null, qty: 1 }]);
    setAutoOpenIdx(newIdx);
  };
  const changeLineIngredient = (idx, ingredientId) =>
    applyLinesChange(active.lines.map((l, i) => (i === idx ? { ...l, ingredientId, unitAtEntry: ingredientById(ingredientId)?.unit } : l)));

  // [SAISIE EN RAFALE, 2026-08-27] Ajoute une ligne d'un coup : nom + quantité en grammes, sans
  // passer par "créer une ligne vide puis choisir puis saisir". Modelé sur la saisie des articles
  // de la carte digitale, que l'utilisateur trouvait justement rapide.
  // Si l'ingrédient n'existe pas encore dans le garde-manger, il est créé à la volée avec un prix
  // ESTIMÉ par catégorie (deviné via le catalogue) plutôt que d'interrompre la saisie pour
  // demander un prix : le badge "estimé" déjà existant signale ces prix, et le chef les corrige
  // quand il veut — le même compromis que celui déjà retenu pour le scanner de fiche recette.
  // Prix connu pour un nom tapé : celui du garde-manger si l'ingrédient existe, sinon l'estimation
  // de sa catégorie. Sert à pré-remplir le champ prix de la saisie rapide, pour que l'utilisateur
  // voie tout de suite sur quoi la marge va être calculée — et corrige si c'est manifestement faux.
  const guessPriceForName = (name) => {
    const known = ingredients.find((i) => textIncludes(ingredientDisplayName(i), name.trim()) && ingredientDisplayName(i).length <= name.trim().length + 3);
    if (known) return activeSupplier(known)?.price || 0;
    const guess = guessCatalogEntry(name);
    return CATEGORY_ESTIMATE_PRICE[guess?.category || "autres"] || 5;
  };

  // Unité proposée pour un nom tapé, dans l'ordre : ce que le garde-manger sait déjà de cet
  // ingrédient, puis ce que le catalogue en dit (il connaît l'unité de chacune de ses 195
  // entrées), puis kg par défaut.
  // ⚠️ Le repli est "kg" (donc des grammes) et surtout PAS `CATEGORY_DEFAULT_UNIT` : celui-ci
  // renvoie "pièce" pour la catégorie "autres", où atterrit tout nom inconnu du catalogue — c'est
  // ce qui a transformé "croûtons" en un article à 5€ LA PIÈCE alors que l'utilisateur voulait en
  // mettre 100 grammes. Un ingrédient de cuisine inconnu se pèse, il ne se compte pas.
  const guessUnitForName = (name) => {
    const known = ingredients.find((i) => textIncludes(ingredientDisplayName(i), name.trim()) && ingredientDisplayName(i).length <= name.trim().length + 3);
    if (known?.unit) return normUnit(known.unit);
    const guess = guessCatalogEntry(name);
    return guess?.unit || "kg";
  };

  const quickAddLine = ({ existingId, name, grams, unit: chosenUnit, price }) => {
    if (!active) return;
    let ingredientId = existingId;
    let unit = chosenUnit || "kg";

    if (!ingredientId) {
      const guess = guessCatalogEntry(name);
      const category = guess ? guess.category : "autres";
      const sId = uid();
      ingredientId = uid();
      setIngredients((ings) => [
        ...ings,
        {
          id: ingredientId,
          name: name.trim(),
          unit,
          catalogId: guess?.confident ? guess.catalogId : null,
          category,
          selectedSupplierId: sId,
          suppliers: [{ id: sId, name: t("supplier"), price: CATEGORY_ESTIMATE_PRICE[category] || 5, priceSource: "estimate" }],
          history: [],
          lastUpdated: today(),
        },
      ]);
    } else {
      // [BUG corrigé 2026-08-27] L'unité choisie par l'utilisateur était IGNORÉE pour un
      // ingrédient déjà connu : on reprenait systématiquement celle stockée. Résultat, un "Lait
      // entier" enregistré en kg par erreur restait en grammes même après avoir explicitement
      // cliqué "mL" — 100 mL devenaient 100 g, sans le moindre signe.
      // Choisir une autre unité que celle enregistrée est donc désormais interprété comme une
      // CORRECTION de l'ingrédient lui-même : c'est la seule lecture qui ait du sens.
      // ⚠️ Effet voulu et déjà géré ailleurs : les recettes qui utilisaient déjà cet ingrédient
      // afficheront l'avertissement d'unité changée (voir `unitAtEntry`), puisque leurs quantités
      // avaient été saisies dans l'ancienne unité.
      const existing = ingredientById(existingId);
      const current = normUnit(existing?.unit || "kg");
      if (chosenUnit && chosenUnit !== current) {
        unit = chosenUnit;
        setIngredients((ings) => ings.map((i) => (i.id === existingId ? { ...i, unit: chosenUnit } : i)));
      } else {
        unit = current;
      }
    }

    // Prix corrigé directement dans la ligne de saisie (2026-08-27) : évite d'avoir à ressortir
    // pour rectifier une estimation manifestement fausse, et rend la marge juste immédiatement.
    if (price > 0) {
      setIngredients((ings) =>
        ings.map((i) => {
          if (i.id !== ingredientId) return i;
          const sup = i.suppliers.find((s) => s.id === i.selectedSupplierId) || i.suppliers[0];
          if (!sup || sup.price === price) return i;
          return {
            ...i,
            suppliers: i.suppliers.map((s) => (s.id === sup.id ? { ...s, price, priceSource: "manual" } : s)),
            history: [...(i.history || []), { date: today(), price, supplierName: sup.name, supplierId: sup.id }].slice(-15),
            lastUpdated: today(),
          };
        })
      );
    }

    // Le nombre saisi est exprimé dans l'unité AFFICHÉE (g, mL ou pièce) : on le reconvertit vers
    // l'unité de stockage, qui reste le kg/L. Une pièce se prend telle quelle.
    const qty = unit === "kg" || unit === "L" ? (grams || 0) / 1000 : grams || 0;
    applyLinesChange([...active.lines, { ingredientId, qty, unitAtEntry: unit }]);
  };

  const addRecipe = () => {
    const nr = {
      id: uid(), name: t("newRecipeName"), portions: 4, sellPrice: 0, targetMargin: 75,
      notes: "", allergens: "", allergensAuto: true, createdAt: today(), lines: [],
    };
    setRecipes((rs) => [...rs, nr]);
    setActiveId(nr.id);
    setActiveTab("recipes");
    setRecipeSubView("detail");
    setFocusNameOnOpen(true);
    logActivity("recipe_created", { name: nr.name });
  };

  const duplicateRecipe = (r) => {
    const copy = { ...r, id: uid(), name: r.name + " (copie)", createdAt: today(), lines: r.lines.map((l) => ({ ...l })) };
    setRecipes((rs) => [...rs, copy]);
    setActiveId(copy.id);
    setActiveTab("recipes");
    setRecipeSubView("detail");
  };

  const deleteRecipe = (id) => {
    setRecipes((rs) => rs.filter((r) => r.id !== id));
    if (activeId === id) {
      const rest = recipes.filter((r) => r.id !== id);
      if (rest.length) setActiveId(rest[0].id);
    }
  };

  const confirmDeleteRecipe = (id, name) => {
    if (window.confirm(t("deleteRecipeConfirm")(name))) deleteRecipe(id);
  };

  const updateIngredientField = (id, field, value) =>
    setIngredients((ings) => ings.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  const updateIngredientName = (id, value) =>
    setIngredients((ings) => ings.map((i) => (i.id === id ? { ...i, name: value, catalogId: null } : i)));

  // Corrige le prix du fournisseur actif directement depuis une ligne de recette — même
  // ingrédient partagé que le garde-manger, donc le changement s'y répercute automatiquement.
  // Utile en particulier pour corriger vite un prix estimé faux (ex: ingrédient créé par erreur
  // via le scanner de fiche recette) sans devoir naviguer jusqu'au garde-manger.
  // [BUG confirmé et corrigé, 2026-08-27] Cette fonction écrivait une entrée d'HISTORIQUE à chaque
  // appel — or elle est branchée sur le `onChange` d'un champ texte, donc appelée à CHAQUE TOUCHE
  // FRAPPÉE. Taper "1.70" par-dessus "2.50" enregistrait donc successivement 1 puis 1.7, et
  // `priceVariation` (qui compare les deux dernières entrées) affichait fièrement **+70% de
  // hausse** sur un prix que l'utilisateur venait pourtant de BAISSER. Cas réel signalé sur
  // "Salade, laitue". Au passage, ça saturait l'historique (plafonné à 15 entrées) de valeurs
  // intermédiaires sans aucun sens, effaçant les vrais prix passés.
  // Le prix affiché continue de se mettre à jour à chaque touche (la marge se recalcule en direct,
  // c'est voulu) ; seul l'HISTORIQUE attend la fin de la saisie — voir commitActiveSupplierPrice.
  const updateActiveSupplierPrice = (ingredientId, newPrice) => {
    setIngredients((ings) =>
      ings.map((ing) => {
        if (ing.id !== ingredientId) return ing;
        const sup = activeSupplier(ing);
        if (!sup) return ing;
        return {
          ...ing,
          suppliers: ing.suppliers.map((s) => (s.id === sup.id ? { ...s, price: newPrice, priceSource: "manual" } : s)),
          lastUpdated: today(),
        };
      })
    );
  };

  // Enregistre le prix dans l'historique, une seule fois, quand la saisie est terminée (perte de
  // focus). La comparaison se fait avec la DERNIÈRE ENTRÉE D'HISTORIQUE du même fournisseur, et
  // non avec le prix courant : celui-ci a déjà été modifié en direct par la frappe, il ne peut
  // donc plus servir de point de comparaison.
  const commitActiveSupplierPrice = (ingredientId, newPrice) => {
    setIngredients((ings) =>
      ings.map((ing) => {
        if (ing.id !== ingredientId) return ing;
        const sup = activeSupplier(ing);
        if (!sup || !(newPrice > 0)) return ing;
        const hist = ing.history || [];
        const mine = hist.filter((e) => (e.supplierId ? e.supplierId === sup.id : e.supplierName === sup.name));
        const last = mine[mine.length - 1];
        if (last && last.price === newPrice) return ing; // rien de neuf à enregistrer
        return {
          ...ing,
          history: [...hist, { date: today(), price: newPrice, supplierName: sup.name, supplierId: sup.id }].slice(-15),
        };
      })
    );
  };

  const openAddWizard = (returnToLineIdx = null, prefillName = "") => {
    setWizardData({ name: prefillName, catalogId: null, unit: "kg", category: "autres", price: 0 });
    setWizardQuery(prefillName);
    setWizardEditId(null);
    setWizardReturnToLineIdx(returnToLineIdx);
    setWizardStep(1);
    setAddWizardOpen(true);
  };
  const closeAddWizard = () => {
    setAddWizardOpen(false);
    setWizardReturnToLineIdx(null);
    setWizardStep(1);
    setWizardEditId(null);
  };
  // Catégorie déjà connue (celle du catalogue) : on saute directement au prix, pas besoin de la
  // redemander.
  const pickWizardCatalog = (c) => {
    setWizardData({ name: c[lang], catalogId: c.id, unit: normUnit(c.unit), category: c.cat, price: 0 });
    setWizardEditId(null);
    setWizardStep(3);
  };
  // Nom inédit, catégorie inconnue : on la demande avant le prix (étape 2) plutôt que de deviner.
  const pickWizardCustom = (name) => {
    setWizardData((d) => ({ ...d, name: name || t("newIngredient"), catalogId: null }));
    setWizardEditId(null);
    setWizardStep(2);
  };
  // Catégorie déjà connue (celle de l'ingrédient existant) : direct au prix.
  const pickWizardExisting = (ing) => {
    const sup = activeSupplier(ing);
    setWizardData({
      name: ingredientDisplayName(ing),
      catalogId: ing.catalogId,
      unit: ing.unit,
      category: ing.category || "autres",
      price: sup?.price || 0,
    });
    setWizardEditId(ing.id);
    setWizardStep(3);
  };
  const finalizeWizard = () => {
    const sId = uid();
    const ni = {
      id: uid(),
      name: wizardData.name || t("newIngredient"),
      unit: wizardData.unit,
      catalogId: wizardData.catalogId,
      category: wizardData.category,
      selectedSupplierId: sId,
      suppliers: [{ id: sId, name: t("supplier"), price: wizardData.price || 0, priceSource: !wizardData.isEstimate && wizardData.price > 0 ? "manual" : "estimate" }],
      history: [],
      lastUpdated: today(),
    };
    setIngredients((ings) => [...ings, ni]);
    if (wizardReturnToLineIdx !== null) changeLineIngredient(wizardReturnToLineIdx, ni.id);
    setWizardStep("success");
    setTimeout(() => closeAddWizard(), 1300);
  };
  const finalizeEditWizard = () => {
    setIngredients((ings) => ings.map((i) => {
      if (i.id !== wizardEditId) return i;
      const currentSup = i.suppliers.find((s) => s.id === i.selectedSupplierId) || i.suppliers[0];
      let suppliers, selectedSupplierId, history = i.history || [];
      if (currentSup) {
        if (wizardData.price !== currentSup.price) {
          history = [...history, { date: today(), price: wizardData.price, supplierName: currentSup.name, supplierId: currentSup.id }].slice(-15);
        }
        suppliers = i.suppliers.map((s) => (s.id === currentSup.id ? { ...s, price: wizardData.price, priceSource: wizardData.isEstimate ? "estimate" : "manual" } : s));
        selectedSupplierId = i.selectedSupplierId;
      } else {
        const sId = uid();
        suppliers = [{ id: sId, name: t("supplier"), price: wizardData.price, priceSource: wizardData.isEstimate ? "estimate" : "manual" }];
        selectedSupplierId = sId;
      }
      return { ...i, unit: wizardData.unit, suppliers, selectedSupplierId, history, lastUpdated: today() };
    }));
    if (wizardReturnToLineIdx !== null) changeLineIngredient(wizardReturnToLineIdx, wizardEditId);
    setWizardStep("success");
    setTimeout(() => closeAddWizard(), 1300);
  };

  const deleteIngredient = (id) => setIngredients((ings) => ings.filter((i) => i.id !== id));

  const toggleRecentSelection = (id) =>
    setSelectedRecentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const deleteSelectedRecentIngredients = () => {
    setIngredients((ings) => ings.filter((i) => !selectedRecentIds.has(i.id)));
    setSelectedRecentIds(new Set());
    setBulkDeleteConfirmOpen(false);
  };
  const addSupplier = (ingId) => {
    setIngredients((ings) => ings.map((i) => {
      if (i.id !== ingId) return i;
      const ns = { id: uid(), name: t("newSupplier"), price: activeSupplier(i)?.price || 1 };
      return { ...i, suppliers: [...i.suppliers, ns] };
    }));
  };
  // Même correctif que updateActiveSupplierPrice (2026-08-27) : ce champ prix est lui aussi
  // branché sur un `onChange` déclenché à chaque touche, il ne doit donc PLUS écrire l'historique
  // au fil de la frappe — sinon "1.70" laisse derrière lui une entrée 1 puis une entrée 1.7 et
  // fabrique une fausse hausse de +70%. L'enregistrement se fait à la fin de la saisie, via
  // commitSupplierPrice.
  const updateSupplier = (ingId, supId, field, value) => {
    setIngredients((ings) => ings.map((i) => {
      if (i.id !== ingId) return i;
      const suppliers = i.suppliers.map((s) => {
        if (s.id !== supId) return s;
        if (field === "price") return { ...s, price: value, priceSource: "manual" };
        return { ...s, [field]: value };
      });
      return { ...i, suppliers, lastUpdated: field === "price" ? today() : i.lastUpdated };
    }));
  };

  const commitSupplierPrice = (ingId, supId, newPrice) => {
    setIngredients((ings) => ings.map((i) => {
      if (i.id !== ingId || !(newPrice > 0)) return i;
      const sup = i.suppliers.find((s) => s.id === supId);
      if (!sup) return i;
      const hist = i.history || [];
      const mine = hist.filter((e) => (e.supplierId ? e.supplierId === supId : e.supplierName === sup.name));
      const last = mine[mine.length - 1];
      if (last && last.price === newPrice) return i;
      return { ...i, history: [...hist, { date: today(), price: newPrice, supplierName: sup.name, supplierId: supId }].slice(-15) };
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

  // Réinitialisation en 2 temps : confirmation dans une fenêtre du même style que le reste de
  // l'app (remplace window.confirm, une boîte de dialogue système jugée peu engageante par
  // l'utilisateur, 2026-08), puis exécution qui restaure directement les données de démo (au lieu
  // de tout vider) — avant ce correctif, tout disparaissait (y compris la recette exemple) et il
  // fallait rafraîchir la page à la main pour la revoir, ce qui donnait l'impression d'un bug.
  const clearAll = () => setResetConfirmOpen(true);
  const performReset = async () => {
    const freshRecipes = buildSeedRecipes(lang);
    setIngredients(SEED_INGREDIENTS);
    setRecipes(freshRecipes);
    setActiveId(freshRecipes[0].id);
    setSupplierMappings([]);
    setResetConfirmOpen(false);
    setShowSettings(false);
    try { await storage.delete("ingredients"); await storage.delete("recipes"); await storage.delete("supplierMappings"); } catch (e) {}
  };

  // Ouvre le portail client Stripe (gérer carte/annuler) — appel serveur, jamais de clé Stripe
  // exposée côté navigateur. Le token Supabase de la session prouve au serveur quel utilisateur
  // (donc quel client Stripe) est concerné.
  // Bouton unique "intelligent" : ouvre le portail Stripe (annuler, changer de carte) si un
  // abonnement existe déjà ; sinon (encore en essai, aucun client Stripe créé) ouvre directement
  // le paiement pour s'abonner tout de suite sans attendre la fin des 7 jours. Le serveur renvoie
  // un code "no_subscription" (pas juste un message) pour distinguer ce cas d'une vraie erreur.
  const manageSubscription = async () => {
    setPortalErr("");
    setPortalBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = { Authorization: `Bearer ${session.access_token}` };

      const portalRes = await fetch("/api/create-portal-session", { method: "POST", headers: authHeader });
      const portalData = await portalRes.json();
      if (portalRes.ok && portalData.url) {
        window.location.href = portalData.url;
        return;
      }
      if (portalData.code !== "no_subscription") throw new Error(portalData.error || "portal error");

      const checkoutRes = await fetch("/api/create-checkout-session", { method: "POST", headers: authHeader });
      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok || !checkoutData.url) throw new Error(checkoutData.error || "checkout error");
      window.location.href = checkoutData.url;
    } catch (e) {
      setPortalErr(t("billingPortalError"));
      setPortalBusy(false);
    }
  };

  // Pièce jointe optionnelle (ex: capture d'écran d'un bug) — réutilise la même compression que
  // les scanners (redimensionne, JPEG) pour ne jamais envoyer un fichier énorme par email.
  const handleContactAttachment = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setContactAttaching(true);
    try {
      const { base64, mediaType } = await compressImageFile(file);
      setContactAttachment({ base64, mediaType, fileName: file.name || "capture.jpg" });
    } catch (err) {
      setContactErr(t("contactError"));
    } finally {
      setContactAttaching(false);
    }
  };

  // Formulaire de contact/réclamation : l'adresse de réception vit uniquement côté serveur
  // (CONTACT_EMAIL), jamais transmise ni visible côté client — seul le message est envoyé.
  const sendContactMessage = async () => {
    if (!contactMessage.trim()) return;
    setContactErr(null);
    setContactSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ message: contactMessage.trim(), attachment: contactAttachment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "contact error");
      setContactSent(true);
      setContactMessage("");
      setContactAttachment(null);
    } catch (e) {
      setContactErr(t("contactError"));
    } finally {
      setContactSending(false);
    }
  };

  // Change la langue d'interface et, si LA recette de démo (r1) n'a jamais été touchée, met à jour
  // seulement ses notes/allergènes/nom dans la nouvelle langue (sinon ses instructions/allergène
  // resteraient dans l'ancienne langue, seul le reste de l'interface changerait — repéré en test
  // réel, 2026-08). Corrige au passage sa toute première version qui remplaçait TOUT le tableau
  // `recipes` par `buildSeedRecipes(newLang)` (un seul élément) — sans danger tant qu'il n'y avait
  // qu'une recette, mais aurait fait disparaître silencieusement les autres recettes de l'utilisateur
  // dès qu'il en aurait créé une deuxième (repéré avant déploiement, jamais arrivé en production).
  // Ne modifie jamais une recette réellement éditée par l'utilisateur, ni aucune autre recette.
  const changeLang = (newLang) => {
    setLang(newLang);
    setRecipes((rs) => {
      const idx = rs.findIndex((r) => r.id === "r1");
      if (idx === -1 || !isPristineSeedRecipe(rs[idx])) return rs;
      const seeded = buildSeedRecipes(newLang)[0];
      const next = [...rs];
      next[idx] = { ...rs[idx], name: seeded.name, notes: seeded.notes, allergens: seeded.allergens };
      return next;
    });
  };

  const handlePrint = () => window.print();
  const handlePrintRecipeSheet = () => {
    setHidePricesPrint(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setHidePricesPrint(false), 500);
    }, 50);
  };

  // --- Scan de facture ---

  const normalizeStr = (s) => normalizeDiacritics(s).replace(/[^a-z0-9]+/g, " ").trim();

  // Détecte un poids/volume mentionné dans un texte (ex: "Mozzarella 125g", "Huile 75CL")
  // — sert de filet de sécurité si l'IA a oublié de convertir elle-même l'unité.
  const extractWeightGrams = (name) => {
    if (!name) return null;
    const kgMatch = name.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
    if (kgMatch) return Math.round(parseFloat(kgMatch[1].replace(",", ".")) * 1000);
    const gMatch = name.match(/(\d+(?:[.,]\d+)?)\s*g(?:r|rs|rammes?)?\b/i);
    if (gMatch) return Math.round(parseFloat(gMatch[1].replace(",", ".")));
    return null;
  };
  const extractVolumeMl = (name) => {
    if (!name) return null;
    const lMatch = name.match(/(\d+(?:[.,]\d+)?)\s*l\b/i);
    if (lMatch) return Math.round(parseFloat(lMatch[1].replace(",", ".")) * 1000);
    const clMatch = name.match(/(\d+(?:[.,]\d+)?)\s*cl\b/i);
    if (clMatch) return Math.round(parseFloat(clMatch[1].replace(",", ".")) * 10);
    const mlMatch = name.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
    if (mlMatch) return Math.round(parseFloat(mlMatch[1].replace(",", ".")));
    return null;
  };

  // Si l'IA a laissé un produit en "pièce" alors qu'un poids/volume est visible dans le texte
  // brut du ticket, on corrige silencieusement — l'utilisateur ne voit jamais cette étape.
  const normalizeUnitAndPrice = (it) => {
    let unit = it.unit || "kg";
    let price = it.unitPriceHT || 0;
    if (unit === "pièce") {
      const source = it.rawLabel || it.name || "";
      const g = extractWeightGrams(source);
      if (g && g > 0) {
        return { unit: "kg", unitPriceHT: price / (g / 1000) };
      }
      const ml = extractVolumeMl(source);
      if (ml && ml > 0) {
        return { unit: "L", unitPriceHT: price / (ml / 1000) };
      }
    }
    return { unit, unitPriceHT: price };
  };

  // Compare mot par mot (plutôt qu'un match exact ou une simple sous-chaîne) et gère
  // le pluriel français basique ("oignons" ~ "oignon jaune"), avec un score de confiance.
  const tokenize = (s) =>
    normalizeStr(s)
      .split(" ")
      .filter(Boolean)
      .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));

  // Mots trop génériques pour prouver une correspondance à eux seuls (ex: "fraîche" apparaît
  // aussi bien dans "Herbes fraîches" que "Crème fraîche" — deux produits sans rapport).
  const GENERIC_TOKENS = new Set([
    "frais", "fraiche", "entier", "entiere", "doux", "jaune", "rouge", "blanc", "blanche",
    "vert", "verte", "sec", "seche", "fermier", "fermiere", "plein", "air", "cuisine",
    "gros", "grosse", "petit", "petite", "nature", "classique", "campagne", "fin", "fine",
    "noir", "noire",
    // mots de liaison, ne comptent jamais comme "mot significatif partagé"
    "de", "du", "la", "le", "les", "des", "un", "une", "et", "au", "aux", "avec", "sans", "pour",
  ]);
  const meaningfulTokens = (tokens) => {
    const filtered = tokens.filter((tk) => !GENERIC_TOKENS.has(tk));
    return filtered.length ? filtered : tokens;
  };

  // À l'inverse des GENERIC_TOKENS (mots sans importance), ceux-ci désignent une vraie
  // transformation qui change le produit réellement acheté (prix et usage différents) :
  // "cru" retiré volontairement de GENERIC_TOKENS ci-dessus, on ne mélange plus jamais
  // "Pomme de terre" et "Pomme de terre frite", ou "Emmental" et "Emmental râpé".
  const DISTINCTIVE_MODIFIERS = new Set([
    "rape", "rapee", "frit", "frite", "hache", "hachee", "tranche", "tranchee",
    "cru", "crue", "cuit", "cuite", "marine", "marinee", "fume", "fumee",
    "pane", "panee", "moulu", "moulue", "concasse", "concassee", "bloc",
    "desosse", "desossee", "confit", "confite",
  ]);

  // Distance de Levenshtein (nombre minimal d'ajout/suppression/substitution pour passer
  // d'un mot à l'autre) — sert à repérer une faute de frappe/OCR entre deux mots proches.
  const levenshtein = (a, b) => {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++) dp[j] = j;
    for (let i = 1; i <= m; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = dp[j];
        dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
        prev = tmp;
      }
    }
    return dp[n];
  };

  // Deux mots "se ressemblent" sans être identiques : soit une abréviation fournisseur
  // manifeste (préfixe commun assez long, ex: "mozza" / "mozzarella"), soit un écart d'1-2
  // lettres typique d'une faute de frappe ou d'une erreur de lecture OCR.
  const tokensSimilar = (a, b) => {
    const minLen = Math.min(a.length, b.length);
    if (minLen < 4) return false; // trop court pour être fiable (ex: "ail" / "aile")
    if (a.startsWith(b) || b.startsWith(a)) return true;
    // Au-delà d'une abréviation (préfixe commun), on n'accepte une faute de frappe/OCR que si
    // les deux mots commencent pareil : "haricot" et "abricot" ont une distance de Levenshtein
    // de seulement 2 (assez pour matcher un mot de 7 lettres) mais ce sont deux légumes/fruits
    // totalement différents dès la première lettre — un vrai cas trouvé en test réel. Une faute
    // OCR change rarement la toute première lettre d'un mot, donc l'exiger identique élimine ce
    // faux positif sans bloquer les vraies fautes de frappe (qui portent presque toujours sur une
    // lettre du milieu ou de la fin).
    if (a[0] !== b[0]) return false;
    const maxDist = a.length >= 7 || b.length >= 7 ? 2 : 1;
    return levenshtein(a, b) <= maxDist;
  };

  const guessIngredientId = (name) => {
    const tokensRaw = tokenize(name);
    const tokens = meaningfulTokens(tokensRaw);
    if (!tokens.length) return null;
    const scannedMods = new Set(tokensRaw.filter((tk) => DISTINCTIVE_MODIFIERS.has(tk)));
    let best = null;
    let bestScore = 0;
    let bestFuzzy = false;
    for (const ing of ingredients) {
      const iTokensRaw = tokenize(ingredientDisplayName(ing));
      const iTokens = meaningfulTokens(iTokensRaw);
      if (!iTokens.length) continue;

      // Un mot de transformation présent d'un seul côté (râpé vs en bloc, cru vs cuit, frite
      // vs nature...) signale un produit réellement différent à acheter : on exclut carrément
      // ce candidat plutôt que de risquer de fusionner deux achats différents.
      const candidateMods = new Set(iTokensRaw.filter((tk) => DISTINCTIVE_MODIFIERS.has(tk)));
      if (scannedMods.size || candidateMods.size) {
        const sameMods = scannedMods.size === candidateMods.size && [...scannedMods].every((m) => candidateMods.has(m));
        if (!sameMods) continue;
      }

      // Chaque mot de l'ingrédient existant ne peut servir qu'une seule fois, même s'il
      // ressemble à plusieurs mots scannés, pour ne pas gonfler artificiellement le score.
      const usedI = new Set();
      let shared = 0;
      let fuzzy = false;
      for (const tk of tokens) {
        let matchIdx = iTokens.findIndex((itk, idx) => !usedI.has(idx) && tk === itk);
        if (matchIdx === -1) {
          matchIdx = iTokens.findIndex((itk, idx) => !usedI.has(idx) && tokensSimilar(tk, itk));
          if (matchIdx !== -1) fuzzy = true;
        }
        if (matchIdx !== -1) {
          usedI.add(matchIdx);
          shared++;
        }
      }
      if (shared === 0) continue; // exige au moins un mot significatif commun, pas juste un adjectif
      // Score = mots partagés ÷ TOTAL de mots distincts des deux côtés (et non le plus petit),
      // pour qu'un nom très court (ex: "Romarin") ne gagne pas à tort une confiance à 100%
      // simplement parce qu'il ne contient qu'un seul mot qui matche un produit composé.
      const unionSize = tokens.length + iTokens.length - shared;
      const score = shared / unionSize;
      if (score > bestScore) {
        bestScore = score;
        best = ing;
        bestFuzzy = fuzzy;
      }
    }
    if (!best || bestScore < 0.5) return null;
    // Un match qui ne repose que sur une approximation (abréviation, faute de frappe) n'est
    // jamais "confiant" : il part toujours en vérification, jamais importé automatiquement.
    return { id: best.id, confident: bestScore >= 0.99 && !bestFuzzy };
  };

  // Même logique de rapprochement que guessIngredientId ci-dessus, mais contre le CATALOGUE de
  // référence (toujours comparé au nom source français) plutôt que contre le garde-manger de
  // l'utilisateur — pour qu'un ingrédient créé automatiquement depuis un scan hérite d'une vraie
  // catégorie et, si le rapprochement est fiable, d'un lien allergène (ALLERGEN_MAP), au lieu de
  // toujours tomber en "Autres" sans aucun lien allergène précis (trou réel repéré en test, 2026-08
  // : un garde-manger 100% scanné se retrouvait entièrement en "Autres"). Uniquement utilisée à
  // l'import scan — l'assistant de création manuelle demande désormais la catégorie explicitement
  // (voir wizardStep 2) plutôt que de deviner.
  // Contrairement à guessIngredientId (qui doit rester strict — deux produits différents ne
  // doivent jamais fusionner leurs prix), ici on ne cherche qu'une catégorie approximative, sans
  // risque réel en cas d'erreur. Bug réel trouvé en test (2026-08, garde-manger vidé) : un vrai
  // nom de facture porte presque toujours des mots en plus du terme générique du catalogue (%,
  // grade, marque, mode de préparation — ex: "Chocolat noir couverture 64%", "Œuf frais catégorie
  // A", "Saumon atlantique filet sans peau") ; l'ancien score (mots partagés / union des DEUX
  // côtés) était noyé par ces mots en plus et ne dépassait quasiment jamais le seuil, laissant la
  // quasi-totalité des imports réels tomber en "Autres" même quand le produit de base était
  // pourtant bien dans le catalogue. Le filtre DISTINCTIVE_MODIFIERS (qui empêche par exemple
  // "Emmental râpé" de matcher "Emmental" pour l'identité/le prix) est également écarté ici : une
  // transformation du produit ne change pas sa catégorie, seulement son prix.
  const guessCatalogEntry = (name) => {
    const tokens = meaningfulTokens(tokenize(name));
    if (!tokens.length) return null;
    let best = null;
    let bestCatScore = 0;
    let bestIdScore = 0;
    let bestFuzzy = false;
    for (const c of CATALOG) {
      const iTokens = meaningfulTokens(tokenize(c.fr));
      if (!iTokens.length) continue;
      const usedI = new Set();
      let shared = 0;
      let fuzzy = false;
      for (const tk of tokens) {
        let matchIdx = iTokens.findIndex((itk, idx) => !usedI.has(idx) && tk === itk);
        if (matchIdx === -1) {
          matchIdx = iTokens.findIndex((itk, idx) => !usedI.has(idx) && tokensSimilar(tk, itk));
          if (matchIdx !== -1) fuzzy = true;
        }
        if (matchIdx !== -1) {
          usedI.add(matchIdx);
          shared++;
        }
      }
      if (shared === 0) continue;
      // Score "catégorie" : quelle part des mots du catalogue est couverte, sans être pénalisé
      // par les mots supplémentaires côté facture (ils décrivent le produit, pas sa famille).
      const catScore = shared / iTokens.length;
      // Score "identité" (formule stricte d'origine) : sert uniquement à décider si on peut aussi
      // poser catalogId (donc ALLERGEN_MAP) en confiance — une phrase avec un mot en trop dessus
      // fait déjà chuter ce score loin sous 0.99, donc reste protégé même sans DISTINCTIVE_MODIFIERS.
      const idScore = shared / (tokens.length + iTokens.length - shared);
      if (catScore > bestCatScore) {
        bestCatScore = catScore;
        bestIdScore = idScore;
        best = c;
        bestFuzzy = fuzzy;
      }
    }
    if (!best || bestCatScore < 0.5) return null;
    // `unit` renvoyé aussi (2026-08-27) : le catalogue SAIT que le lait se compte en litres et la
    // viande en kilos. Ne pas s'en servir obligeait à retomber sur CATEGORY_DEFAULT_UNIT, une
    // approximation par catégorie qui donnait "Lait entier" en grammes (catégorie crémerie → kg).
    return { catalogId: best.id, category: best.cat, unit: normUnit(best.unit), confident: bestIdScore >= 0.99 && !bestFuzzy };
  };

  // Ingrédients tombés en "Autres" faute de rapprochement catalogue au moment de l'import scan
  // (ex: guessCatalogEntry n'avait rien trouvé à l'époque, ou l'ingrédient a été renommé depuis).
  // Recalculé à chaque rendu à partir de guessCatalogEntry — pas de nouvel état, juste une
  // relecture du garde-manger actuel.
  const uncategorizedIngredients = ingredients.filter(
    (i) => (i.category || "autres") === "autres" && guessCatalogEntry(ingredientSourceName(i))
  );

  // Reclasse en un clic tout ce qui peut l'être : ne touche jamais un ingrédient déjà catégorisé
  // (même à tort — l'utilisateur doit corriger ça lui-même à la main pour ne pas écraser un choix
  // volontaire), et ne pose catalogId (donc le lien allergène ALLERGEN_MAP) que si le rapprochement
  // est confiant, comme à l'import scan normal.
  const reclassifyUncategorized = () => {
    setIngredients((ings) =>
      ings.map((i) => {
        if ((i.category || "autres") !== "autres") return i;
        const guess = guessCatalogEntry(ingredientSourceName(i));
        if (!guess) return i;
        return { ...i, category: guess.category, catalogId: guess.confident ? guess.catalogId : i.catalogId };
      })
    );
  };

  // Mémoire des rapprochements déjà validés par l'utilisateur lors d'un scan précédent :
  // si ce texte brut de facture a déjà été relié à un ingrédient, on lui fait confiance
  // directement, sans repasser par le score de similarité ni la vérification manuelle.
  // [BUG confirmé et corrigé, 2026-08-26] La mémoire des rapprochements était morte depuis que le
  // prompt exige que `rawLabel` recolle TOUTES les colonnes de la ligne (2026-07-31) : la clé
  // contenait donc la quantité et les prix de CETTE facture-là, qui changent forcément d'un mois
  // sur l'autre. Mesuré au banc de test sur 3 produits identiques à deux factures d'écart : 0/3
  // clés retrouvées. Conséquence concrète : chaque nouvelle facture reposait au chef exactement les
  // mêmes questions de rapprochement qu'il avait déjà validées le mois d'avant — c'est la source
  // principale des "alertes de vérification pas nécessaires" qu'il a signalées.
  //
  // On mémorise désormais TROIS clés pour un même import, essayées de la plus précise à la plus
  // large : le texte brut exact (comme avant, retrouve une ligne strictement identique), le texte
  // brut débarrassé des nombres isolés (survit à un changement de quantité/prix : "entrecote vbf
  // 4 12 kg 16 00 65 92" devient "entrecote vbf kg"), et le nom nettoyé par l'IA (retrouve le
  // produit même si le fournisseur change sa mise en page). Les chiffres collés à une unité
  // ("1kg", "75cl", "100g") ne sont jamais retirés : ils font partie de l'identité du produit.
  const rawMappingKey = (rawLabel) => normalizeStr(lightRawLabel(rawLabel));

  const stableMappingKey = (rawLabel) => {
    const words = rawMappingKey(rawLabel)
      .split(" ")
      .filter((w) => w && !/^\d+$/.test(w));
    const key = words.join(" ");
    // Garde-fou anti-collision : une clé trop courte (un ou deux mots génériques) pourrait
    // rapprocher à tort deux produits différents, et ce rapprochement serait marqué "confiant"
    // donc importé sans vérification. On préfère ne rien mémoriser dans ce cas.
    return words.length >= 2 && key.length >= 8 ? key : null;
  };

  const nameMappingKey = (name) => {
    const key = normalizeStr(name);
    return key && key.length >= 4 ? `name:${key}` : null;
  };

  const findMappedIngredientId = (rawLabel, name) => {
    const keys = [rawMappingKey(rawLabel), stableMappingKey(rawLabel), nameMappingKey(name)].filter(Boolean);
    for (const key of keys) {
      const found = supplierMappings.find((m) => m.key === key);
      // L'ingrédient appris a pu être supprimé depuis : dans ce cas on ignore cette association
      // et on continue avec les clés suivantes.
      if (found && ingredients.some((i) => i.id === found.ingredientId)) return found.ingredientId;
    }
    return null;
  };

  const rememberSupplierMapping = (rawLabel, name, ingredientId) => {
    if (!ingredientId) return;
    const keys = [rawMappingKey(rawLabel), stableMappingKey(rawLabel), nameMappingKey(name)].filter(Boolean);
    if (!keys.length) return;
    setSupplierMappings((maps) => [
      ...maps.filter((m) => !keys.includes(m.key)),
      ...keys.map((key) => ({ key, rawLabel, ingredientId, updatedAt: today() })),
    ]);
  };

  // Redimensionne ET compresse une photo avant envoi à l'IA. Passe par createImageBitmap avec
  // imageOrientation: "from-image" plutôt que new Image()+canvas classique : un `<img>` respecte
  // automatiquement le drapeau de rotation EXIF d'une photo de téléphone, mais canvas.drawImage()
  // NE LE FAIT PAS — il dessine la grille de pixels brute du capteur, ignorant le drapeau qui dit
  // "affiche ceci tourné". Une fois réexportée via toDataURL, l'image perd tout EXIF : la mauvaise
  // orientation est alors gravée en dur, sans aucun moyen de la corriger plus tard en aval. Bug réel
  // trouvé en test (2026-08) : une vraie facture prise en photo sur iPhone repartait pivotée à 90°
  // vers l'IA — repéré grâce à l'aperçu de diagnostic ajouté ce jour-là, qui montrait l'image
  // exactement telle qu'envoyée (donc déjà tournée, puisque réencodée à partir du canvas). Un
  // tableau dense et tourné est nettement plus dur à lire correctement pour un modèle de vision
  // qu'un tableau droit, même si un humain peut toujours pencher la tête pour compenser.
  const compressImageFile = async (file) => {
    // 2576px (2026-08-25, remonté de 1568px) : plafond du palier "High-resolution" de Sonnet 5
    // (voir api/scan-invoice.js, choix de modèle) — confirmé sur la doc officielle Anthropic. Ce
    // chiffre doit rester synchronisé avec le modèle utilisé côté serveur : redescendre à 1568px
    // si jamais le scanner de factures revient un jour sur un modèle "Standard" (Haiku), sinon on
    // envoie inutilement plus de données pour un modèle qui les redécoupera de toute façon.
    const maxDim = 2576;
    const drawToCanvas = (source, width, height) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(source, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1] || "";
      // Certains navigateurs mobiles renvoient "data:," (chaîne vide) quand la conversion échoue,
      // au lieu de lever une erreur. Sans ce garde-fou on envoyait une image vide au serveur, qui
      // répondait "document non reçu" — un message trompeur pour un problème d'image en réalité.
      if (base64.length < 100) throw new Error("image_encode_failed");
      return { base64, mediaType: "image/jpeg" };
    };
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      let { width, height } = bitmap;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const result = drawToCanvas(bitmap, width, height);
      bitmap.close();
      return result;
    } catch (e) {
      // Repli sur l'ancien chemin si createImageBitmap échoue/n'existe pas sur ce navigateur —
      // perd la correction d'orientation dans ce cas précis, mais ne bloque jamais un scan.
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error("Image illisible"));
          img.onload = () => {
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              const scale = maxDim / Math.max(width, height);
              width = Math.round(width * scale);
              height = Math.round(height * scale);
            }
            // try/catch obligatoire : une exception levée ici (dans un gestionnaire d'événement)
            // ne rejetterait PAS la promesse — elle la laisserait en attente pour toujours, et le
            // scan resterait bloqué sur "Analyse en cours…" sans jamais afficher d'erreur.
            try {
              resolve(drawToCanvas(img, width, height));
            } catch (err) {
              reject(err);
            }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Pivote manuellement une image déjà compressée (base64), pour le cas où l'EXIF ne suffit pas à
  // remettre une photo droite (métadonnée perdue/altérée en transitant par une appli de
  // messagerie avant d'arriver dans Chefup — voir `scanPendingImage`).
  const rotateImageBase64 = (base64, mediaType, degrees) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image illisible"));
      img.onload = () => {
        // try/catch : une exception dans ce gestionnaire d'événement ne rejetterait pas la
        // promesse, elle la laisserait en attente indéfiniment (bouton pivoter sans effet visible).
        try {
          const swap = ((degrees % 180) + 180) % 180 !== 0;
          const canvas = document.createElement("canvas");
          canvas.width = swap ? img.height : img.width;
          canvas.height = swap ? img.width : img.height;
          const ctx = canvas.getContext("2d");
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((degrees * Math.PI) / 180);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          const rotated = dataUrl.split(",")[1] || "";
          if (rotated.length < 100) throw new Error("image_encode_failed");
          resolve({ base64: rotated, mediaType: "image/jpeg" });
        } catch (err) {
          reject(err);
        }
      };
      img.src = `data:${mediaType};base64,${base64}`;
    });

  // Convertit un ArrayBuffer en base64 par blocs (2026-08-25) : `btoa(String.fromCharCode(...bytes))`
  // avec l'opérateur spread peut dépasser la limite d'arguments d'une fonction sur un gros fichier
  // (des dizaines de milliers d'octets d'un coup) — motif classique et sûr pour éviter ça.
  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  };

  // Plafond de taille avant envoi : Vercel refuse tout net une requête au-delà de 4,5 Mo (limite
  // fixe de la plateforme, non modifiable — vérifié sur la doc officielle le 2026-08-25), et le
  // base64 gonfle la taille réelle d'environ 33%. 3 Mo de PDF brut → environ 4 Mo encodé, en
  // laissant de la marge pour le reste du JSON envoyé — largement suffisant pour une facture de
  // plusieurs pages (les factures réelles testées jusqu'ici pesaient quelques centaines de Ko).
  const MAX_PDF_BYTES = 3 * 1024 * 1024;

  // Lit un PDF (2026-08-25, réécrit en profondeur) : envoie désormais le fichier BRUT à Claude, qui
  // sait lire un PDF nativement (texte ET pages scannées, jusqu'à 600 pages) — plus aucun parsing
  // ni rendu de PDF dans le navigateur. Remplace l'ancienne approche (pdfjs-dist, lecture de texte
  // ou rendu de la première page en image) qui reposait sur un vrai bug non résolu de cette
  // bibliothèque sur certaines anciennes versions d'iOS/Safari — deux tentatives de correctif côté
  // client ont échoué le même soir (voir l'historique de ce fichier) avant qu'on réalise qu'il
  // valait mieux éliminer le problème à la racine plutôt que continuer à le contourner. Bénéfice
  // supplémentaire, pas juste un contournement : un PDF scanné multi-pages n'était auparavant lu
  // que sur sa première page (limite de l'ancien pipeline) ; Claude peut désormais lire le document
  // dans son ensemble. Elle ne dépend donc plus du tout d'`isIOSDevice` — un PDF se comporte
  // maintenant EXACTEMENT pareil sur n'importe quel appareil.
  const readPdfFile = async (file) => {
    if (file.size > MAX_PDF_BYTES) {
      const err = new Error("pdf_too_big");
      err.code = "file_too_big";
      throw err;
    }
    const arrayBuffer = await file.arrayBuffer();
    return { pdfBase64: arrayBufferToBase64(arrayBuffer) };
  };

  // OCR indépendant (moteur classique, pas une IA) fait en plus de la lecture par l'IA de vision :
  // les deux se trompent rarement sur le même chiffre de la même façon, donc lui donner cette
  // transcription en indice supplémentaire l'aide à se corriger elle-même (ex: virgule ratée,
  // ligne voisine confondue). Best-effort et jamais bloquant : si l'OCR échoue ou n'est pas
  // disponible, le scan continue normalement sans lui. Import dynamique pour la même raison que
  // pdfjs-dist ci-dessus (grosse librairie, chargée seulement au moment de scanner une photo).
  // ⚠️ Deux garde-fous ajoutés le 2026-08-24 après audit, tous deux liés à des scans qui restaient
  // bloqués sur "Analyse en cours…" sans jamais aboutir :
  // 1. UNE SEULE langue chargée (celle de l'interface) au lieu de "fra+spa+eng". tesseract.js
  //    télécharge son moteur WebAssembly ET un fichier de données par langue depuis un CDN externe
  //    au premier scan : trois langues, c'est trois fois plus de mégaoctets à télécharger avant
  //    même que l'analyse commence — sur la connexion mobile d'une cuisine, c'est très long. L'OCR
  //    n'est qu'un INDICE donné à l'IA en plus de l'image, pas la lecture principale : lire une
  //    facture française avec le seul modèle français ne dégrade rien.
  // 2. Délai maximum : si le CDN est lent, bloqué (réseau d'entreprise, bloqueur de pub) ou
  //    injoignable, l'attente pouvait durer indéfiniment sans qu'aucune erreur ne soit levée. On
  //    abandonne désormais l'OCR au bout de OCR_TIMEOUT_MS et le scan continue sans lui.
  const OCR_TIMEOUT_MS = 20000;
  const OCR_LANG = { fr: "fra", es: "spa", en: "eng" };
  const runOcr = async (base64) => {
    let worker = null;
    try {
      // .catch() attaché tout de suite : si l'OCR échoue APRÈS que le délai a déjà expiré, la
      // promesse rejetée n'a plus personne pour l'attendre et provoquerait une erreur non gérée.
      const ocrPromise = (async () => {
        const { createWorker } = await import("tesseract.js");
        worker = await createWorker(OCR_LANG[lang] || "fra");
        const { data } = await worker.recognize(`data:image/jpeg;base64,${base64}`);
        return (data.text || "").trim();
      })().catch(() => "");
      const text = await Promise.race([
        ocrPromise,
        new Promise((resolve) => setTimeout(() => resolve(null), OCR_TIMEOUT_MS)),
      ]);
      return text || "";
    } catch (e) {
      return "";
    } finally {
      // Toujours libérer le worker, y compris quand le délai a expiré pendant qu'il travaillait
      // encore — sinon il continue à tourner en arrière-plan et à consommer la batterie.
      try { await worker?.terminate(); } catch (e) {}
    }
  };

  // Filet de sécurité déterministe : quand un poids/volume est identifiable noir sur blanc dans
  // le texte brut de la ligne, on le recalcule nous-mêmes plutôt que de faire confiance à
  // l'arithmétique de l'IA. Des tests réels sur 15 factures reproduites ont montré que l'IA se
  // trompe régulièrement sur deux cas précis : le calcul d'un multipack "NxVOLUME" (ex:
  // "Carton 6x75cl" → l'IA a renvoyé 6 ou 0.75 au lieu de 4.5 dans plusieurs tests) et la
  // conversion grammes→kg (ex: "Bloc 500g" → l'IA a renvoyé 500 avec l'unité "kg" au lieu de 0.5,
  // soit une erreur de prix x1000). Une campagne de tests "extrêmes" (2026-07-31, factures
  // dégradées/multi-colonnes) a montré un troisième cas du même type : le multipack en grammes
  // "Nxg" (ex: "12x125g" → doit donner 1,5kg, pas 125g ni 12). Test réel du 2026-08 : le même
  // calcul peut aussi apparaître dans l'ordre INVERSE, quantité puis compte (ex: "BURRATA 100G X8"
  // = 8x100g, PAS 100g seul) — l'IA avait renvoyé 100g, donnant un prix ×8 trop élevé (118€/kg au
  // lieu de ~14,75€/kg), sans lever la moindre alerte. Ce filet ne s'applique qu'aux contenus en kg
  // ou L, jamais "pièce" — un motif reconnu écrase toujours la valeur de l'IA (plus fiable qu'elle
  // sur ces cas précis d'après les tests), sinon on garde sa valeur telle quelle.
  // IMPORTANT : ce filet dépend entièrement de `rawLabel` contenant bien le texte de conditionnement
  // (voir prompt `api/scan-invoice.js`, champ rawLabel) — si l'IA ne recopie que la colonne
  // désignation sans la colonne format/conditionnement, ce filet ne peut rien détecter.
  // [BUG confirmé et corrigé, 2026-08-26] Un motif "1L X12" ne veut PAS toujours dire "un colis
  // qui contient 12 fois 1L" : très souvent c'est "12 briques de 1L achetées", donc 12 est le
  // NOMBRE DE PIÈCES ACHETÉES (packageCount), pas un multiplicateur de conditionnement. Le filet
  // écrasait alors la bonne valeur de l'IA (1L) par 12L, divisant le prix final par 12 EN SILENCE
  // (trouvé au banc de test : "CREME LIQUIDE BRIQUE 1L X12" à 2,10€/pièce importée à 0,175€/L).
  // Discriminant fiable : quand le multiplicateur lu dans le texte est EXACTEMENT le packageCount
  // renvoyé par l'IA, c'est un nombre de pièces achetées, pas un multipack — on rend alors la main
  // à l'IA (qui, elle, a vu la mise en page complète et applique la règle du prompt sur ce cas
  // précis). Quand les deux nombres diffèrent (ex: "BURRATA 100G X8" avec 3 colis achetés), c'est
  // bien un multipack et le filet garde la priorité comme avant.
  const isPurchaseCountNotMultipack = (count, opts) =>
    !!opts &&
    opts.packageCount > 0 &&
    opts.aiContent > 0 &&
    Math.abs(count - opts.packageCount) < 0.001;

  const extractDeterministicContent = (text, contentUnit, opts) => {
    if (!text || (contentUnit !== "kg" && contentUnit !== "L")) return null;
    if (contentUnit === "L") {
      const multipack = text.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cl|ml|l)\b/i);
      if (multipack) {
        const count = parseInt(multipack[1], 10);
        if (isPurchaseCountNotMultipack(count, opts)) return null;
        const size = parseFloat(multipack[2].replace(",", "."));
        const u = multipack[3].toLowerCase();
        const perUnitL = u === "cl" ? size / 100 : u === "ml" ? size / 1000 : size;
        return Math.round(count * perUnitL * 1000) / 1000;
      }
      // Même calcul, ordre inversé "VOLUME x COMPTE" (ex: "75CL X6" au lieu de "6x75cl").
      const multipackRev = text.match(/(\d+(?:[.,]\d+)?)\s*(cl|ml|l)\s*[x×]\s*(\d+)\b/i);
      if (multipackRev) {
        const size = parseFloat(multipackRev[1].replace(",", "."));
        const u = multipackRev[2].toLowerCase();
        const count = parseInt(multipackRev[3], 10);
        if (isPurchaseCountNotMultipack(count, opts)) return null;
        const perUnitL = u === "cl" ? size / 100 : u === "ml" ? size / 1000 : size;
        return Math.round(count * perUnitL * 1000) / 1000;
      }
      const lMatch = text.match(/(\d+(?:[.,]\d+)?)\s*l\b/i);
      if (lMatch) return parseFloat(lMatch[1].replace(",", "."));
      const clMatch = text.match(/(\d+(?:[.,]\d+)?)\s*cl\b/i);
      if (clMatch) return Math.round(parseFloat(clMatch[1].replace(",", ".")) * 10) / 1000;
      const mlMatch = text.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
      if (mlMatch) return parseFloat(mlMatch[1].replace(",", ".")) / 1000;
    }
    if (contentUnit === "kg") {
      const multipackG = text.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*g(?:r|rs|rammes?)?\b/i);
      if (multipackG) {
        const count = parseInt(multipackG[1], 10);
        const sizeG = parseFloat(multipackG[2].replace(",", "."));
        if (isPurchaseCountNotMultipack(count, opts)) return null;
        return Math.round(count * sizeG) / 1000;
      }
      // Même calcul, ordre inversé "GRAMMAGE x COMPTE" (ex: "100G X8" = 8x100g, cas réel Burrata
      // du 2026-08 où l'IA n'avait lu que "100g" en ignorant le "X8").
      const multipackGRev = text.match(/(\d+(?:[.,]\d+)?)\s*g(?:r|rs|rammes?)?\s*[x×]\s*(\d+)\b/i);
      if (multipackGRev) {
        const sizeG = parseFloat(multipackGRev[1].replace(",", "."));
        const count = parseInt(multipackGRev[2], 10);
        if (isPurchaseCountNotMultipack(count, opts)) return null;
        return Math.round(count * sizeG) / 1000;
      }
      // Même calcul, multipack directement en kg (ex: "4x2.5kg" = 10kg, cas réel "PDT FRITE
      // 4X2.5KG" du 2026-08 où seul "2.5kg" avait été lu, ignorant le "4x" — prix importé x4 trop
      // élevé sans alerte). Angle mort qui existait déjà avant les 2 filets grammes/volume
      // ci-dessus, jamais couvert pour le kg directement. Les deux sens, comme pour les grammes.
      const multipackKg = text.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*kg\b/i);
      if (multipackKg) {
        const count = parseInt(multipackKg[1], 10);
        const sizeKg = parseFloat(multipackKg[2].replace(",", "."));
        if (isPurchaseCountNotMultipack(count, opts)) return null;
        return Math.round(count * sizeKg * 1000) / 1000;
      }
      const multipackKgRev = text.match(/(\d+(?:[.,]\d+)?)\s*kg\s*[x×]\s*(\d+)\b/i);
      if (multipackKgRev) {
        const sizeKg = parseFloat(multipackKgRev[1].replace(",", "."));
        const count = parseInt(multipackKgRev[2], 10);
        if (isPurchaseCountNotMultipack(count, opts)) return null;
        return Math.round(sizeKg * count * 1000) / 1000;
      }
      const kgMatch = text.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
      if (kgMatch) return parseFloat(kgMatch[1].replace(",", "."));
      const gMatch = text.match(/(\d+(?:[.,]\d+)?)\s*g(?:r|rs|rammes?)?\b/i);
      if (gMatch) return Math.round(parseFloat(gMatch[1].replace(",", "."))) / 1000;
    }
    return null;
  };

  // Calcule le prix final au kg/L/pièce à partir de : combien de colis achetés,
  // ce que contient UN colis, et le prix tel qu'imprimé (déjà au kg/L, ou par colis entier).
  // Rien de tout ça n'est deviné par l'IA seule : c'est un calcul déterministe, vérifiable.
  const computeItemPricing = (it) => {
    // Repli sur l'ancien format si jamais l'IA ne renvoie pas les nouveaux champs.
    if (it.packageContent === undefined || it.printedPriceUnit === undefined) {
      const legacy = normalizeUnitAndPrice(it);
      return { finalUnit: legacy.unit, finalUnitPrice: legacy.unitPriceHT, priceInconsistent: false, expectedTotal: null, pricingUnknown: false };
    }

    const packageContentUnit = it.packageContentUnit || "pièce";
    const packageCount = it.packageCount && it.packageCount > 0 ? it.packageCount : 1;
    const deterministicContent = extractDeterministicContent(it.rawLabel || it.name || "", packageContentUnit, {
      packageCount: it.packageCount,
      aiContent: it.packageContent,
    });

    // Piège "N PCE sans poids" pour un produit weighable (ex: "Noix de Saint-Jacques — 3 PCE —
    // 27,00€" sans aucun poids indiqué) : des tests réels ont montré que l'IA recopie parfois
    // packageCount dans packageContent avec packageContentUnit "pièce", comme si "3 pièces
    // achetées" voulait dire "chaque pièce contient 3" — un contenu inventé, pas lu. Détecté
    // quand les deux nombres sont identiques ET qu'aucune unité de poids/volume (kg/g/L/cl)
    // n'apparaît nulle part dans le texte brut : dans ce cas précis on retombe sur "inconnu",
    // exactement comme un colis sans poids indiqué.
    const hasRealWeightText = /\d+(?:[.,]\d+)?\s*(kg|gr?|grammes?|l|cl|ml)\b/i.test(it.rawLabel || it.name || "");
    const suspiciousPieceCount =
      it.weighable === true &&
      packageContentUnit === "pièce" &&
      it.packageContent != null &&
      it.packageCount != null &&
      Math.abs(it.packageContent - it.packageCount) < 0.001 &&
      !hasRealWeightText;
    const rawPackageContent = suspiciousPieceCount ? null : it.packageContent;

    const packageContent = deterministicContent || (rawPackageContent && rawPackageContent > 0 ? rawPackageContent : 1);
    const printedPrice = it.printedUnitPriceHT || 0;
    const printedUnit = it.printedPriceUnit || "colis";

    let finalUnit;
    let finalUnitPrice;
    // Déclaré ici (avant la branche kg/L) car `priceInconsistent` lui-même n'est déclaré que plus
    // bas dans cette fonction, pour le contrôle de la branche "colis" — les deux se combinent à la
    // fin. Sans cette variable intermédiaire, une affectation dans la branche kg/L se ferait sur
    // une variable pas encore déclarée (erreur) et serait de toute façon écrasée par la
    // déclaration plus bas.
    let kgLPriceMismatch = false;
    if (printedUnit === "kg" || printedUnit === "L") {
      // Le prix imprimé est déjà un prix au kilo/litre selon l'IA. Recoupement systématique quand
      // on a une contenance fiable trouvée nous-mêmes dans le texte (ex: "75 CL" dans le titre) :
      // cas réel (2026-08) où un vin à 3,11€/bouteille de 75cl est ressorti tel quel comme
      // "3,11€/L" au lieu de 4,15€/L — l'IA confond parfois "une contenance est mentionnée dans le
      // titre" avec "le prix affiché est déjà normalisé au litre/kilo". Sans ce recoupement, rien
      // ne détectait l'erreur : le garde-fou priceInconsistent plus bas est justement désactivé
      // pour cette branche (packageContent n'entre normalement pour rien dans un prix déjà au
      // kg/L). On recoupe donc ici avec la quantité déduite du total imprimé.
      if (deterministicContent && printedPrice > 0 && it.totalPriceHT > 0) {
        // [REFONTE 2026-08-26] L'ancien contrôle comparait le total imprimé à deux hypothèses
        // construites à partir de packageCount — un champ que l'IA remplit de façon peu fiable
        // sur les lignes vendues au poids (elle y met souvent le POIDS de la colonne quantité, pas
        // un nombre de colis). Deux conséquences mesurées au banc de test : (1) fausse alerte
        // systématique sur les lignes "N pièces + poids total" (ex: "FILET POULET 3 PCE 2,5 KG à
        // 9,80/kg", "POULET ENTIER 6 PCE 9,84 KG") pourtant parfaitement calculées — cas très
        // fréquent en boucherie/marée ; (2) pire, une "correction" appliquée à tort quand le poids
        // se retrouvait aussi dans packageCount, divisant le prix par le poids EN SILENCE
        // ("ENTRECOTE 4,12 KG à 16,00€/kg" importée à 3,88€/kg).
        //
        // Nouveau raisonnement, bien plus robuste : quand un prix est réellement au kg/L, la
        // QUANTITÉ TOTALE de la ligne se déduit directement de deux chiffres indépendants et
        // fiables (total ÷ prix unitaire), sans jamais passer par packageCount. On la compare
        // ensuite aux lectures possibles du texte.
        const impliedQty = it.totalPriceHT / printedPrice;
        const close = (a, b) => a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) <= 0.05;
        const contentEqualsCount = Math.abs(deterministicContent - packageCount) < 0.001;
        if (close(impliedQty, deterministicContent) || (!contentEqualsCount && close(impliedQty, packageCount * deterministicContent))) {
          // La quantité déduite correspond au poids/volume lu sur la ligne (seul, ou multiplié par
          // le nombre de colis) : le prix imprimé est bien un prix au kg/L, rien à corriger.
          // `contentEqualsCount` neutralise l'hypothèse "N colis de C" quand les deux nombres sont
          // en réalité le même chiffre lu deux fois (double comptage), sinon elle valide n'importe
          // quoi — c'est ce qui masquait le cas "l'IA divise deux fois" ci-dessous.
          finalUnit = printedUnit;
          finalUnitPrice = printedPrice;
        } else if (close(impliedQty, packageCount) && !contentEqualsCount) {
          // La quantité déduite correspond au NOMBRE de pièces achetées, pas à un poids : le prix
          // imprimé est en fait un prix par pièce/bouteille mal classé par l'IA (cas réel du vin
          // Château Virant, 3,11€/bouteille de 75cl ressorti tel quel en 3,11€/L). On le ramène
          // nous-mêmes au litre/kilo via la contenance lue dans le texte.
          finalUnit = printedUnit;
          finalUnitPrice = Math.round((printedPrice / deterministicContent) * 10000) / 10000;
        } else {
          // [BUG confirmé, 2026-08-25] Aucune lecture plausible ne colle : la quantité déduite du
          // total ne correspond ni au poids lu, ni au nombre de pièces. C'est exactement la
          // signature du cas où l'IA a recalculé elle-même le prix unitaire en divisant une
          // deuxième fois de trop ("BŒUF 5 KG à 16,00€/kg = 80,00€" renvoyé à 3,20€/kg) — un prix
          // divisé par 5 qui passait auparavant sans la moindre alerte. On garde le prix imprimé
          // mais on force une vérification humaine plutôt que d'importer un chiffre invérifiable.
          finalUnit = printedUnit;
          finalUnitPrice = printedPrice;
          kgLPriceMismatch = true;
        }
      } else {
        finalUnit = printedUnit;
        finalUnitPrice = printedPrice;
      }
    } else {
      // Le prix imprimé est celui d'un colis entier : on le ramène au kg/L/pièce via son contenu.
      // Arrondi à 4 décimales : une division comme 11.80/3 donne un flottant JS avec une quinzaine
      // de décimales (ex: 0.33749999999999997), qui a l'air cassé une fois affiché à l'utilisateur
      // — bug réel trouvé en test (2026-08). Le calcul lui-même n'a jamais été faux, seul l'arrondi
      // manquait.
      finalUnit = packageContentUnit === "kg" || packageContentUnit === "L" ? packageContentUnit : "pièce";
      finalUnitPrice = Math.round((printedPrice / packageContent) * 10000) / 10000;
    }

    // Prix par pièce/colis pour un produit dont le contenu (poids/volume réel) est inconnu —
    // impossible de calculer un vrai prix au kilo fiable, mieux vaut le dire clairement plutôt que
    // d'inventer un chiffre. Ne dépend plus de "weighable" (des tests réels ont montré ce champ
    // IA peu fiable, ex: sachet de Saint-Jacques ou plaquette de beurre parfois classés à tort
    // "weighable: false" alors que leur contenance varie bel et bien) : un contenu manquant est
    // toujours suspect, quel que soit le type de produit. `deterministicContent` prime toujours :
    // si notre filet de sécurité a lui-même trouvé le poids/volume dans le texte, ce n'est plus
    // une inconnue même si l'IA, elle, ne l'a pas vu.
    const pricingUnknown = printedUnit !== "kg" && printedUnit !== "L" && !deterministicContent && !rawPackageContent;

    // Ce contrôle ne vérifie quelque chose d'utile que lorsque packageContent sert réellement à
    // calculer finalUnitPrice (branche "colis" ci-dessus). Quand le prix est déjà donné
    // directement au kg/L, packageContent n'entre pour rien dans le prix importé — un écart à ce
    // stade ne signale qu'un champ non-utilisé mal lu (virgule ratée dans une quantité, confusion
    // avec une ligne voisine dense), pas une vraie incohérence de prix. Deux faux positifs réels
    // (2026-08, "4,12 KG" lu "412 KG", et une contamination par une ligne voisine) ont montré que
    // ça fait vérifier l'utilisateur pour rien alors que le prix importé était déjà correct.
    const pricingDependsOnPackageContent = printedUnit !== "kg" && printedUnit !== "L";
    const printedTotal = it.totalPriceHT || 0;
    // Certaines factures ont DEUX colonnes de comptage distinctes (ex: "Colis" ET "Quantité"
    // séparées — cas réel du vin 2026-08 : 2 colis de 6 bouteilles de 75cl = 12 bouteilles, prix
    // imprimé au format bouteille). L'IA peut alors renvoyer packageCount = nombre de colis (2)
    // au lieu du vrai multiplicateur de prix (12), ce qui fait échouer ce contrôle même quand le
    // prix final importé est déjà correct (packageContent s'annule de toute façon dans le calcul
    // ci-dessous dès que le prix imprimé est "par pièce"). printedUnitPriceHT et totalPriceHT
    // sont deux nombres indépendants lus sur la même cellule, généralement plus fiables qu'un
    // choix entre deux colonnes de comptage ambiguës : quand leur ratio ne colle pas du tout à
    // packageCount, on lui fait confiance à la place plutôt que de déclencher une fausse alerte.
    const impliedCount = printedPrice > 0 && printedTotal > 0 ? printedTotal / printedPrice : 0;
    const countForCheck =
      impliedCount >= 0.5 && Math.abs(impliedCount - packageCount) / Math.max(impliedCount, packageCount) > 0.05
        ? impliedCount
        : packageCount;
    const expectedTotal = countForCheck * packageContent * finalUnitPrice;
    // Combine les deux garde-fous : celui de la branche "colis" (packageContent réellement utilisé
    // pour calculer le prix) et celui de la branche "déjà au kg/L" ci-dessus (kgLPriceMismatch).
    let priceInconsistent = kgLPriceMismatch;
    if (pricingDependsOnPackageContent && !pricingUnknown && printedTotal > 0 && expectedTotal > 0) {
      const diff = Math.abs(expectedTotal - printedTotal) / Math.max(printedTotal, 0.01);
      if (diff > 0.15) priceInconsistent = true;
    }

    return { finalUnit, finalUnitPrice, priceInconsistent, expectedTotal, pricingUnknown };
  };

  // Photo (pas PDF) : compresse, affiche l'aperçu, et ATTEND une confirmation explicite avant
  // d'envoyer à l'IA — laisse une chance de pivoter la photo si elle ressort de travers (voir
  // `scanPendingImage`). Le chemin PDF (texte natif ou page rendue en image) reste automatique
  // comme avant : un PDF n'a pas ce problème de rotation de photo.
  const handleScanFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier plus tard
    if (!file) return;
    setScanOpen(true);
    setScanErr(null);
    setScanResult(null);
    setScanImagePreview(null);
    setScanPendingImage(null);
    // Oublier la photo du scan précédent : sinon "Réessayer avec la même photo" renverrait l'image
    // d'avant si le nouveau document (un PDF par exemple) échoue dès l'ouverture du fichier.
    setLastScanImage(null);
    setReviewStackOpen(false);
    setExpandedReviewIdx(null);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    setLastScanSource(isPdf ? "file" : e.target === fileInputRef.current ? "camera" : "file");
    if (!isPdf) {
      setScanning(true);
      setScanStep("prepare");
      try {
        const { base64, mediaType } = await compressImageFile(file);
        setScanImagePreview(`data:${mediaType};base64,${base64}`);
        setScanPendingImage({ base64, mediaType });
      } catch (err) {
        // Fichier que le navigateur n'arrive pas à ouvrir comme une image : format exotique
        // (HEIC brut sorti de l'app Fichiers d'un iPhone), fichier tronqué, image corrompue.
        // Le vrai message de l'erreur est capturé dans `meta` (jamais affiché au client, juste
        // visible dans le tableau de bord admin) — avant le 2026-08-25 il était perdu, laissant
        // "PDF illisible" ou "image illisible" sans aucun moyen de savoir pourquoi concrètement.
        setScanErr({ code: "file_unreadable" });
        logScanFailure("file_unreadable", { fileType: file.type || "?", errorMessage: String(err?.message || err).slice(0, 200) });
      } finally {
        setScanning(false);
        setScanStep(null);
      }
      return;
    }
    setScanning(true);
    setScanStep("prepare");
    try {
      const { pdfBase64 } = await readPdfFile(file);
      await runScanPipeline({ pdfBase64, lang });
    } catch (err) {
      // `file_too_big` posé explicitement par readPdfFile (fichier au-delà de 3 Mo) ; tout le
      // reste reste générique — plus de distinction iOS/mot de passe nécessaire depuis que le PDF
      // n'est plus jamais parsé dans le navigateur (2026-08-25), donc plus jamais sujet aux bugs
      // spécifiques d'une bibliothèque de lecture PDF client (PasswordException, bug WebKit...).
      // Le vrai message technique reste gardé pour diagnostic, au cas où un souci différent (fichier
      // vraiment corrompu, lecture réseau...) apparaisse un jour.
      const code = err?.code === "file_too_big" ? "file_too_big" : "file_unreadable";
      setScanErr({ code });
      logScanFailure(code, {
        fileType: "pdf",
        errorMessage: String(err?.message || err).slice(0, 200),
        errorName: err?.name || null,
      });
      setScanning(false);
      setScanStep(null);
    }
  };

  // Pivote la photo en attente de 90° (sens indiqué) — met à jour à la fois l'aperçu et l'image
  // qui sera réellement envoyée au clic sur "Analyser".
  const rotateScanPendingImage = async (degrees) => {
    if (!scanPendingImage) return;
    // Un échec de rotation ne doit jamais rester silencieux (l'utilisateur appuierait dans le vide)
    // ni faire perdre la photo déjà en attente : on garde la photo telle quelle et on explique.
    try {
      const rotated = await rotateImageBase64(scanPendingImage.base64, scanPendingImage.mediaType, degrees);
      setScanPendingImage(rotated);
      setScanImagePreview(`data:${rotated.mediaType};base64,${rotated.base64}`);
    } catch (err) {
      setScanErr({ code: "file_unreadable" });
    }
  };

  // Lance réellement l'analyse de la photo en attente (OCR + appel IA), une fois que
  // l'utilisateur a confirmé (éventuellement après l'avoir pivotée).
  // ⚠️ `imageOverride` ne doit JAMAIS recevoir un événement de clic : brancher cette fonction
  // directement sur un `onClick={confirmScanImage}` lui passerait l'événement React comme premier
  // argument, donc une "image" sans base64 — la requête partait alors sans document et le serveur
  // répondait "Document non reçu". Bug réel introduit puis corrigé le 2026-08-24 (déjà arrivé une
  // fois dans ce fichier avec openAddWizard). D'où l'appel obligatoire en `() => confirmScanImage()`
  // ET la vérification ci-dessous, qui ignore tout objet ne contenant pas une vraie image.
  const confirmScanImage = async (imageOverride = null) => {
    const valid = (src) => src && typeof src.base64 === "string" && src.base64.length > 100;
    const source = valid(imageOverride) ? imageOverride : scanPendingImage;
    if (!valid(source)) return;
    const { base64, mediaType } = source;
    setScanning(true);
    setScanErr(null);
    setScanPendingImage(null);
    // Mémorisée pour pouvoir RENVOYER exactement la même photo en un tap après un échec, sans
    // redemander au restaurateur de retrouver son fichier / reprendre sa photo (frein majeur :
    // après un échec, un utilisateur qui doit tout recommencer abandonne).
    setLastScanImage({ base64, mediaType });
    try {
      setScanStep("ocr");
      const ocrText = await runOcr(base64);
      await runScanPipeline({ image: base64, mediaType, ocrText, lang });
    } catch (err) {
      setScanErr({ code: "unknown" });
      logScanFailure("unknown", { errorMessage: String(err?.message || err).slice(0, 200) });
      setScanning(false);
      setScanStep(null);
    }
  };

  // Renvoie la dernière image analysée telle quelle (après un échec réseau/serveur) — un seul tap,
  // aucun fichier à re-sélectionner.
  const retryLastScan = () => {
    if (lastScanImage) return confirmScanImage(lastScanImage);
    // Pas d'image en mémoire (échec côté PDF ou fichier illisible) : on rouvre le bon sélecteur,
    // celui par lequel le restaurateur était passé, jamais l'appareil photo par défaut.
    if (lastScanSource === "camera") fileInputRef.current?.click();
    else fileInputLibraryRef.current?.click();
  };

  // Journal des ÉCHECS de scan (2026-08-24). Jusqu'ici seuls les scans réussis étaient enregistrés :
  // quand un client disait "ça ne marche pas", le tableau de bord admin restait vide et il était
  // impossible de savoir s'il avait seulement essayé, ni pourquoi ça avait échoué. Fire-and-forget,
  // jamais bloquant, aucune donnée de facture — juste un code d'erreur.
  const logScanFailure = (code, meta = {}) => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await fetch("/api/scan-events", {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
          // `device` ajouté le 2026-08-25 : un vrai trou jusqu'ici — un échec PDF pouvait être
          // attribué à un bug iOS (voir file_pdf_ios_issue) sans jamais savoir avec certitude si
          // l'appareil concerné était réellement un iPhone. Jamais de contenu de facture, juste le
          // user-agent du navigateur (donnée déjà publique côté client, pas une info sensible).
          body: JSON.stringify({ type: "scan_failed", meta: { scanner: "invoice", code, online: navigator.onLine, device: isIOSDevice ? (isIOSChromeDevice ? "iOS Chrome" : "iOS") : "autre", ...meta } }),
        });
      } catch (e) {}
    })();
  };

  // Envoie le payload à l'IA et traite le résultat — partagé par le chemin PDF (automatique) et
  // le chemin photo (après confirmation/rotation éventuelle via confirmScanImage).
  // `attempt` : 0 au premier envoi, 1 lors de la seule et unique nouvelle tentative automatique
  // après un refus pour session expirée (voir plus bas). Jamais plus de deux envois.
  const runScanPipeline = async (payload, attempt = 0) => {
    // Délai maximum côté navigateur. Sans ça, une connexion qui se coupe en pleine requête (cas
    // très courant en cuisine : wifi capricieux, passage en 4G) laissait la roue tourner
    // indéfiniment, sans erreur, sans issue — l'utilisateur ne pouvait que fermer et recommencer.
    // 90s (remonté de 75s le 2026-08-25, en même temps que le délai serveur ci-dessus) : doit
    // toujours rester au-dessus du budget serveur (60s) + une marge réseau, sinon le navigateur
    // couperait AVANT que le serveur ait fini, transformant une réponse qui allait arriver en un
    // abandon inutile.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    try {
      setScanStep("ai");
      // Preuve de compte jointe à la requête (2026-08-24) : l'endpoint refuse désormais les appels
      // sans compte connecté, pour que personne d'autre ne puisse consommer les crédits d'IA.
      // getSession() rafraîchit déjà le jeton tout seul s'il vient d'expirer ; on ne bloque JAMAIS
      // le scan si on n'arrive pas à le récupérer — c'est le serveur qui tranche, pas nous.
      let accessToken = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token || null;
      } catch (e) {}
      const headers = { "content-type": "application/json" };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch("/api/scan-invoice", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      // ⚠️ Ne JAMAIS faire res.json() directement : quand la plateforme coupe la fonction (délai
      // dépassé) ou refuse la requête, elle répond une page HTML, pas du JSON — res.json() levait
      // alors une erreur technique ("Unexpected token '<'…") affichée telle quelle au restaurateur.
      const bodyText = await res.text();
      let data = {};
      try { data = bodyText ? JSON.parse(bodyText) : {}; } catch (e) { data = {}; }
      if (!res.ok) {
        // Le serveur renvoie un code non technique (voir api/scan-invoice.js). S'il n'y en a pas,
        // c'est que la réponse ne vient pas de notre code (page d'erreur de la plateforme) : on
        // déduit la cause du statut HTTP.
        const code =
          data.code ||
          (res.status === 504 || res.status === 408 ? "ai_timeout" :
           res.status === 413 ? "file_too_big" :
           res.status === 401 ? "auth_expired" :
           res.status === 429 || res.status === 503 ? "ai_busy" : "ai_unavailable");
        // Session expirée : on la renouvelle et on renvoie la MÊME facture automatiquement, une
        // seule fois, sans rien demander au restaurateur — il ne doit même pas s'apercevoir qu'il
        // s'est passé quelque chose. Un message ne s'affichera que si ce second essai échoue aussi,
        // ce qui voudrait alors dire qu'il est réellement déconnecté.
        if ((code === "auth_expired" || code === "auth_required") && attempt === 0) {
          try { await supabase.auth.refreshSession(); } catch (e) {}
          clearTimeout(timeoutId);
          return await runScanPipeline(payload, 1);
        }
        const err = new Error(code);
        err.scanCode = code;
        err.httpStatus = res.status;
        // Code HTTP réel renvoyé par Anthropic (voir api/scan-invoice.js) — distingue "notre
        // requête est mal formée" (400) de "leur service est indisponible" (5xx), invisible sinon
        // derrière le code générique ai_unavailable/502.
        err.upstreamStatus = data.upstreamStatus || null;
        throw err;
      }
      // Date du dernier scan réussi, utilisée uniquement par le rappel d'inactivité par email
      // (api/send-reminders.js) — fire-and-forget, un échec ici ne doit jamais bloquer le scan.
      storage.set("lastScanAt", JSON.stringify(new Date().toISOString())).catch(() => {});
      // Filet de sécurité : une remise/récapitulatif/ligne de règlement doit être exclue par
      // l'IA elle-même (voir prompt), mais des tests réels ont montré qu'elle laisse parfois
      // passer ce type de ligne avec tous les champs à null au lieu de l'omettre — un vrai
      // produit a toujours un nom, donc on ignore silencieusement toute ligne sans nom exploitable
      // plutôt que de laisser apparaître une carte vide et confuse dans la vérification.
      // Filet supplémentaire trouvé lors du benchmark de factures longues/dégradées : sous
      // stress visuel maximal, le bloc de totaux en bas de page ("Total HT calculé sur les
      // lignes ci-dessus", "Net à payer...") a été vu découpé en plusieurs fausses lignes
      // produit. Ces lignes ont un nom, donc le filtre ci-dessus ne les attrape pas — on les
      // reconnaît par mots-clés (accents/casse ignorés) au lieu de se fier uniquement au prompt.
      const FOOTER_KEYWORDS = [
        "total ht", "total ttc", "net a payer", "sous total", "recapitulatif", "calcule sur les lignes", "a regler", "montant du",
        // équivalents espagnols du même type de bloc de totaux
        "base imponible", "importe total", "total factura", "a pagar", "iva incluido",
      ];
      const looksLikeFooter = (it) => {
        const text = normalizeStr(`${it.name || ""} ${it.rawLabel || ""}`);
        return FOOTER_KEYWORDS.some((kw) => text.includes(kw));
      };
      const items = (Array.isArray(data.items) ? data.items : [])
        .filter((it) => it && typeof it === "object")
        // String() défensif : un nom renvoyé comme nombre ferait planter .trim() (écran blanc).
        .map((it) => (typeof it.name === "string" || it.name == null ? it : { ...it, name: String(it.name) }))
        .filter((it) => it.name && it.name.trim())
        .filter((it) => !looksLikeFooter(it))
        .map((it) => {
        const { finalUnit, finalUnitPrice, priceInconsistent, expectedTotal, pricingUnknown } = computeItemPricing(it);
        // Signal de confiance déclaré par l'IA elle-même ligne par ligne (voir prompt, règle
        // SIGNAL DE CONFIANCE) : une ligne lue sur un document flou/dense où un chiffre pourrait
        // appartenir à la mauvaise ligne ne doit jamais être traitée comme automatiquement sûre.
        const lowConfidence = !!it.lowConfidence;
        const merged = { ...it, unit: finalUnit, unitPriceHT: pricingUnknown ? 0 : finalUnitPrice, lowConfidence };

        // Priorité à un rapprochement déjà validé manuellement lors d'un scan précédent pour
        // ce même texte brut fournisseur : on lui fait confiance sans repasser par le score.
        const learnedId = findMappedIngredientId(merged.rawLabel, merged.name);
        const match = learnedId ? { id: learnedId, confident: true } : guessIngredientId(merged.name);
        const matchedId = match ? match.id : null;
        const matchedIng = matchedId ? ingredientById(matchedId) : null;
        const activeSup = matchedIng ? activeSupplier(matchedIng) : null;
        const currentPrice = activeSup?.price ?? null;
        const currentPriceIsReal = activeSup?.priceSource && activeSup.priceSource !== "estimate";

        // Un changement d'unité sur un ingrédient déjà utilisé dans une recette est dangereux :
        // la quantité déjà saisie dans cette recette (comprise dans l'ANCIENNE unité) serait
        // silencieusement réinterprétée dans la nouvelle unité au moment de l'import (ex: "2"
        // gousses d'ail en "pièce" deviendrait "2 kg" si l'unité bascule en kg) — cas réel
        // remonté par l'utilisateur (ingrédient créé en "pièce" via le scanner de fiche recette,
        // puis retrouvé en kg sur une vraie facture). Ne bloque pas l'import, mais retire la
        // ligne de "sûr" pour forcer une vérification humaine plutôt qu'une bascule silencieuse.
        const unitChangeAffectsRecipes =
          !!matchedIng &&
          matchedIng.unit &&
          finalUnit &&
          matchedIng.unit !== finalUnit &&
          recipes.some((r) => r.lines.some((l) => l.ingredientId === matchedIng.id));

        // [BUG confirmé et corrigé, 2026-08-25] Comparer currentPrice (dans l'ANCIENNE unité de
        // l'ingrédient) à merged.unitPriceHT (dans la NOUVELLE unité tout juste calculée) n'a de
        // sens que si les deux unités sont les mêmes — sinon c'est une comparaison entre pommes et
        // oranges (ex: 9€/kg comparé à un prix recalculé "par pièce" pour un colis de 5kg à 45€ :
        // aucune vraie hausse, juste deux unités différentes). `unitChangeAffectsRecipes`
        // détectait déjà ce cas juste au-dessus mais son résultat n'était utilisé que pour
        // avertir sur les recettes, jamais pour empêcher ce calcul de prix erroné — trouvé en
        // relisant le code après qu'un test réel ait signalé "en hausse" pour un prix qui avait
        // en fait baissé. Tant que l'unité diffère, on ne peut honnêtement rien affirmer sur le
        // sens de la variation : ni hausse, ni baisse, ni grosse variation.
        const sameUnitAsExisting = !matchedIng?.unit || !finalUnit || matchedIng.unit === finalUnit;

        // Grosse variation à confirmer explicitement — uniquement si on la compare à un
        // VRAI prix déjà observé (jamais contre une simple estimation de départ non vérifiée) ET
        // dans la même unité (voir ci-dessus).
        const bigChange =
          currentPrice !== null && currentPriceIsReal && merged.unitPriceHT > 0 && sameUnitAsExisting
            ? Math.abs(merged.unitPriceHT - currentPrice) / currentPrice > 0.4
            : false;

        // Aucun prix exploitable au final (rien d'imprimé, ou impossible à ramener à un vrai
        // prix au kg/L/pièce) : on ne doit jamais laisser passer ça en "Sûr" à 0€.
        const priceUnusable = pricingUnknown || !(merged.unitPriceHT > 0);

        return {
          ...merged,
          // Un rapprochement douteux (score flou, faute de frappe/OCR) ne doit jamais
          // pré-sélectionner l'ingrédient existant tout seul — cas réel trouvé en test
          // ("Haricot" rapproché à tort d'"Abricot") : par défaut on coche "créer séparément"
          // dès qu'il y a un doute, la suggestion reste visible et cliquable (guessedMatchId)
          // mais l'utilisateur doit l'accepter explicitement plutôt que la subir par défaut.
          assignTo: matchedId && match.confident ? matchedId : "new",
          // Référence stable vers l'ingrédient existant repéré (par l'IA ou la mémoire des
          // rapprochements), conservée même si l'utilisateur choisit "new" ensuite — permet de
          // toujours proposer "garder / renommer / créer séparément" sans perdre la suggestion.
          guessedMatchId: matchedId || null,
          matchConfident: match ? match.confident : false,
          // Par défaut on garde toujours le nom existant : renommer doit être un choix
          // explicite de l'utilisateur, jamais une conséquence silencieuse d'un scan.
          renameOnImport: false,
          imported: false,
          // Passé à true quand la ligne a été validée dans la pile "à vérifier" : elle rejoint
          // alors la liste "sûr" SANS être écrite dans le garde-manger — l'écriture réelle
          // n'arrive qu'au clic sur la coche de la liste. Ça permet de revenir en arrière et
          // corriger un choix (garder/renommer/créer séparément, prix...) après coup, sans avoir
          // à "annuler" un import déjà appliqué à un ingrédient.
          reviewed: false,
          currentPrice,
          currentPriceIsReal,
          priceInconsistent,
          expectedTotal,
          pricingUnknown,
          priceUnusable,
          bigChange,
          unitChangeAffectsRecipes,
          // Exposé explicitement (2026-08-25) pour que l'affichage (ScanItemCard) sache aussi
          // masquer le badge de variation en % quand la comparaison n'a pas de sens — sinon un
          // pourcentage pouvait s'afficher (et sembler fiable) sur deux unités différentes.
          priceComparisonValid: sameUnitAsExisting,
          previousUnit: matchedIng?.unit || null,
          // Seuil aligné sur celui déjà utilisé par priceVariation() (fiche recette) : sous 1%,
          // c'est du bruit d'arrondi, pas une vraie variation. Avant ce correctif le seuil était
          // à 2%, ce qui masquait des hausses/baisses réelles mais modestes (ex: 9.40€ -> 9.60€,
          // ~2.1%, à la limite) — signalé par l'utilisateur comme "je ne vois jamais de variation".
          // sameUnitAsExisting (voir plus haut) : jamais de sens de variation affirmé entre deux
          // unités différentes, ce serait juste faux.
          priceUp: currentPrice !== null && sameUnitAsExisting && merged.unitPriceHT > currentPrice * 1.01,
          priceDown: currentPrice !== null && sameUnitAsExisting && merged.unitPriceHT < currentPrice * 0.99,
        };
      });

      // Seuls les articles non-alimentaires (produits d'entretien, consignes, frais de port...)
      // sont écartés du garde-manger — jamais silencieusement, on les affiche dans un résumé
      // avec la possibilité de les récupérer. Un ingrédient alimentaire dont le prix est
      // introuvable/incalculable reste dans "À vérifier" : il ne doit surtout pas disparaître
      // silencieusement de la recette, l'utilisateur doit pouvoir saisir le prix lui-même
      // (priceUnusable l'empêche seulement d'être auto-importé tant que le prix n'est pas fixé).
      const isExcludable = (it) => it.isFood === false;
      const foodItems = items.filter((it) => !isExcludable(it));
      const excludedItems = items
        .filter(isExcludable)
        .map((it) => ({ ...it, excludeReason: it.isDeposit ? "deposit" : "nonFood" }));

      // Alerte globale si une grosse majorité des prix scannés semble en forte hausse
      // par rapport aux vrais prix déjà connus — signe probable d'un souci de lecture du document.
      const comparable = foodItems.filter((i) => i.currentPrice !== null && i.currentPriceIsReal);
      const manyUp = comparable.length >= 3 && comparable.filter((i) => i.priceUp).length / comparable.length > 0.6;

      // Bandeau discret (jamais bloquant) si une bonne part des lignes ont un signal de
      // confiance bas — signe probable d'une photo floue/inclinée plutôt qu'un souci par ligne.
      const manyLowConfidence = foodItems.length >= 2 && foodItems.filter((i) => i.lowConfidence).length / foodItems.length > 0.3;

      setScanResult({ supplier: data.supplier || null, date: data.date || null, items: foodItems, excludedItems, manyUp, manyLowConfidence });
      // Statistiques agrégées du scanner (2026-08, fire-and-forget) : jamais de contenu de
      // facture, juste des compteurs — voir api/scan-events.js (POST). Sert uniquement à surveiller
      // la fiabilité réelle du scan sur l'ensemble des comptes (interrogeable via le même fichier
      // en GET, protégé par ADMIN_SECRET), invisible dans l'app pour tout utilisateur.
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          await fetch("/api/scan-events", {
            method: "POST",
            headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              scanner: "invoice",
              supplierKnown: !!data.supplier,
              totalItems: foodItems.length + excludedItems.length,
              foodItems: foodItems.length,
              excludedItems: excludedItems.length,
              zeroItems: foodItems.length + excludedItems.length === 0,
              lowConfidenceItems: foodItems.filter((i) => i.lowConfidence).length,
              manyLowConfidence,
              priceInconsistentItems: foodItems.filter((i) => i.priceInconsistent).length,
              pricingUnknownItems: foodItems.filter((i) => i.pricingUnknown).length,
            }),
          });
        } catch (e) {}
      })();
      // Vérification "un par un" par défaut dès qu'il y a quelque chose à vérifier — demandé
      // explicitement par l'utilisateur (2026-08) : la liste groupée restait trop facile à
      // survoler sans vraiment regarder chaque ligne. Le mode liste reste accessible via "Fermer".
      const needsReview = foodItems.filter((it) => !isReadyToImport(it));
      if (needsReview.length > 0) {
        setReviewStackOpen(true);
        setStackTotal(needsReview.length);
        setExpandedReviewIdx(null);
      }
    } catch (err) {
      // Classement en catégories compréhensibles par un restaurateur, jamais un message technique.
      // "AbortError" = notre propre délai de 75s dépassé ; un fetch qui échoue sans réponse du tout
      // (TypeError) = connexion perdue, appareil hors ligne, ou tunnel réseau coupé.
      const code =
        err.scanCode ||
        (err.name === "AbortError" ? "ai_timeout" : !navigator.onLine || err.name === "TypeError" ? "offline" : "unknown");
      setScanErr({ code, status: err.httpStatus || null });
      logScanFailure(code, {
        httpStatus: err.httpStatus || null,
        upstreamStatus: err.upstreamStatus || null,
        mode: payload.pdfBase64 ? "pdf" : payload.text ? "pdf_text" : "image",
      });
    } finally {
      clearTimeout(timeoutId);
      setScanning(false);
      setScanStep(null);
    }
  };

  const updateScanItem = (idx, patch) => {
    setScanResult((r) => ({ ...r, items: r.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  };

  const importScanItem = (idx, override = {}) => {
    const raw = scanResult.items[idx];
    if (!raw || raw.imported) return;
    const item = { ...raw, ...override };
    const supplierName = scanResult.supplier || t("scanInvoice");
    const finalUnit = item.unit || "kg";
    const finalPrice = item.unitPriceHT || 0;

    let resultingIngredientId;
    if (item.assignTo === "new") {
      const sId = uid();
      const newId = uid();
      resultingIngredientId = newId;
      const catalogGuess = guessCatalogEntry(item.name);
      const ni = {
        id: newId,
        name: item.name,
        unit: finalUnit,
        catalogId: catalogGuess?.confident ? catalogGuess.catalogId : null,
        category: catalogGuess ? catalogGuess.category : "autres",
        selectedSupplierId: sId,
        suppliers: [{ id: sId, name: supplierName, price: finalPrice, priceSource: "scan" }],
        history: [{ date: today(), price: finalPrice, supplierName, supplierId: sId }],
        lastUpdated: today(),
      };
      setIngredients((ings) => [...ings, ni]);
    } else {
      const ingId = item.assignTo;
      resultingIngredientId = ingId;
      setIngredients((ings) =>
        ings.map((ing) => {
          if (ing.id !== ingId) return ing;
          let suppliers = ing.suppliers;
          const existing = suppliers.find((s) => normalizeStr(s.name) === normalizeStr(supplierName));
          // Le fournisseur qu'on vient de confirmer par ce scan devient le fournisseur actif :
          // c'est tout l'intérêt de scanner une facture (refléter le prix réel du moment), sinon
          // le prix affiché restait bloqué sur l'ancien fournisseur (souvent une simple estimation
          // de départ) même après un import "réussi" — bug réel trouvé en test par l'utilisateur.
          let newSelectedSupplierId;
          if (existing) {
            suppliers = suppliers.map((s) => (s.id === existing.id ? { ...s, price: finalPrice, priceSource: "scan" } : s));
            newSelectedSupplierId = existing.id;
          } else {
            const newSupplierId = uid();
            suppliers = [...suppliers, { id: newSupplierId, name: supplierName, price: finalPrice, priceSource: "scan" }];
            newSelectedSupplierId = newSupplierId;
          }
          const priorPrice = existing ? existing.price : undefined;
          const history =
            finalPrice !== priorPrice
              ? [...(ing.history || []), { date: today(), price: finalPrice, supplierName, supplierId: newSelectedSupplierId }].slice(-15)
              : ing.history;
          const renamed = item.renameOnImport && item.name ? { name: item.name, catalogId: null } : {};
          return { ...ing, unit: finalUnit, suppliers, history, lastUpdated: today(), ...renamed, selectedSupplierId: newSelectedSupplierId };
        })
      );
    }
    // L'utilisateur vient de valider (ou corriger) ce rapprochement : on le retient pour que
    // ce même texte brut fournisseur soit reconnu automatiquement lors d'un prochain scan.
    rememberSupplierMapping(item.rawLabel, item.name, resultingIngredientId);
    updateScanItem(idx, { ...override, imported: true });
  };

  // "Importer tout" ne traite QUE les lignes sans aucun signal d'alerte — tout le reste
  // (prix incohérent, conditionnement ambigu, grosse variation, correspondance incertaine)
  // doit être validé ligne par ligne, en connaissance de cause.
  // "new" ne suffit PAS à lui seul : si une suggestion existait (guessedMatchId), l'utilisateur
  // est peut-être seulement en train de choisir "créer séparément" dans le picker sans avoir
  // encore validé — la ligne doit rester dans "à vérifier" jusqu'au clic explicite sur Valider.
  const isSafeScanItem = (item) =>
    !item.priceInconsistent && !item.bigChange && !item.priceUnusable && !item.lowConfidence && !item.unitChangeAffectsRecipes &&
    (item.matchConfident || (item.assignTo === "new" && !item.guessedMatchId));

  // Une ligne rejoint la section "sûr" (éditable, coche pour importer) si elle est intrinsèquement
  // sûre, OU si l'utilisateur vient de la valider dans la pile "à vérifier" (`reviewed`) — dans ce
  // second cas rien n'est encore écrit dans le garde-manger, donc revenir en arrière et corriger
  // reste toujours possible tant que la coche n'a pas été cliquée.
  const isReadyToImport = (item) => isSafeScanItem(item) || item.reviewed;

  const skipScanItem = (idx) => updateScanItem(idx, { skipped: true });
  const unskipScanItem = (idx) => updateScanItem(idx, { skipped: false });

  const restoreExcludedItem = (idx) => {
    setScanResult((r) => {
      if (!r) return r;
      const item = r.excludedItems[idx];
      if (!item) return r;
      return {
        ...r,
        items: [...r.items, item],
        excludedItems: r.excludedItems.filter((_, i) => i !== idx),
      };
    });
  };

  // Après l'import en masse : si tout est réglé (rien à vérifier), on ferme directement la
  // fenêtre au lieu de laisser l'utilisateur devant une liste "importé" qu'il doit fermer
  // lui-même en remontant chercher la croix (frustration réelle remontée en test, 2026-08).
  // S'il reste des lignes à vérifier, on l'emmène directement dans la pile "un par un" plutôt
  // que de le laisser au milieu d'une liste où tout ce qui pouvait être importé l'a déjà été.
  const importAllScanItems = () => {
    const stillNeedsReview = scanResult.items.some((item) => !item.imported && !item.skipped && !isReadyToImport(item));
    scanResult.items.forEach((item, idx) => {
      if (isReadyToImport(item)) importScanItem(idx);
    });
    if (stillNeedsReview) setReviewStackOpen(true);
    else closeScan();
  };

  // Échappatoire depuis la pile de vérification : ignore tout ce qui reste (jamais les lignes
  // déjà importées) et ferme la fenêtre en un clic, pour qui ne veut pas vérifier ligne par ligne.
  const skipAllPendingAndClose = () => {
    scanResult.items.forEach((item, idx) => {
      if (!item.imported && !item.skipped) skipScanItem(idx);
    });
    closeScan();
  };

  const closeScan = () => {
    setScanOpen(false);
    setScanResult(null);
    setScanErr(null);
    setScanImagePreview(null);
    setScanImageZoomed(false);
    setScanPendingImage(null);
    setScanStep(null);
    setLastScanImage(null);
    setReviewStackOpen(false);
    setExpandedReviewIdx(null);
  };

  // Tout code d'erreur inattendu retombe sur "unknown" : garantit qu'un message compréhensible
  // s'affiche toujours, jamais une clé de traduction brute à l'écran.
  const scanErrCode = scanErr && SCAN_ERR_CODES.includes(scanErr.code) ? scanErr.code : "unknown";

  // Ouvre le formulaire de contact avec un message déjà pré-rempli décrivant l'échec, pour que le
  // restaurateur n'ait qu'à cliquer "Envoyer" — et que nous, on reçoive un vrai diagnostic (code
  // d'erreur, statut) plutôt qu'un "ça ne marche pas" impossible à reproduire. Le code entre
  // crochets ne révèle rien du fonctionnement interne, c'est juste un repère de corrélation.
  const reportScanProblem = (codeOverride = null) => {
    const code = codeOverride || scanErr?.code || "unknown";
    setContactMessage(`${t("scanReportPrefill")}\n\n[${code}${scanErr?.status ? `/${scanErr.status}` : ""}]`);
    setContactSent(false);
    setContactErr(null);
    setContactModalOpen(true);
  };

  // ---------------- Scanner de fiche recette (photo/PDF -> pré-remplissage d'une recette) ----------------
  // Fonctionnalité totalement séparée du scanner de factures ci-dessus : autre endpoint serveur
  // (api/scan-recipe.js), autre état, aucune fonction du scanner de factures touchée.
  const handleScanRecipeFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScanRecipeOpen(true);
    setScanningRecipe(true);
    setScanRecipeErr(null);
    setScanRecipeResult(null);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    try {
      let payload;
      if (isPdf) {
        const pdfResult = await readPdfFile(file);
        if (pdfResult.text) {
          payload = { text: pdfResult.text, lang };
        } else {
          const ocrText = await runOcr(pdfResult.base64);
          payload = { image: pdfResult.base64, mediaType: pdfResult.mediaType, ocrText, lang };
        }
      } else {
        const { base64, mediaType } = await compressImageFile(file);
        const ocrText = await runOcr(base64);
        payload = { image: base64, mediaType, ocrText, lang };
      }
      // Même preuve de compte que le scanner de factures (voir runScanPipeline) : cet endpoint
      // consomme aussi des crédits d'IA et refuse désormais les appels sans compte connecté.
      const recipeHeaders = { "content-type": "application/json" };
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) recipeHeaders.Authorization = `Bearer ${session.access_token}`;
      } catch (err) {}
      const res = await fetch("/api/scan-recipe", {
        method: "POST",
        headers: recipeHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const debugDetail = data.detail || data.raw;
        const msg = debugDetail ? `${data.error} (${debugDetail})` : data.error || "Échec de l'analyse";
        throw new Error(msg);
      }
      // Filet de sécurité : sur une fiche complexe (plusieurs sous-recettes, ex: "pâte" / "garniture"
      // / "sauce"), l'IA regroupe parfois les lignes par section au lieu d'un tableau plat malgré
      // la consigne du prompt — on aplatit systématiquement plutôt que de planter sur une forme
      // inattendue (`data.lines` objet de sections, ou toute valeur non-tableau).
      let rawLines = [];
      if (Array.isArray(data.lines)) rawLines = data.lines;
      else if (data.lines && typeof data.lines === "object") {
        rawLines = Object.values(data.lines).flatMap((v) => (Array.isArray(v) ? v : []));
      }
      // Coercion tolérante : sur une fiche complexe l'IA renvoie parfois un tableau (ex: étapes
      // numérotées, plusieurs allergènes) là où le prompt demande une seule chaîne — on préserve
      // l'information (jointure) plutôt que de la perdre silencieusement ou de planter dessus.
      const asText = (v, sep = "\n") => {
        if (typeof v === "string") return v;
        if (Array.isArray(v)) return v.filter((x) => typeof x === "string").join(sep);
        return "";
      };

      // Filet de sécurité déterministe : le prompt demande à l'IA de toujours convertir
      // g→kg/mL→L/cl→L elle-même, mais elle ne le fait pas toujours (ex: "Cognac 20cl" renvoyé
      // avec unit:"g" ou "cl" tel quel) — l'app ne comprend QUE kg/L/pièce, donc une unité brute
      // non convertie doit être rattrapée ici plutôt que de rester une valeur invalide et bloquée.
      const normalizeScanUnit = (qty, rawUnit) => {
        const u = (rawUnit || "").toString().trim().toLowerCase();
        if (typeof qty === "number") {
          if (["g", "gramme", "grammes"].includes(u)) return { qty: qty / 1000, unit: "kg" };
          if (["ml", "millilitre", "millilitres"].includes(u)) return { qty: qty / 1000, unit: "L" };
          if (["cl", "centilitre", "centilitres"].includes(u)) return { qty: qty / 100, unit: "L" };
        }
        if (u === "kg") return { qty, unit: "kg" };
        if (["l", "litre", "litres"].includes(u)) return { qty, unit: "L" };
        if (["pièce", "piece", "pieces", "pièces", "u", "pc"].includes(u)) return { qty, unit: "pièce" };
        return { qty: null, unit: null }; // unité non reconnue : traitée comme imprécise ci-dessous
      };

      // Rapproche chaque ligne détectée avec le garde-manger existant (même fonction que le
      // scanner de factures) — une correspondance non confiante reste modifiable via
      // ScanNameChoice dans l'écran de vérification, jamais assignée silencieusement.
      const lines = rawLines
        .filter((l) => l && typeof l === "object" && asText(l.name).trim())
        .map((l) => {
          const name = asText(l.name);
          const match = guessIngredientId(name);
          const rawQty = typeof l.qty === "number" ? l.qty : null;
          const normalized = normalizeScanUnit(rawQty, asText(l.unit));
          let qty = normalized.unit ? normalized.qty : null;
          let unit = normalized.unit;
          const impreciseQuantity = !!l.impreciseQuantity || qty === null || unit === null;
          // Sur une quantité imprécise, l'unité proposée par l'IA n'est pas fiable (ex: "pièce"
          // hasardeux pour de la viande sans poids écrit, ou unité non reconnue) — préférer
          // l'unité habituelle de la catégorie devinée, affichée dès la vérification pour rester
          // cohérente avec ce qui sera réellement créé (voir createRecipeFromScan).
          if (impreciseQuantity) {
            qty = null;
            const catalogGuess = guessCatalogEntry(name);
            unit = CATEGORY_DEFAULT_UNIT[catalogGuess ? catalogGuess.category : "autres"] || "kg";
          }
          return {
            rawText: asText(l.rawText) || name,
            name,
            qty,
            unit,
            impreciseQuantity,
            // Un rapprochement douteux ne doit jamais pré-sélectionner l'ingrédient existant tout
            // seul (même règle que le scanner de factures, voir handleScanFile) : par défaut
            // "créer séparément" tant que le match n'est pas confiant, la suggestion reste
            // disponible via guessedMatchId pour que l'utilisateur l'accepte explicitement.
            assignTo: match && match.confident ? match.id : "new",
            guessedMatchId: match ? match.id : null,
            matchConfident: match ? match.confident : false,
            renameOnImport: false,
          };
        });
      setScanRecipeResult({
        name: asText(data.name),
        portions: typeof data.portions === "number" && data.portions > 0 ? data.portions : 4,
        sellPrice: typeof data.sellPrice === "number" ? data.sellPrice : 0,
        allergens: asText(data.allergens, ", "),
        notes: asText(data.notes),
        lines,
      });
    } catch (err) {
      setScanRecipeErr(err.message || "Erreur inattendue");
    } finally {
      setScanningRecipe(false);
    }
  };

  const updateScanRecipeLine = (idx, patch) => {
    setScanRecipeResult((r) => ({ ...r, lines: r.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));
  };
  const updateScanRecipeField = (patch) => setScanRecipeResult((r) => ({ ...r, ...patch }));
  const removeScanRecipeLine = (idx) => setScanRecipeResult((r) => ({ ...r, lines: r.lines.filter((_, i) => i !== idx) }));

  const closeScanRecipe = () => {
    setScanRecipeOpen(false);
    setScanRecipeResult(null);
    setScanRecipeErr(null);
  };

  // Construit la recette (et les ingrédients manquants) à partir du résultat vérifié, puis ouvre
  // la fiche recette créée. Même logique de création d'ingrédient que le scanner de factures
  // (guessCatalogEntry pour catégorie/catalogId), mais avec un prix ESTIMÉ par catégorie plutôt
  // qu'un vrai prix fournisseur (aucune facture ici) — priceSource "estimate", modifiable ensuite
  // dans le garde-manger comme n'importe quel ingrédient créé via l'assistant.
  const createRecipeFromScan = () => {
    if (!scanRecipeResult) return;
    const newIngredients = [];
    const renameOps = []; // { id, name } — ingrédients existants à renommer (choix "renommer" dans ScanNameChoice)
    const resolvedLines = scanRecipeResult.lines.map((line) => {
      let ingredientId;
      let unitAtEntry;
      if (line.assignTo === "new") {
        const catalogGuess = guessCatalogEntry(line.name);
        const category = catalogGuess ? catalogGuess.category : "autres";
        const sId = uid();
        ingredientId = uid();
        // Sur une quantité imprécise, l'unité proposée par l'IA n'est pas fiable (voir
        // api/scan-recipe.js) — on préfère l'unité habituelle de la catégorie plutôt que de
        // suivre un "pièce" hasardeux pour un ingrédient normalement vendu au poids.
        const unit = line.impreciseQuantity ? CATEGORY_DEFAULT_UNIT[category] || "kg" : line.unit || "kg";
        unitAtEntry = unit;
        newIngredients.push({
          id: ingredientId,
          name: line.name,
          unit,
          catalogId: catalogGuess?.confident ? catalogGuess.catalogId : null,
          category,
          selectedSupplierId: sId,
          suppliers: [{ id: sId, name: t("supplier"), price: CATEGORY_ESTIMATE_PRICE[category] || 5, priceSource: "estimate" }],
          history: [],
          lastUpdated: today(),
        });
      } else {
        ingredientId = line.assignTo;
        if (line.renameOnImport && line.name) renameOps.push({ id: ingredientId, name: line.name });
        unitAtEntry = ingredients.find((i) => i.id === ingredientId)?.unit;
      }
      return { ingredientId, qty: line.impreciseQuantity ? 0 : line.qty || 0, unitAtEntry };
    });

    if (newIngredients.length || renameOps.length) {
      setIngredients((ings) => {
        const renamed = ings.map((ing) => {
          const r = renameOps.find((x) => x.id === ing.id);
          return r ? { ...ing, name: r.name, catalogId: null } : ing;
        });
        return [...renamed, ...newIngredients];
      });
    }

    const newRecipe = {
      id: uid(),
      name: scanRecipeResult.name || t("newRecipeName"),
      portions: scanRecipeResult.portions || 4,
      sellPrice: scanRecipeResult.sellPrice || 0,
      targetMargin: 75,
      notes: scanRecipeResult.notes || "",
      allergens: scanRecipeResult.allergens || "",
      allergensAuto: !scanRecipeResult.allergens,
      createdAt: today(),
      lines: resolvedLines.filter((l) => l.ingredientId),
    };
    setRecipes((rs) => [...rs, newRecipe]);
    setActiveId(newRecipe.id);
    setActiveTab("recipes");
    setRecipeSubView("detail");
    closeScanRecipe();
    logActivity("recipe_created", { name: newRecipe.name });
  };

  // L'objectif propre à la recette (`targetMargin`, éditable dans la fiche) prévaut sur le
  // réglage global s'il a été personnalisé — sinon retombe sur le même seuil que partout ailleurs.
  const tier = marginTier(margin, active?.targetMargin ?? settings.minMargin);
  const marginLow = tier === "low";
  // Suggestion contextuelle : uniquement quand la marge est sous l'objectif (mid/low),
  // jamais sur une recette déjà au-dessus (pas de conseil "à corriger" quand tout va bien).
  const marginSuggestion =
    active && tier && tier !== "high" ? recipeSuggestion(active, ingredients, lineCost, ingredientDisplayName, lang) : null;

  const wizardExistingSuggestions = wizardQuery.trim()
    ? ingredients
        .filter((i) => textIncludes(ingredientDisplayName(i), wizardQuery))
        .slice(0, 5)
    : [];
  const wizardExistingCatalogIds = new Set(ingredients.map((i) => i.catalogId).filter(Boolean));
  const wizardCatalogSuggestions = wizardQuery.trim()
    ? CATALOG.filter(
        (c) => !wizardExistingCatalogIds.has(c.id) && textIncludes(c[lang], wizardQuery)
      ).slice(0, 5)
    : [];

  const pantryFiltered = ingredients.filter((i) => {
    const q = pantryQuery.trim();
    // Dès qu'on tape quelque chose, la recherche porte sur TOUT le garde-manger, quel que soit
    // l'onglet catégorie actif — sinon un ingrédient mal classé (ex: dans "Autres" au lieu de
    // "Viandes") devient introuvable par nom tant qu'on n'a pas deviné dans quelle catégorie il
    // a atterri. Bug réel signalé : chercher "boeuf" pendant qu'on est sur l'onglet "Autres" ne
    // sortait rien si le produit était en fait classé ailleurs.
    if (q !== "") return textIncludes(ingredientDisplayName(i), q);
    if (pantryCategory === "none") return false; // rien par défaut : il faut choisir une catégorie ou chercher
    if (pantryCategory === "recent") return true; // filtré par date plus bas
    return pantryCategory === "all" || (i.category || "autres") === pantryCategory;
  });

  // Tableau du garde-manger : regroupé par catégorie, puis ordre alphabétique dans chaque groupe.
  const pantryGrouped = CATEGORIES.map((c) => ({
    label: c[lang],
    items: pantryFiltered
      .filter((i) => (i.category || "autres") === c.id)
      .sort((a, b) => ingredientDisplayName(a).localeCompare(ingredientDisplayName(b), lang)),
  })).filter((g) => g.items.length > 0);

  // Vue "récents" : regroupe par ancienneté de dernière mise à jour plutôt que par catégorie,
  // pour retrouver facilement un ingrédient qu'on vient de scanner/modifier.
  const daysSince = (dateStr) => {
    if (!dateStr) return Infinity;
    return Math.round((new Date(today()) - new Date(dateStr)) / 86400000);
  };
  const recentGrouped =
    pantryCategory === "recent"
      ? (() => {
          const withDate = pantryFiltered
            .filter((i) => i.lastUpdated)
            .sort((a, b) => (b.lastUpdated || "").localeCompare(a.lastUpdated || ""));
          const buckets = { today: [], week: [], month: [] };
          withDate.forEach((i) => {
            const d = daysSince(i.lastUpdated);
            if (d <= 0) buckets.today.push(i);
            else if (d <= 7) buckets.week.push(i);
            else if (d <= 31) buckets.month.push(i);
          });
          return [
            { label: t("recentToday"), items: buckets.today },
            { label: t("recentWeek"), items: buckets.week },
            { label: t("recentMonth"), items: buckets.month },
          ].filter((g) => g.items.length > 0);
        })()
      : null;

  // Le seuil vert ne peut jamais descendre sous 70% (règle fixe du rouge) — on l'utilise
  // pour le texte d'aide afin qu'il reste cohérent avec les couleurs réellement affichées.
  const effectiveGreenTarget = Math.max(settings.minMargin || 0, CRITICAL_MARGIN);
  const hasOrangeZone = effectiveGreenTarget > CRITICAL_MARGIN;

  return (
    <div className="min-h-screen w-full overflow-x-hidden" style={{ background: "#1B1815", maxWidth: "100vw" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        .font-display { font-family: 'Oswald', sans-serif; }
        .font-body { font-family: 'Manrope', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        /* [REFONTE 2026-08-27] La fiche recette ne ressemble plus à un ticket de caisse.
           L'utilisateur ne voulait plus de cette métaphore : bords dentelés, papier crème étroit,
           police à chasse fixe. Elle devient une vraie fiche de travail — pleine largeur, coins
           arrondis, typographie lisible.
           ⚠️ Contrainte majeure : ce MÊME bloc DOM est la mise en page d'impression (voir
           @media print plus bas, qui ne rend visible que .ticket). On garde donc une surface
           CLAIRE, sinon les innombrables classes text-black/... des lignes d'ingrédients
           deviendraient illisibles et il faudrait toutes les réécrire — pour un résultat
           identique à l'impression. Le nom de classe .ticket est conservé pour la même raison :
           le renommer obligerait à toucher la règle d'impression et la fiche allergènes. */
        .ticket {
          background: #FBF8F3; color: #211D18; position: relative;
          border-radius: 18px; box-shadow: 0 4px 24px rgba(0,0,0,0.28);
          max-width: 100%;
        }
        .stamp { border: 3px solid currentColor; transform: rotate(-6deg); font-family: 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.9; }
        @media print {
          body * { visibility: hidden; }
          .ticket, .ticket *, .allergen-sheet, .allergen-sheet * { visibility: visible; }
          /* À l'impression on retrouve une vraie feuille : ni ombre, ni coins arrondis, ni fond
             teinté (économie d'encre), et une largeur de page classique plutôt que la pleine
             largeur d'écran. */
          .ticket {
            position: absolute; top: 0; left: 0; right: 0; margin: 0 auto;
            box-shadow: none; border-radius: 0; background: #fff; max-width: 190mm;
          }
          .allergen-sheet { position: absolute; top: 0; left: 0; right: 0; margin: 0 auto; }
          .hide-prices .price-field { display: none !important; }
        }
        @media (max-width: 1024px) { .grid-main { grid-template-columns: 1fr !important; } }
        /* Empêche le zoom automatique de Safari mobile sur les champs de saisie
           (qui décalait la vue et cachait les suggestions dès la 1ère lettre tapée). */
        @media (max-width: 767px) {
          input, select, textarea { font-size: 16px !important; }
        }
        @keyframes scanPulse {
          0%, 100% { transform: translateY(-18px); opacity: 0; }
          15% { opacity: 1; }
          50% { transform: translateY(18px); opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(-18px); opacity: 0; }
        }
        @keyframes scanFlash {
          0%, 70%, 100% { transform: scale(1); }
          78% { transform: scale(1.15); }
          86% { transform: scale(1); }
        }
        @keyframes wizardStepIn {
          from { opacity: 0; transform: translateX(14px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes successPop {
          0% { transform: scale(0); }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
      `}</style>

      <header className="px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-2 print:hidden" style={{ background: "#26221C", borderBottom: "1px solid rgba(201,154,85,0.25)" }}>
        <div className="flex items-center gap-2">
          <Logo size={26} />
          <h1 className="font-display text-white text-base sm:text-lg tracking-wide uppercase">{t("appTitle")}</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 font-body text-xs text-white/50 flex-wrap">
          {!ready ? t("loading") : loadErr ? (
            <span className="text-amber-400">{t("dataUnavailable")}</span>
          ) : (
            <span className={`flex items-center gap-1 transition-opacity ${savedPulse ? "opacity-100" : "opacity-0"}`}>
              <Check size={14} color="#10B981" /> {t("saved")}
            </span>
          )}
          <button onClick={() => setAccountMenuOpen(true)} className="text-white/60 hover:text-[#8B5CF6]" title={t("myAccount")}>
            <User size={16} />
          </button>
          <button onClick={() => setShowSettings(true)} className="text-white/60 hover:text-[#8B5CF6]" title={t("settings")}>
            <SettingsIcon size={16} />
          </button>
          <button onClick={() => supabase.auth.signOut()} className="text-white/60 hover:text-[#8B5CF6]" title={t("logout")}>
            <LogOut size={16} />
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => changeLang("fr")} className={`text-lg leading-none ${lang === "fr" ? "" : "opacity-40 grayscale"}`} title="Français">🇫🇷</button>
            <button onClick={() => changeLang("es")} className={`text-lg leading-none ${lang === "es" ? "" : "opacity-40 grayscale"}`} title="Español">🇪🇸</button>
            <button onClick={() => changeLang("en")} className={`text-lg leading-none ${lang === "en" ? "" : "opacity-40 grayscale"}`} title="English">🇬🇧</button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setShowSettings(false)}>
          <div className="rounded-2xl p-5 w-full max-w-xs font-body border border-white/10" style={{ background: "#26221C" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-white uppercase tracking-wide text-sm mb-4">{t("settings")}</h3>
            <label className="text-xs text-white/60 block mb-1">{t("defaultVat")}</label>
            <select
              value={settings.vat}
              onChange={(e) => setSettings({ ...settings, vat: parseFloat(e.target.value) })}
              className="w-full bg-black/20 text-white text-sm rounded px-2 py-1.5 outline-none mb-4"
              style={{ colorScheme: "dark" }}
            >
              <option value={5.5}>5.5%</option>
              <option value={10}>10% ({t("vatOption10Hint")})</option>
              <option value={20}>20%</option>
              <option value={21}>21% ({t("vatOption21Hint")})</option>
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
              {hasOrangeZone
                ? t("marginLegendWithOrange")(effectiveGreenTarget, CRITICAL_MARGIN)
                : t("marginLegendNoOrange")(CRITICAL_MARGIN)}
            </p>

            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailRemindersEnabled !== false}
                onChange={(e) => setSettings({ ...settings, emailRemindersEnabled: e.target.checked })}
                className="mt-0.5 shrink-0"
              />
              <span>
                <span className="text-xs text-white/70 block">{t("emailRemindersLabel")}</span>
                <span className="text-[10px] text-white/30 block mt-0.5">{t("emailRemindersHint")}</span>
              </span>
            </label>

            <button onClick={() => setShowSettings(false)} className="w-full text-xs font-display uppercase tracking-wide py-2 rounded border border-white/20 text-white/70 hover:border-[#8B5CF6] hover:text-[#8B5CF6]">
              {t("close")}
            </button>
            <button onClick={clearAll} className="w-full text-center mt-3 text-[11px] text-white/30 hover:text-[#B23A2E] underline">
              {t("resetData")}
            </button>
          </div>
        </div>
      )}

      {accountMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setAccountMenuOpen(false)}>
          <div className="rounded-2xl p-5 w-full max-w-xs font-body border border-white/10" style={{ background: "#26221C" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-white uppercase tracking-wide text-sm mb-4">{t("myAccount")}</h3>

            {portalErr && (
              <div className="mb-3 text-[11px] rounded-lg px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20">{portalErr}</div>
            )}
            <button
              onClick={manageSubscription}
              disabled={portalBusy}
              className="w-full text-xs font-display uppercase tracking-wide py-2.5 rounded-full flex items-center justify-center gap-2 disabled:opacity-60 mb-2"
              style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
            >
              {portalBusy && <Loader2 size={12} className="animate-spin" />}
              {t("billingManageSubscription")}
            </button>
            <button
              onClick={() => { setAccountMenuOpen(false); setContactModalOpen(true); setContactSent(false); setContactErr(null); }}
              className="w-full text-xs font-display uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70 hover:border-[#8B5CF6] hover:text-[#8B5CF6] flex items-center justify-center gap-2 mb-2"
            >
              <Mail size={12} /> {t("contactButton")}
            </button>
            {isAdmin && (
              <button
                onClick={() => { setAccountMenuOpen(false); setAdminDashboardOpen(true); }}
                className="w-full text-xs font-display uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70 hover:border-[#8B5CF6] hover:text-[#8B5CF6] flex items-center justify-center gap-2 mb-2"
              >
                <TrendingUp size={12} /> Admin
              </button>
            )}
            {!isStandaloneApp && (
              <button
                onClick={handleInstallClick}
                className={
                  installPromptReady
                    ? "w-full text-xs font-display uppercase tracking-wide py-2.5 rounded-full flex items-center justify-center gap-2 mb-2"
                    : "w-full text-xs font-display uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70 hover:border-[#8B5CF6] hover:text-[#8B5CF6] flex items-center justify-center gap-2 mb-2"
                }
                style={installPromptReady ? { background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW } : undefined}
              >
                <Smartphone size={12} /> {t("installAppButton")}
              </button>
            )}
            <button onClick={() => setAccountMenuOpen(false)} className="w-full text-xs font-display uppercase tracking-wide py-2 rounded border border-white/20 text-white/70 hover:border-[#8B5CF6] hover:text-[#8B5CF6]">
              {t("close")}
            </button>
          </div>
        </div>
      )}

      {installInstructionsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setInstallInstructionsOpen(false)}>
          <div
            className="rounded-2xl p-5 w-full max-w-xs font-body border border-white/10"
            style={{ background: "#26221C" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <Smartphone size={16} className="text-[#8B5CF6]" />
              <h3 className="font-display text-white uppercase tracking-wide text-sm">{t("installModalTitle")}</h3>
            </div>
            <InstallDiagram
              sourceIcon={isIOSDevice && !isIOSChromeDevice ? Share : MoreVertical}
              sourceLabel={isIOSDevice && !isIOSChromeDevice ? t("installDiagramShareLabel") : t("installDiagramMenuLabel")}
              targetLabel={isIOSDevice ? t("installDiagramHomeLabel") : t("installDiagramInstallLabel")}
            />
            <p className="text-white/70 text-sm mb-5">
              {isIOSChromeDevice
                ? t("installInstructionsIOSChrome")
                : isIOSDevice
                ? t("installInstructionsIOS")
                : t("installInstructionsAndroid")}
            </p>
            {!isIOSDevice && <p className="text-white/40 text-xs mb-5">{t("installInstructionsGeneric")}</p>}
            <button
              onClick={() => setInstallInstructionsOpen(false)}
              className="w-full text-xs font-display uppercase tracking-wide py-2 rounded border border-white/20 text-white/70 hover:border-[#8B5CF6] hover:text-[#8B5CF6]"
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}

      {adminDashboardOpen && isAdmin && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col print:hidden">
          <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-white/10" style={{ background: "#26221C" }}>
            <span className="text-white font-display uppercase text-sm tracking-wide">Tableau de bord</span>
            <button onClick={() => setAdminDashboardOpen(false)} className="text-white/60 hover:text-white p-1">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4" style={{ background: "#1B1815" }}>
            <AdminDashboard />
          </div>
        </div>
      )}

      <DigitalMenuModal
        open={digitalMenuOpen}
        onClose={() => setDigitalMenuOpen(false)}
        menuSettings={menuSettings}
        setMenuSettings={setMenuSettings}
        recipes={recipes}
        setRecipes={setRecipes}
        simpleItems={simpleItems}
        setSimpleItems={setSimpleItems}
        onConvertToRecipe={convertSimpleItemToRecipe}
        userId={menuUserId}
        lang={lang}
        t={t}
      />

      {contactModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setContactModalOpen(false)}>
          <div
            className="rounded-2xl p-5 w-full max-w-xs font-body border border-white/10"
            style={{ background: "#26221C" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-white uppercase tracking-wide text-sm mb-3">{t("contactModalTitle")}</h3>
            {contactSent ? (
              <>
                <p className="text-white/70 text-sm mb-5">{t("contactSuccessMessage")}</p>
                <button
                  onClick={() => setContactModalOpen(false)}
                  className="w-full text-xs font-display uppercase tracking-wide py-2 rounded border border-white/20 text-white/70 hover:border-[#8B5CF6] hover:text-[#8B5CF6]"
                >
                  {t("close")}
                </button>
              </>
            ) : (
              <>
                <p className="text-white/50 text-xs mb-3">{t("contactHint")}</p>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder={t("contactPlaceholder")}
                  rows={5}
                  className="w-full bg-black/20 text-white text-sm rounded p-2.5 outline-none mb-2"
                />

                <input ref={fileInputContactRef} type="file" accept="image/*" className="hidden" onChange={handleContactAttachment} />
                {contactAttachment ? (
                  <div className="flex items-center gap-2 mb-3 text-[11px] text-white/60 bg-black/20 rounded px-2.5 py-1.5">
                    <Paperclip size={12} className="shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{contactAttachment.fileName}</span>
                    <button onClick={() => setContactAttachment(null)} className="text-white/40 hover:text-[#EF4444] shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputContactRef.current?.click()}
                    disabled={contactAttaching}
                    className="flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white mb-3 disabled:opacity-50"
                  >
                    {contactAttaching ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                    {t("contactAttachButton")}
                  </button>
                )}

                {contactErr && (
                  <div className="mb-3 text-[11px] rounded-lg px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20">{contactErr}</div>
                )}
                <button
                  onClick={sendContactMessage}
                  disabled={contactSending || !contactMessage.trim()}
                  className="w-full text-xs font-display uppercase tracking-wide py-2.5 rounded-full flex items-center justify-center gap-2 disabled:opacity-50 mb-2"
                  style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                >
                  {contactSending && <Loader2 size={12} className="animate-spin" />}
                  {t("contactSendButton")}
                </button>
                <button
                  onClick={() => setContactModalOpen(false)}
                  className="w-full text-xs font-display uppercase tracking-wide py-2 rounded border border-white/20 text-white/70 hover:border-[#8B5CF6] hover:text-[#8B5CF6]"
                >
                  {t("close")}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setResetConfirmOpen(false)}>
          <div
            className="rounded-2xl p-5 w-full max-w-xs font-body border border-white/10"
            style={{ background: "#26221C" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3" style={{ color: TIER_COLORS.low }}>
              <AlertTriangle size={18} className="shrink-0" />
              <h3 className="font-display uppercase tracking-wide text-sm">{t("resetData")}</h3>
            </div>
            <p className="text-white/70 text-sm mb-5">{t("resetDataConfirm")}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setResetConfirmOpen(false)}
                className="flex-1 text-xs font-display uppercase tracking-wide py-2.5 rounded border border-white/20 text-white/70 hover:border-white/40"
              >
                {t("cancelLabel")}
              </button>
              <button
                onClick={performReset}
                className="flex-1 text-xs font-display uppercase tracking-wide py-2.5 rounded text-white"
                style={{ background: TIER_COLORS.low }}
              >
                {t("resetConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setBulkDeleteConfirmOpen(false)}>
          <div
            className="rounded-2xl p-5 w-full max-w-xs font-body border border-white/10"
            style={{ background: "#26221C" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3" style={{ color: TIER_COLORS.low }}>
              <AlertTriangle size={18} className="shrink-0" />
              <h3 className="font-display uppercase tracking-wide text-sm">{t("deleteSelectedButton")(selectedRecentIds.size)}</h3>
            </div>
            <p className="text-white/70 text-sm mb-5">{t("deleteSelectedConfirm")(selectedRecentIds.size)}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setBulkDeleteConfirmOpen(false)}
                className="flex-1 text-xs font-display uppercase tracking-wide py-2.5 rounded border border-white/20 text-white/70 hover:border-white/40"
              >
                {t("cancelLabel")}
              </button>
              <button
                onClick={deleteSelectedRecentIngredients}
                className="flex-1 text-xs font-display uppercase tracking-wide py-2.5 rounded text-white"
                style={{ background: TIER_COLORS.low }}
              >
                {t("resetConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {lossModalOpen && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setLossModalOpen(false)}>
          <div
            className="rounded-2xl p-5 w-full max-w-sm max-h-[80vh] flex flex-col font-body border border-white/10"
            style={{ background: "#26221C" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-white uppercase tracking-wide text-sm mb-1">{t("declareLossesTitle")}</h3>
            <p className="text-white/50 text-xs mb-4 leading-relaxed">{t("declareLossesHint")}</p>
            <div className="space-y-1.5 overflow-y-auto pr-0.5">
              {Array.from(new Map(active.lines.map((l) => [l.ingredientId, l])).keys())
                .map((ingId) => ingredientById(ingId))
                .filter(Boolean)
                .map((ing) => (
                  <div key={ing.id} className="flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ background: "#1B1815" }}>
                    <span className="flex-1 min-w-0 text-white truncate">{ingredientDisplayName(ing)}</span>
                    <NumField
                      value={ing.lossPercent || 0}
                      onChange={(v) => updateIngredientField(ing.id, "lossPercent", Math.min(Math.max(v, 0), 95))}
                      allowDecimal={false}
                      className="w-12 bg-black/30 text-white text-right outline-none rounded px-1.5 py-1"
                    />
                    <span className="text-white/40 shrink-0">%</span>
                  </div>
                ))}
            </div>
            <button
              onClick={() => setLossModalOpen(false)}
              className="w-full mt-4 text-xs font-display uppercase tracking-wide py-2 rounded border border-white/20 text-white/70 hover:border-[#8B5CF6] hover:text-[#8B5CF6] shrink-0"
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}

      {scanRecipeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 print:hidden" onClick={closeScanRecipe}>
          <div
            className="rounded-2xl p-5 w-full max-w-xl max-h-[85vh] overflow-y-auto font-body border border-white/10"
            style={{ background: "#26221C" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-white uppercase tracking-wide text-sm">{t("scanRecipeResultTitle")}</h3>
              <button onClick={closeScanRecipe} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {scanningRecipe && (
              <div className="flex flex-col items-center justify-center py-10 text-white/60 text-sm gap-3">
                <Loader2 size={26} className="animate-spin" style={{ color: BRAND_SOLID }} />
                {t("scanningRecipe")}
              </div>
            )}

            {scanRecipeErr && !scanningRecipe && (
              <div className="text-center py-6">
                <div className="text-[#B23A2E] text-sm mb-3">{t("scanError")} : {scanRecipeErr}</div>
                <button
                  onClick={() => fileInputRecipeLibraryRef.current?.click()}
                  className="text-xs uppercase tracking-wide px-3 py-1.5 rounded border border-white/20 text-white/70 hover:border-[#8B5CF6] hover:text-[#8B5CF6]"
                >
                  {t("scanRetry")}
                </button>
              </div>
            )}

            {scanRecipeResult && !scanningRecipe && (
              <div>
                <p className="text-[11px] text-white/40 mb-3">{t("scanRecipeHint")}</p>

                <label className="text-xs text-white/60 block mb-1">{t("newRecipeName")}</label>
                <input
                  value={scanRecipeResult.name}
                  onChange={(e) => updateScanRecipeField({ name: e.target.value })}
                  className="w-full bg-black/20 text-white text-sm rounded px-2.5 py-2 outline-none mb-3"
                />

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-white/60 block mb-1">{t("portions")}</label>
                    <NumField
                      allowDecimal={false}
                      value={scanRecipeResult.portions}
                      onChange={(v) => updateScanRecipeField({ portions: Math.max(v, 1) })}
                      className="w-full bg-black/20 text-white text-sm rounded px-2.5 py-2 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60 block mb-1">{t("sellPriceHT")}</label>
                    <NumField
                      value={scanRecipeResult.sellPrice}
                      onChange={(v) => updateScanRecipeField({ sellPrice: Math.max(v, 0) })}
                      className="w-full bg-black/20 text-white text-sm rounded px-2.5 py-2 outline-none"
                    />
                  </div>
                </div>

                <label className="text-xs text-white/60 block mb-1">{t("scanRecipeIngredientsLabel")}</label>
                {scanRecipeResult.lines.length === 0 && (
                  <p className="text-white/30 text-xs mb-3">{t("scanRecipeNoLines")}</p>
                )}
                <div className="space-y-2 mb-4">
                  {scanRecipeResult.lines.map((line, idx) => {
                    const guessedIng = line.guessedMatchId ? ingredients.find((i) => i.id === line.guessedMatchId) : null;
                    return (
                      <div key={idx} className="rounded-lg p-3 border border-white/10 bg-black/10">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <input
                              value={line.name}
                              onChange={(e) => updateScanRecipeLine(idx, { name: e.target.value })}
                              className="w-full bg-transparent text-white text-sm font-medium outline-none border-b border-white/10 focus:border-[#8B5CF6] pb-0.5"
                            />
                            <div className="text-[11px] text-white/45 mt-1 truncate">{line.rawText}</div>
                          </div>
                          <button
                            onClick={() => removeScanRecipeLine(idx)}
                            title={t("scanRecipeRemoveLine")}
                            className="shrink-0 text-white/25 hover:text-[#EF4444] p-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {line.impreciseQuantity && (
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle size={13} className="shrink-0" style={{ color: TIER_COLORS.mid }} />
                            <span className="text-[11px]" style={{ color: TIER_COLORS.mid }}>
                              {t("scanRecipeImpreciseWarning")(line.rawText)}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mb-2">
                          <QtyField
                            qty={line.qty || 0}
                            unit={line.unit}
                            onChange={(v) => updateScanRecipeLine(idx, { qty: v, impreciseQuantity: false })}
                            className="w-24 bg-black/20 text-white text-sm rounded px-2 py-1.5 outline-none"
                            t={t}
                          />
                          {/* Unité toujours modifiable à la main : filet de sécurité si l'unité
                              devinée (IA ou repli par catégorie) ne convient pas — signalé comme
                              bloquant par l'utilisateur en test réel (ex: cognac deviné en "g"). */}
                          <select
                            value={line.unit}
                            onChange={(e) => updateScanRecipeLine(idx, { unit: e.target.value })}
                            title={t("unitFieldLabel")}
                            className="bg-black/20 text-white text-sm rounded px-2 py-1.5 outline-none"
                            style={{ colorScheme: "dark" }}
                          >
                            <option value="kg">kg</option>
                            <option value="L">L</option>
                            <option value="pièce">{t("unitPieceLabel")}</option>
                          </select>
                        </div>

                        <ScanNameChoice
                          item={line}
                          guessedIng={guessedIng}
                          ingredientDisplayName={ingredientDisplayName}
                          onUpdate={(patch) => updateScanRecipeLine(idx, patch)}
                          t={t}
                        />
                      </div>
                    );
                  })}
                </div>

                <label className="text-xs text-white/60 block mb-1">{t("notes")}</label>
                <textarea
                  value={scanRecipeResult.notes}
                  onChange={(e) => updateScanRecipeField({ notes: e.target.value })}
                  rows={4}
                  className="w-full bg-black/20 text-white text-sm rounded p-2.5 outline-none mb-3"
                />

                <label className="text-xs text-white/60 block mb-1">{t("allergens")}</label>
                <input
                  value={scanRecipeResult.allergens}
                  onChange={(e) => updateScanRecipeField({ allergens: e.target.value })}
                  placeholder={t("allergensPlaceholder")}
                  className="w-full bg-black/20 text-white text-sm rounded px-2.5 py-2 outline-none mb-4"
                />

                <button
                  onClick={createRecipeFromScan}
                  className="w-full text-xs font-display uppercase tracking-wide py-3 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                >
                  <Check size={15} /> {t("scanRecipeCreateButton")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {scanOpen && (
        // ⚠️ Le clic à côté ne ferme PAS pendant l'analyse : un scan prend 30 à 60 secondes, et un
        // tap distrait sur le fond noir effaçait tout le résultat au moment où il arrivait — le
        // restaurateur voyait alors simplement "il ne s'est rien passé", sans aucune erreur.
        // La croix reste disponible pour annuler volontairement.
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 print:hidden" onClick={() => { if (!scanning) closeScan(); }}>
          <div
            className="rounded-2xl p-5 w-full max-w-xl max-h-[85vh] overflow-y-auto font-body border border-white/10"
            style={{ background: "#26221C" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-white uppercase tracking-wide text-sm">{t("scanResultTitle")}</h3>
              <button onClick={closeScan} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {scanPendingImage && !scanning && (
              <div className="mb-3 rounded-lg border border-white/10 overflow-hidden">
                <img src={scanImagePreview} alt="" className="w-full max-h-72 object-contain bg-black/30" />
                <div className="flex items-center gap-2 p-2.5">
                  <button
                    onClick={() => rotateScanPendingImage(-90)}
                    className="p-2 rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    onClick={() => rotateScanPendingImage(90)}
                    className="p-2 rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30"
                  >
                    <RotateCw size={16} />
                  </button>
                  <span className="text-[11px] text-white/40 flex-1">{t("scanRotateHint")}</span>
                  <button
                    onClick={() => confirmScanImage()}
                    className="text-xs font-display uppercase tracking-wide px-4 py-2 rounded-full shrink-0"
                    style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                  >
                    {t("scanAnalyzeButton")}
                  </button>
                </div>
                {/* Conseil "diviser en 2" (2026-08-25) : reflète directement ce qui a débloqué un
                    cas réel dense/flou testé par l'utilisateur (coupé en 2 photos haut/bas +
                    recadré = ça a marché, alors que la photo entière échouait). Toujours visible
                    ici, avant même de lancer l'analyse — un vrai client ne lira jamais ce conseil
                    s'il n'apparaît que dans un écran d'erreur après un premier échec. */}
                <div className="px-2.5 pb-2.5 -mt-1 flex items-start gap-1.5 text-[10px] text-white/35">
                  <Info size={11} className="shrink-0 mt-0.5" />
                  <span>{t("scanSplitTip")}</span>
                </div>
              </div>
            )}

            {scanImagePreview && !scanPendingImage && (
              <details open className="mb-3 rounded-lg border border-white/10 overflow-hidden">
                <summary className="cursor-pointer px-2.5 py-1.5 text-[11px] text-white/50 hover:text-white/80 select-none">
                  {t("scanImagePreviewLabel")}
                </summary>
                <img
                  src={scanImagePreview}
                  alt=""
                  onClick={() => setScanImageZoomed(true)}
                  className="w-full max-h-64 object-contain bg-black/30 cursor-zoom-in"
                />
              </details>
            )}

            {scanImageZoomed && scanImagePreview && (
              <div
                className="fixed inset-0 z-[60] bg-black overflow-auto"
                onClick={() => setScanImageZoomed(false)}
              >
                <img src={scanImagePreview} alt="" className="w-full h-auto" />
                <button
                  onClick={() => setScanImageZoomed(false)}
                  className="fixed top-4 right-4 text-white bg-black/60 rounded-full p-2"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {scanning && (
              <div className="flex flex-col items-center justify-center py-10 text-white/60 text-sm gap-3">
                <Loader2 size={26} className="animate-spin" style={{ color: BRAND_SOLID }} />
                <div className="text-center">
                  <div>{t("scanning")}</div>
                  {scanStep && <div className="text-white/35 text-[11px] mt-1">{t(`scanStep_${scanStep}`)}</div>}
                  <div className="text-white/25 text-[11px] mt-2">{t("scanningPatience")}</div>
                </div>
              </div>
            )}

            {/* Écran d'erreur repensé (2026-08-24) : plus jamais un message technique brut. Trois
                choses systématiquement présentes — ce qui s'est passé, quoi faire concrètement, et
                un moyen de nous joindre en un tap sans quitter l'app. Objectif explicite : qu'un
                restaurateur bloqué à son premier scan ne reparte pas en silence. */}
            {scanErr && !scanning && (
              <div className="py-2">
                <div className="rounded-xl p-4 mb-3" style={{ background: `${TIER_COLORS.low}14`, border: `1px solid ${TIER_COLORS.low}40` }}>
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: TIER_COLORS.low }} />
                    <div className="min-w-0">
                      <div className="text-white font-semibold text-sm mb-1">{t(`scanErrTitle_${scanErrCode}`)}</div>
                      <div className="text-white/60 text-xs leading-relaxed">{t(`scanErrBody_${scanErrCode}`)}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="text-white/50 text-[11px] uppercase tracking-wide font-display mb-1.5">{t("scanErrWhatToDo")}</div>
                  <ul className="text-white/70 text-xs leading-relaxed space-y-1">
                    {t(`scanErrTips_${scanErrCode}`).map((tip, i) => (
                      <li key={i} className="flex gap-2">
                        <span style={{ color: BRAND_SOLID }}>•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={retryLastScan}
                    className="w-full text-xs font-display uppercase tracking-wide py-3 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                  >
                    <RefreshCw size={14} /> {lastScanImage ? t("scanRetrySamePhoto") : t("scanRetry")}
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputLibraryRef.current?.click()}
                      className="flex-1 text-[11px] uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70 hover:border-[#8B5CF6] hover:text-[#8B5CF6]"
                    >
                      {t("scanRetryOtherFile")}
                    </button>
                    <button
                      onClick={() => reportScanProblem()}
                      className="flex-1 text-[11px] uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70 hover:border-[#8B5CF6] hover:text-[#8B5CF6]"
                    >
                      {t("scanReportProblem")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {scanResult && !scanning && (
              <div>
                <div className="text-xs text-white/50 mb-3 flex flex-wrap gap-x-4 gap-y-1">
                  <span>{t("scanSupplier")}: <span className="text-white/80">{scanResult.supplier || "—"}</span></span>
                  <span>{t("scanDate")}: <span className="text-white/80">{scanResult.date || "—"}</span></span>
                </div>
                <p className="text-[11px] text-white/40 mb-3">{t("scanHint")}</p>

                {scanResult.manyUp && (
                  <div className="flex items-start gap-2 rounded-lg p-2.5 mb-3 text-xs" style={{ background: `${TIER_COLORS.low}18`, color: TIER_COLORS.low }}>
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    {t("scanManyUpWarning")}
                  </div>
                )}

                {/* Bandeau discret, jamais bloquant : juste un avertissement, l'utilisateur reste
                    libre d'importer — la vraie protection reste le triangle orange par ligne. */}
                {scanResult.manyLowConfidence && (
                  <div className="flex items-start gap-2 rounded-lg p-2.5 mb-3 text-xs" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    {t("scanLowConfidenceBanner")}
                  </div>
                )}

                {scanResult.excludedItems && scanResult.excludedItems.length > 0 && (
                  <div className="rounded-lg p-2.5 mb-3 text-[11px]" style={{ background: "#26221C", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <div className="text-white/50">{t("scanNonFoodExcluded")(scanResult.excludedItems.length)}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {scanResult.excludedItems.map((nf, i) => (
                        <button
                          key={i}
                          onClick={() => restoreExcludedItem(i)}
                          className="text-[10px] px-2 py-1 rounded-full text-white/50 hover:text-white flex items-center gap-1"
                          style={{ background: "rgba(255,255,255,0.06)" }}
                          title={nf.excludeReason === "deposit" ? t("scanRestoreDeposit") : t("scanRestoreNonFood")}
                        >
                          {nf.name} <Plus size={10} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {scanResult.items.length === 0 ? (
                  // Cas très fréquent d'abandon : le document a bien été analysé mais rien n'en est
                  // ressorti. Avant, une seule phrase grise, aucun bouton — l'utilisateur devait
                  // deviner qu'il pouvait réessayer. Désormais : explication + conseils concrets +
                  // les mêmes boutons que l'écran d'erreur (renvoyer la photo, autre fichier, nous
                  // écrire), pour qu'il ne reste jamais dans une impasse.
                  <div className="py-2">
                    <div className="text-white/60 text-sm leading-relaxed mb-3">{t("scanNoItems")}</div>
                    <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="text-white/50 text-[11px] uppercase tracking-wide font-display mb-1.5">{t("scanErrWhatToDo")}</div>
                      <ul className="text-white/70 text-xs leading-relaxed space-y-1">
                        {t("scanNoItemsTips").map((tip, i) => (
                          <li key={i} className="flex gap-2">
                            <span style={{ color: BRAND_SOLID }}>•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={retryLastScan}
                        className="w-full text-xs font-display uppercase tracking-wide py-3 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform"
                        style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                      >
                        <RefreshCw size={14} /> {lastScanImage ? t("scanRetrySamePhoto") : t("scanRetry")}
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => fileInputLibraryRef.current?.click()}
                          className="flex-1 text-[11px] uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70 hover:border-[#8B5CF6] hover:text-[#8B5CF6]"
                        >
                          {t("scanRetryOtherFile")}
                        </button>
                        <button
                          onClick={() => reportScanProblem("no_items")}
                          className="flex-1 text-[11px] uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70 hover:border-[#8B5CF6] hover:text-[#8B5CF6]"
                        >
                          {t("scanReportProblem")}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  (() => {
                    const withIdx = scanResult.items.map((item, idx) => ({ item, idx }));
                    const pending = withIdx.filter(({ item }) => !item.imported && !item.skipped);
                    const done = withIdx.filter(({ item }) => item.imported);
                    const skipped = withIdx.filter(({ item }) => item.skipped && !item.imported);
                    const review = pending.filter(({ item }) => !isReadyToImport(item));
                    const safe = pending.filter(({ item }) => isReadyToImport(item));
                    const renderCard = ({ item, idx }) => (
                      <ScanItemCard
                        key={idx}
                        item={item}
                        onUpdate={(patch) => updateScanItem(idx, patch)}
                        onImport={() => importScanItem(idx)}
                        onSkip={() => skipScanItem(idx)}
                        ingredients={ingredients}
                        ingredientDisplayName={ingredientDisplayName}
                        lang={lang}
                        t={t}
                        skipMuted
                      />
                    );

                    // ---- Mode pile : un produit à vérifier à la fois ----
                    if (reviewStackOpen) {
                      if (review.length === 0) {
                        return (
                          <div className="text-center py-10">
                            <div className="text-white text-base font-semibold mb-1">{t("scanAllReviewed")}</div>
                            <div className="text-white/50 text-xs mb-4">{t("scanAllReviewedDetail")}</div>
                            <button
                              onClick={() => setReviewStackOpen(false)}
                              className="text-xs uppercase tracking-wide px-4 py-2 rounded-full font-semibold"
                              style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                            >
                              {t("scanContinue")}
                            </button>
                          </div>
                        );
                      }
                      const current = review[0];
                      const upcoming = review.slice(1, 4);
                      const isExpanded = expandedReviewIdx === current.idx;
                      const matchedIng = current.item.assignTo !== "new" ? ingredientById(current.item.assignTo) : null;
                      const guessedIng = current.item.guessedMatchId ? ingredientById(current.item.guessedMatchId) : null;
                      const needsRename = current.item.assignTo !== "new" && current.item.name && matchedIng && ingredientDisplayName(matchedIng) !== current.item.name;
                      return (
                        <div>
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1.5 gap-2">
                              <span className="text-sm text-white font-bold font-mono shrink-0">
                                {t("scanStackProgress")(stackTotal - review.length + 1, stackTotal)}
                              </span>
                              <div className="flex items-center gap-3 shrink-0">
                                <button onClick={skipAllPendingAndClose} className="text-[11px] text-white/40 hover:text-[#B23A2E] underline whitespace-nowrap">
                                  {t("scanSkipAllAndClose")}
                                </button>
                                <button onClick={() => setReviewStackOpen(false)} className="text-[11px] text-white/40 underline">
                                  {t("close")}
                                </button>
                              </div>
                            </div>
                            {/* Barre de progression bien visible — avant ce correctif, seul un
                                petit "1/16" discret indiquait où on en était, repéré comme pas
                                assez visible par l'utilisateur (2026-08). */}
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${((stackTotal - review.length) / stackTotal) * 100}%`, background: BRAND_GRADIENT }}
                              />
                            </div>
                          </div>

                          {/* Effet de pile de cartes plus marqué (demande explicite de l'utilisateur,
                              2026-08 : "j'imagine les cartes suivantes en arrière-plan de manière
                              jolie") — jusqu'à 3 cartes visibles derrière au lieu de 2, décalage et
                              ombre plus prononcés pour bien donner l'impression d'une pile. */}
                          <div className="relative" style={{ minHeight: isExpanded ? "auto" : "230px" }}>
                            {!isExpanded &&
                              upcoming.map(({ item: uItem }, i) => (
                                <div
                                  key={i}
                                  className="absolute inset-x-0 rounded-2xl border border-white/10 px-4 py-3 pointer-events-none"
                                  style={{
                                    background: "#26221C",
                                    top: `${(i + 1) * 14}px`,
                                    transform: `scale(${1 - (i + 1) * 0.045})`,
                                    opacity: 0.6 - i * 0.18,
                                    zIndex: 10 - i,
                                    boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
                                  }}
                                >
                                  <div className="text-white/60 text-sm truncate">{uItem.name}</div>
                                </div>
                              ))}

                            <div className="relative" style={{ zIndex: 20 }}>
                              {isExpanded ? (
                                <div>
                                  <button
                                    onClick={() => setExpandedReviewIdx(null)}
                                    className="w-full mb-2 text-xs uppercase tracking-wide py-2.5 rounded-full border border-white/25 text-white/80 font-semibold"
                                  >
                                    {t("scanBackToCard")}
                                  </button>
                                  <ScanItemCard
                                    item={current.item}
                                    onUpdate={(patch) => updateScanItem(current.idx, patch)}
                                    onImport={() => importScanItem(current.idx)}
                                    ingredients={ingredients}
                                    ingredientDisplayName={ingredientDisplayName}
                                    lang={lang}
                                    t={t}
                                    startExpanded
                                  />
                                </div>
                              ) : (
                                <div
                                  className="rounded-xl border p-4"
                                  style={{ background: "#1B1815", borderColor: `${TIER_COLORS.mid}80` }}
                                >
                                  {/* Avant ce correctif, tout ce qui n'était pas "nouveau" affichait le
                                      même badge orange "à vérifier" — un rapprochement pourtant confiant
                                      (score quasi parfait) et un rapprochement douteux (cas réel :
                                      "haricot" confondu avec "abricot") se ressemblaient à l'écran,
                                      alors que ce sont deux niveaux de confiance très différents.
                                      Distinction demandée explicitement par l'utilisateur, 2026-08. */}
                                  <span
                                    className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full font-semibold"
                                    style={{
                                      color: current.item.assignTo === "new" ? "#3B82F6" : current.item.matchConfident ? TIER_COLORS.high : TIER_COLORS.mid,
                                      background: current.item.assignTo === "new" ? "#3B82F622" : current.item.matchConfident ? `${TIER_COLORS.high}22` : `${TIER_COLORS.mid}22`,
                                    }}
                                  >
                                    {current.item.assignTo === "new" ? (
                                      <Plus size={10} />
                                    ) : current.item.matchConfident ? (
                                      <Check size={10} />
                                    ) : (
                                      <AlertTriangle size={10} />
                                    )}
                                    {current.item.assignTo === "new"
                                      ? t("scanNewIngredient")
                                      : current.item.matchConfident
                                      ? t("scanLinkedSure")
                                      : t("scanLinkedGuess")}
                                  </span>

                                  {/* Texte facture visible dès le premier coup d'œil (pas besoin d'ouvrir
                                      "Modifier"), débarrassé seulement du code fournisseur. Modifiable pour
                                      corriger une erreur de lecture — ça n'affecte jamais le nom d'ingrédient
                                      ni le matching, uniquement la mémoire des rapprochements pour ce texte. */}
                                  <div className="flex items-center gap-1 mt-1.5 min-w-0">
                                    <span className="text-[9px] uppercase tracking-wide text-white/25 shrink-0">{t("scanRawLabelPrefix")}</span>
                                    <input
                                      value={lightRawLabel(current.item.rawLabel)}
                                      onChange={(e) => updateScanItem(current.idx, { rawLabel: e.target.value })}
                                      className="flex-1 min-w-0 bg-transparent text-white/45 text-[11px] outline-none focus:text-white/80"
                                    />
                                  </div>

                                  {/* Nom toujours modifiable ici, bien visible — avant ce correctif,
                                      dès qu'un rapprochement existait, seul le choix "garder/renommer/
                                      créer séparément" était affiché, sans moyen évident de corriger le
                                      texte lui-même si l'IA s'est trompée (cas réel utilisateur :
                                      "Orange à jus" proposé au lieu de "Orange dessert" — pas trouvé
                                      "instinctivement" comment corriger). Éditer ce champ met aussi à
                                      jour en direct les options "renommer"/"créer séparément" juste en
                                      dessous, qui affichent toujours ce même nom. */}
                                  <div className="flex items-center gap-1.5 mt-2 rounded-lg px-2.5 py-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                                    <Pencil size={13} className="text-white/30 shrink-0" />
                                    <input
                                      value={current.item.name || ""}
                                      onChange={(e) => updateScanItem(current.idx, { name: e.target.value })}
                                      className="flex-1 min-w-0 bg-transparent text-white text-base font-semibold outline-none"
                                    />
                                  </div>

                                  {guessedIng && (
                                    <div className="mt-2">
                                      <ScanNameChoice
                                        item={current.item}
                                        guessedIng={guessedIng}
                                        ingredientDisplayName={ingredientDisplayName}
                                        onUpdate={(patch) => updateScanItem(current.idx, patch)}
                                        t={t}
                                      />
                                    </div>
                                  )}

                                  {/* Variation de prix par rapport au dernier prix connu — absente de
                                      cette carte avant ce correctif (visible seulement dans la liste
                                      groupée), demandée explicitement par l'utilisateur (2026-08).
                                      Affichée sur CHAQUE ligne ayant un prix de référence, même à 0%
                                      (pas seulement les vraies variations) : sinon l'absence de badge
                                      donne l'impression fausse qu'une ligne n'a pas été comparée du
                                      tout — même correctif que la carte compacte, même demande. */}
                                  {/* priceComparisonValid (2026-08-25) : voir ScanItemCard, même
                                      garde-fou contre une comparaison entre deux unités différentes. */}
                                  {current.item.currentPrice !== null && current.item.currentPriceIsReal && current.item.priceComparisonValid !== false && (
                                    <div
                                      className="flex items-center gap-1 text-[11px] font-bold mt-1.5"
                                      style={{ color: priceChangeVisual(current.item).color }}
                                    >
                                      {priceChangeVisual(current.item).up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                      {Math.round((Math.abs((current.item.unitPriceHT || 0) - current.item.currentPrice) / current.item.currentPrice) * 100)}%
                                      <span className="text-white/35 font-normal">
                                        ({current.item.currentPrice.toFixed(2)}€ → {(current.item.unitPriceHT || 0).toFixed(2)}€)
                                      </span>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 mt-2 rounded-lg px-2.5 py-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                                    <NumField
                                      value={current.item.unitPriceHT || 0}
                                      onChange={(v) => updateScanItem(current.idx, { unitPriceHT: v })}
                                      className="flex-1 min-w-0 bg-transparent text-white text-base font-semibold text-right outline-none border-b border-white/15 focus:border-[#8B5CF6]"
                                    />
                                    <span className="text-white/50 text-sm shrink-0">€/{unitDisplayLabel(current.item.unit, t)}</span>
                                    <button
                                      onClick={() => setExpandedReviewIdx(current.idx)}
                                      className="shrink-0 flex items-center gap-1 px-3 h-10 rounded-lg text-xs text-white/70 font-semibold active:scale-95 transition-transform"
                                      style={{ background: "rgba(255,255,255,0.08)" }}
                                      title={t("scanModify")}
                                    >
                                      <Pencil size={14} /> {t("scanModify")}
                                    </button>
                                  </div>

                                  {current.item.pricingUnknown && (
                                    <div className="mt-3">
                                      <PricingCalculator item={current.item} onUpdate={(patch) => updateScanItem(current.idx, patch)} t={t} />
                                    </div>
                                  )}

                                  {current.item.priceInconsistent && (
                                    <div className="flex items-center gap-1.5 text-[11px] rounded px-2 py-1.5 mt-3" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
                                      <AlertTriangle size={11} className="shrink-0" /> {t("scanPriceInconsistent")}
                                    </div>
                                  )}

                                  {current.item.lowConfidence && (
                                    <div className="flex items-center gap-1.5 text-[11px] rounded px-2 py-1.5 mt-3" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
                                      <AlertTriangle size={11} className="shrink-0" /> {t("scanLowConfidence")}
                                    </div>
                                  )}

                                  {current.item.unitChangeAffectsRecipes && (
                                    <div className="flex items-center gap-1.5 text-[11px] rounded px-2 py-1.5 mt-3" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
                                      <AlertTriangle size={11} className="shrink-0" /> {t("scanUnitChangeWarning")(current.item.previousUnit, current.item.unit)}
                                    </div>
                                  )}

                                  {/* Ton neutre volontaire (pas d'orange d'alerte) : un gros écart de
                                      prix n'est pas une erreur détectée, juste un écart qui mérite un
                                      coup d'œil — voir la même note dans ScanItemCard. */}
                                  {current.item.bigChange && !current.item.priceInconsistent && !current.item.lowConfidence && (
                                    <div className="flex items-center gap-1.5 text-[11px] rounded px-2 py-1.5 mt-3 text-white/55" style={{ background: "rgba(255,255,255,0.06)" }}>
                                      <Info size={11} className="shrink-0" /> {t("scanBigChangeNote")}
                                    </div>
                                  )}

                                  <div className="mt-3 text-[11px] text-white/45 italic border-t border-white/5 pt-2">
                                    {current.item.assignTo === "new"
                                      ? t("scanSummaryNew")(current.item.name || "?", (current.item.unitPriceHT || 0).toFixed(2), current.item.unit)
                                      : t("scanSummaryUpdate")(
                                          needsRename && current.item.renameOnImport ? current.item.name : ingredientDisplayName(matchedIng),
                                          (current.item.unitPriceHT || 0).toFixed(2),
                                          current.item.unit
                                        )}
                                  </div>

                                  {/* Boutons agrandis (cible tactile testée sur téléphone), demande
                                      explicite de l'utilisateur, 2026-08. */}
                                  <div className="flex gap-2 mt-3">
                                    <button
                                      onClick={() => skipScanItem(current.idx)}
                                      className="flex-1 text-xs uppercase tracking-wide py-3.5 rounded-full font-bold border-2 active:scale-95 transition-transform"
                                      style={{ borderColor: "rgba(239,68,68,0.5)", color: "#EF4444" }}
                                    >
                                      {t("scanSkip")}
                                    </button>
                                    <button
                                      onClick={() => updateScanItem(current.idx, { reviewed: true })}
                                      className="flex-1 text-xs uppercase tracking-wide py-3.5 rounded-full font-bold active:scale-95 transition-transform"
                                      style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                                    >
                                      {t("scanValidate")}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // ---- Mode normal : bouton d'entrée dans la pile + liste des lignes sûres ----
                    return (
                      <div className="space-y-4">
                        {review.length > 0 && (
                          <button
                            onClick={() => {
                              setReviewStackOpen(true);
                              setStackTotal(review.length);
                              setExpandedReviewIdx(null);
                            }}
                            className="w-full rounded-xl p-4 text-left flex items-center justify-between gap-2"
                            style={{ background: `${TIER_COLORS.mid}18`, border: `1px solid ${TIER_COLORS.mid}50` }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <AlertTriangle size={16} color={TIER_COLORS.mid} className="shrink-0" />
                              <span className="text-sm font-semibold truncate" style={{ color: TIER_COLORS.mid }}>
                                {t("scanItemsToReview")(review.length)}
                              </span>
                            </div>
                            <span className="text-[10px] uppercase tracking-wide px-3 py-1.5 rounded-full font-semibold shrink-0" style={{ background: TIER_COLORS.mid, color: "#000" }}>
                              {t("scanVerifyOneByOne")}
                            </span>
                          </button>
                        )}
                        {safe.length > 0 && (
                          <div>
                            <div className="text-[11px] uppercase tracking-widest mb-1 flex items-center gap-1.5 font-semibold" style={{ color: "#10B981" }}>
                              <Check size={12} /> {t("scanSafeSection")} ({safe.length})
                            </div>
                            <div className="text-[11px] text-white/40 mb-2">{t("scanSafeHint")}</div>
                            <div className="space-y-2">{safe.map(renderCard)}</div>
                          </div>
                        )}
                        {skipped.length > 0 && (
                          <div>
                            <div className="text-[11px] uppercase tracking-widest mb-2 text-white/30 font-semibold">
                              {t("scanSkippedSection")} ({skipped.length})
                            </div>
                            <div className="space-y-1">
                              {skipped.map(({ item, idx }) => (
                                <div key={idx} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 opacity-50" style={{ background: "#1B1815" }}>
                                  <span className="text-white/60 text-xs truncate">{item.name}</span>
                                  <button onClick={() => unskipScanItem(idx)} className="text-[10px] text-white/40 hover:text-[#8B5CF6] underline shrink-0">
                                    {t("scanUndoSkip")}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {done.length > 0 && (
                          <div>
                            <div className="text-[11px] uppercase tracking-widest mb-2 flex items-center gap-1.5 font-semibold text-white/40">
                              <Check size={12} /> {t("scanDoneSection")} ({done.length})
                            </div>
                            <div className="space-y-2">{done.map(renderCard)}</div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}

                {scanResult.items.length > 0 && !reviewStackOpen && (
                  <button
                    onClick={importAllScanItems}
                    className="mt-4 w-full text-xs font-display uppercase tracking-wide py-2 rounded"
                    style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                  >
                    {t("scanImportAll")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {allergenSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={() => setAllergenSheetOpen(false)}>
          <div
            className="rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto font-body border border-white/10"
            style={{ background: "#26221C" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-white uppercase tracking-wide text-sm">{t("allergenSheetTitle")}</h3>
              <button onClick={() => setAllergenSheetOpen(false)} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="allergen-sheet rounded-sm p-5" style={{ background: "#F3EBDA", color: "#2B2620" }}>
              <div className="flex items-center gap-1.5 mb-3">
                <Logo size={16} />
                <span className="font-display uppercase tracking-widest text-[10px]" style={{ color: BRAND_SOLID_PAPER }}>{t("appTitle")}</span>
              </div>
              <h1 className="font-display text-lg uppercase tracking-wide mb-0.5">{t("allergenSheetTitle")}</h1>
              <p className="text-xs opacity-50 mb-4">{today()}</p>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(43,38,32,0.15)" }}>
                <div
                  className="grid grid-cols-[1fr_1.3fr] text-[9px] uppercase tracking-wide font-bold px-3 py-2"
                  style={{ background: "rgba(43,38,32,0.08)" }}
                >
                  <span>{t("recipeCol")}</span>
                  <span>{t("allergens")}</span>
                </div>
                {recipes.map((r, i) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-[1fr_1.3fr] gap-2 px-3 py-2 text-sm"
                    style={{ background: i % 2 ? "rgba(43,38,32,0.035)" : "transparent", borderTop: "1px solid rgba(43,38,32,0.1)" }}
                  >
                    <span className="font-medium">{r.name}</span>
                    <span className="opacity-70 text-xs">{r.allergens || t("allergenSheetNone")}</span>
                  </div>
                ))}
                {recipes.length === 0 && <div className="text-sm text-center py-6 opacity-40">{t("noRecipeYet")}</div>}
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full mt-5 text-xs font-display uppercase tracking-wide py-2.5 rounded-full font-semibold flex items-center justify-center gap-1.5"
              style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
            >
              <Printer size={13} /> {t("print")}
            </button>
          </div>
        </div>
      )}

      {addWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 print:hidden" onClick={closeAddWizard}>
          <div
            className="rounded-2xl p-5 w-full max-w-sm font-body border border-white/10 overflow-hidden"
            style={{ background: "#26221C" }}
            onClick={(e) => e.stopPropagation()}
          >
            {wizardStep !== "success" && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1">
                  {[...Array(wizardEditId ? 2 : 3)].map((_, idx) => {
                    const s = idx + 1;
                    return (
                      <span
                        key={s}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: s <= wizardStep ? BRAND_SOLID : "rgba(255,255,255,0.15)" }}
                      />
                    );
                  })}
                </div>
                <button onClick={closeAddWizard} className="text-white/50 hover:text-white">
                  <X size={18} />
                </button>
              </div>
            )}

            {wizardStep === 1 && (
              <div key="step1" style={{ animation: "wizardStepIn 0.25s ease" }}>
                <h3 className="font-display text-white uppercase tracking-wide text-sm mb-3">{t("wizardStep1Title")}</h3>
                <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 border border-white/10 mb-2" style={{ background: "#1B1815" }}>
                  <Search size={13} className="text-white/40 shrink-0" />
                  <input
                    autoFocus
                    value={wizardQuery}
                    onChange={(e) => setWizardQuery(e.target.value)}
                    placeholder={t("searchPlaceholder")}
                    className="w-full bg-transparent text-white text-sm outline-none min-w-0"
                    onKeyDown={(e) => { if (e.key === "Enter" && wizardQuery.trim()) pickWizardCustom(wizardQuery.trim()); }}
                  />
                </div>
                {!wizardQuery.trim() && (
                  <p className="text-white/30 text-xs px-1 py-3">{t("wizardSearchHint")}</p>
                )}
                {wizardQuery.trim() && (
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10" style={{ background: "#1B1815" }}>
                    {wizardExistingSuggestions.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-[#8B5CF6]/80">{t("wizardExistingSection")}</div>
                        {wizardExistingSuggestions.map((ing) => {
                          const sup = activeSupplier(ing);
                          return (
                            <button
                              key={ing.id}
                              onClick={() => pickWizardExisting(ing)}
                              className="w-full text-left px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 flex items-center justify-between border-b border-white/5 last:border-0"
                            >
                              <span className="truncate">{ingredientDisplayName(ing)}</span>
                              <span className="text-[10px] text-white/40 shrink-0 ml-2">{(sup?.price || 0).toFixed(2)}€ / {unitDisplayLabel(ing.unit, t)}</span>
                            </button>
                          );
                        })}
                      </>
                    )}
                    {wizardCatalogSuggestions.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-white/30 border-t border-white/5">{t("wizardCatalogSection")}</div>
                        {wizardCatalogSuggestions.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => pickWizardCatalog(c)}
                            className="w-full text-left px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 flex items-center justify-between border-b border-white/5 last:border-0"
                          >
                            <span>{c[lang]}</span>
                            <span className="text-[10px] text-white/30">{normUnit(c.unit)}</span>
                          </button>
                        ))}
                      </>
                    )}
                    <button
                      onClick={() => pickWizardCustom(wizardQuery.trim())}
                      className="w-full text-left px-3 py-2.5 text-xs text-[#8B5CF6] hover:bg-white/10 border-t border-white/10"
                    >
                      {t("createCustom")(wizardQuery.trim())}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Catégorie AVANT le prix (et seulement quand elle n'est pas déjà connue via le
                catalogue ou un ingrédient existant) : deviner la catégorie à partir du nom seul
                a été jugé trop fragile ("filet" = viande, poisson ou volaille selon le cas) —
                mieux vaut la demander explicitement une fois, plutôt que de deviner mal. */}
            {wizardStep === 2 && !wizardEditId && (
              <div key="step2" style={{ animation: "wizardStepIn 0.25s ease" }}>
                <h3 className="font-display text-white uppercase tracking-wide text-sm mb-3">{t("wizardCategoryStepTitle")}</h3>
                <div className="grid grid-cols-2 gap-2 mb-4 max-h-56 overflow-y-auto">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setWizardData((d) => ({ ...d, category: c.id }))}
                      className="rounded-xl py-3 px-2 text-xs font-semibold border-2 transition"
                      style={{
                        borderColor: wizardData.category === c.id ? BRAND_SOLID : "rgba(255,255,255,0.12)",
                        background: wizardData.category === c.id ? `${BRAND_SOLID}22` : "#1B1815",
                        color: wizardData.category === c.id ? BRAND_SOLID : "rgba(255,255,255,0.6)",
                      }}
                    >
                      {c[lang]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setWizardStep(1)} className="flex-1 text-xs uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70">
                    {t("wizardBack")}
                  </button>
                  <button onClick={() => setWizardStep(3)} className="flex-1 text-xs uppercase tracking-wide py-2.5 rounded-full font-semibold" style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}>
                    {t("wizardNext")}
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div key="step3" style={{ animation: "wizardStepIn 0.25s ease" }}>
                <h3 className="font-display text-white uppercase tracking-wide text-sm mb-1">{t("wizardPriceStepTitle")}</h3>
                <p className="text-white/40 text-xs mb-4 truncate">{wizardData.name}</p>
                <div className="flex items-center gap-2 rounded-xl px-3 py-3 border border-white/10 mb-1.5" style={{ background: "#1B1815" }}>
                  <NumField
                    value={wizardData.price}
                    onChange={(v) => setWizardData((d) => ({ ...d, price: v, isEstimate: false }))}
                    className="flex-1 min-w-0 bg-transparent text-white text-xl font-bold text-center outline-none"
                  />
                  <span className="text-white/40 text-sm shrink-0">€ / {unitDisplayLabel(wizardData.unit, t)}</span>
                </div>
                {/* Pour tester une recette sans être bloqué par un prix qu'on n'a pas sous les
                    yeux — remplit un prix placeholder clairement marqué "estimé" (même badge
                    que priceSource "estimate" ailleurs dans l'app), à corriger plus tard. */}
                <button
                  type="button"
                  onClick={() => setWizardData((d) => ({ ...d, price: CATEGORY_ESTIMATE_PRICE[d.category] || 5, isEstimate: true }))}
                  className="w-full text-left text-[11px] mb-4 flex items-center gap-1.5"
                  style={{ color: TIER_COLORS.mid }}
                >
                  <AlertTriangle size={11} className="shrink-0" /> {t("wizardEstimatePrice")}
                </button>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {["kg", "L", "pièce"].map((u) => (
                    <button
                      key={u}
                      onClick={() => setWizardData((d) => ({ ...d, unit: u }))}
                      className="rounded-xl py-3 text-sm font-bold border-2 transition"
                      style={{
                        borderColor: wizardData.unit === u ? BRAND_SOLID : "rgba(255,255,255,0.12)",
                        background: wizardData.unit === u ? `${BRAND_SOLID}22` : "#1B1815",
                        color: wizardData.unit === u ? BRAND_SOLID : "rgba(255,255,255,0.6)",
                      }}
                    >
                      {unitDisplayLabel(u, t)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setWizardStep(!wizardEditId && !wizardData.catalogId ? 2 : 1)}
                    className="flex-1 text-xs uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70"
                  >
                    {t("wizardBack")}
                  </button>
                  <button
                    onClick={() => (wizardEditId ? finalizeEditWizard() : finalizeWizard())}
                    className="flex-1 text-xs uppercase tracking-wide py-2.5 rounded-full font-semibold"
                    style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                  >
                    {wizardEditId ? t("wizardSave") : t("wizardCreate")}
                  </button>
                </div>
              </div>
            )}

            {wizardStep === "success" && (
              <div key="success" className="flex flex-col items-center py-6" style={{ animation: "wizardStepIn 0.3s ease" }}>
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                  style={{ background: BRAND_GRADIENT, animation: "successPop 0.4s ease" }}
                >
                  <Check size={30} color="#fff" />
                </div>
                <div className="text-white text-sm font-semibold truncate max-w-full">{wizardData.name}</div>
                <div className="text-white/40 text-xs mt-1">{wizardEditId ? t("wizardUpdated") : t("wizardSuccess")}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-5 w-full pb-28">
        {/* ---------------- ONGLET RECETTES ---------------- */}
        {activeTab === "recipes" && recipeSubView === "list" && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Logo size={18} />
              <span className="font-display text-white/50 text-[11px] uppercase tracking-widest">{t("appTitle")}</span>
            </div>
            <h1 className="font-display text-white text-xl mb-5">{t("greeting")}</h1>

            {/* Bandeau "Installer l'app" (2026-08-23) : visible dès l'écran d'accueil, pas juste
                enfoui dans "Mon compte" — demandé explicitement par l'utilisateur, qui trouvait
                l'ancien emplacement pas assez visible. Discret et ignorable (juste une croix). */}
            {!isStandaloneApp && !installBannerDismissed && (
              <div className="flex items-center gap-2.5 mb-4 rounded-xl pl-3 pr-2 py-2.5 border border-white/10" style={{ background: "#26221C" }}>
                <div className="relative shrink-0">
                  <Smartphone size={16} className="text-[#8B5CF6]" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-ping" style={{ background: "#22D3EE" }} />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: "#22D3EE" }} />
                </div>
                <span className="text-white/70 text-xs flex-1 leading-snug">{t("installBannerText")}</span>
                <button
                  onClick={handleInstallClick}
                  className="text-[11px] font-display uppercase tracking-wide px-3 py-1.5 rounded-full shrink-0 active:scale-95 transition-transform"
                  style={{ background: BRAND_GRADIENT, color: "#fff" }}
                >
                  {t("installAppButton")}
                </button>
                <button onClick={dismissInstallBanner} className="text-white/30 hover:text-white/60 shrink-0 p-1" title={t("close")}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Message d'accueil orienté action, distinct du rappel plus tardif dans l'onglet
                garde-manger (celui-ci parle de "prix estimé", un terme que le tout premier
                utilisateur ne connaît pas encore) — demandé explicitement par l'utilisateur : la
                toute première chose vue doit dire quoi faire, pas juste constater un état. */}
            {ingredients.length > 0 && ingredients.every((i) => activeSupplier(i)?.priceSource === "estimate") && (
              <div className="rounded-2xl p-4 mb-5 border border-white/10" style={{ background: "#26221C" }}>
                <p className="text-white/70 text-sm leading-relaxed mb-3">{t("welcomeBannerText")}</p>
                <button
                  onClick={() => setActiveTab("scanner")}
                  className="w-full text-xs font-display uppercase tracking-wide py-2.5 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                >
                  <Camera size={14} /> {t("welcomeBannerButton")}
                </button>
              </div>
            )}

            <input
              ref={fileInputRecipeLibraryRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleScanRecipeFile}
            />
            <div className="flex items-center justify-between mb-4 flex-wrap gap-y-2">
              <h2 className="font-display text-white/90 uppercase text-sm tracking-widest">{t("recipes")}</h2>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <div className="flex items-center rounded-full border border-white/15 overflow-hidden shrink-0">
                  <button
                    onClick={() => { setRecipeListLayout("list"); try { localStorage.setItem("chefup:recipeListLayout", "list"); } catch {} }}
                    title={t("recipeListViewTooltip")}
                    className="p-1.5 transition-colors"
                    style={recipeListLayout === "list" ? { background: BRAND_GRADIENT, color: "#fff" } : { color: "rgba(255,255,255,0.5)" }}
                  >
                    <List size={13} />
                  </button>
                  <button
                    onClick={() => { setRecipeListLayout("grid"); try { localStorage.setItem("chefup:recipeListLayout", "grid"); } catch {} }}
                    title={t("recipeGridViewTooltip")}
                    className="p-1.5 transition-colors"
                    style={recipeListLayout === "grid" ? { background: BRAND_GRADIENT, color: "#fff" } : { color: "rgba(255,255,255,0.5)" }}
                  >
                    <LayoutGrid size={13} />
                  </button>
                </div>
                <button
                  onClick={() => setAllergenSheetOpen(true)}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/60 hover:text-white px-3 py-1.5 rounded-full border border-white/15 hover:border-white/30 transition-colors"
                >
                  <ShieldCheck size={12} />
                  {t("allergenSheetLink")}
                </button>
                <button
                  onClick={() => setDigitalMenuOpen(true)}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/60 hover:text-white px-3 py-1.5 rounded-full border border-white/15 hover:border-white/30 transition-colors"
                >
                  <QrCode size={12} />
                  {t("digitalMenuButton")}
                </button>
                <button
                  onClick={addRecipe}
                  className="flex items-center gap-1 text-xs font-display uppercase tracking-wide px-3 py-1.5 rounded-full active:scale-95 transition-transform"
                  style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                >
                  <Plus size={14} /> {t("newRecipe")}
                </button>
              </div>
            </div>

            {recipes.length === 0 ? (
              <div className="text-white/40 text-sm text-center py-16 font-body">{t("noRecipeYet")}</div>
            ) : recipeListLayout === "grid" ? (
              <div className="grid grid-cols-3 gap-2">
                {recipes.map((r) => {
                  const m = recipeMargin(r);
                  const rt = marginTier(m, r.targetMargin ?? settings.minMargin);
                  return (
                    <button
                      key={r.id}
                      onClick={() => { setActiveId(r.id); setRecipeSubView("detail"); setLossModalOpen(false); }}
                      className="relative aspect-square rounded-2xl p-2 flex flex-col items-center justify-center gap-1.5 text-center font-body transition hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg border border-white/10 active:scale-95"
                      style={{ background: "#26221C" }}
                    >
                      {topRecipeIds.includes(r.id) && (
                        <span
                          className="absolute top-1.5 right-1.5 flex items-center justify-center w-5 h-5 rounded-full shrink-0"
                          style={{ color: TOP_BADGE_COLORS[topRecipeIds.indexOf(r.id)], background: `${TOP_BADGE_COLORS[topRecipeIds.indexOf(r.id)]}22` }}
                        >
                          <Award size={10} />
                        </span>
                      )}
                      {recipeHasUnitMismatch(r) && (
                        <span
                          className="absolute top-1.5 left-1.5 flex items-center justify-center w-5 h-5 rounded-full shrink-0"
                          style={{ color: TIER_COLORS.mid, background: `${TIER_COLORS.mid}22` }}
                          title={t("recipeUnitMismatchHint")}
                        >
                          <AlertTriangle size={10} />
                        </span>
                      )}
                      <div className="text-white font-medium text-[11px] leading-tight line-clamp-2 px-0.5">{r.name}</div>
                      {m !== null ? (
                        <span
                          className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: TIER_COLORS[rt], background: `${TIER_COLORS[rt]}22` }}
                        >
                          {Math.round(m)}%
                        </span>
                      ) : (
                        <span className="text-white/20 text-[11px]">—</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {recipes.map((r) => {
                  const cpp = recipeCostPerPortion(r);
                  const m = recipeMargin(r);
                  const rt = marginTier(m, r.targetMargin ?? settings.minMargin);
                  return (
                    <div
                      key={r.id}
                      className="rounded-2xl px-4 py-3.5 flex items-center gap-2 font-body transition hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg border border-white/10"
                      style={{ background: "#26221C" }}
                    >
                      <button
                        onClick={() => { setActiveId(r.id); setRecipeSubView("detail"); setLossModalOpen(false); }}
                        className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left active:scale-95 transition-transform"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="text-white font-medium text-sm truncate">{r.name}</div>
                            {topRecipeIds.includes(r.id) && (
                              <span
                                className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                                style={{
                                  color: TOP_BADGE_COLORS[topRecipeIds.indexOf(r.id)],
                                  background: `${TOP_BADGE_COLORS[topRecipeIds.indexOf(r.id)]}22`,
                                }}
                              >
                                <Award size={9} /> TOP{topRecipeIds.indexOf(r.id) + 1}
                              </span>
                            )}
                            {recipeHasUnitMismatch(r) && (
                              <AlertTriangle size={12} className="shrink-0" style={{ color: TIER_COLORS.mid }} title={t("recipeUnitMismatchHint")} />
                            )}
                          </div>
                          <div className="text-white/40 text-[11px] font-mono mt-1">
                            {cpp.toFixed(2)}€ &rarr; {(r.sellPrice || 0).toFixed(2)}€
                          </div>
                        </div>
                        {m !== null ? (
                          <span
                            className="shrink-0 text-xs font-mono font-semibold px-2.5 py-1 rounded-full"
                            style={{ color: TIER_COLORS[rt], background: `${TIER_COLORS[rt]}22` }}
                          >
                            {Math.round(m)}%
                          </span>
                        ) : (
                          <span className="shrink-0 text-white/20 text-xs">—</span>
                        )}
                      </button>
                      <button
                        onClick={() => confirmDeleteRecipe(r.id, r.name)}
                        className="shrink-0 p-2 text-white/25 hover:text-[#EF4444]"
                        title={t("deleteLabel")}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "recipes" && recipeSubView === "detail" && !active && (
          <div className="text-white/40 text-sm text-center py-16 font-body">{t("noRecipeYet")}</div>
        )}

        {activeTab === "recipes" && recipeSubView === "detail" && active && (
          <div>
            <div className="flex items-center justify-between mb-4 print:hidden">
              <button
                onClick={() => setRecipeSubView("list")}
                className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-display uppercase tracking-wide"
              >
                <ArrowLeft size={14} /> {t("recipes")}
              </button>
              <div className="flex items-center gap-2.5">
                <button onClick={() => setLossModalOpen(true)} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-[#8B5CF6] font-display uppercase tracking-wide">
                  <Percent size={13} /> {t("declareLossesButton")}
                </button>
                <button onClick={() => duplicateRecipe(active)} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-[#8B5CF6] font-display uppercase tracking-wide">
                  <Copy size={13} /> {t("duplicate")}
                </button>
                <div className="relative">
                  <button
                    onClick={() => setPrintMenuOpen((o) => !o)}
                    className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white font-display uppercase tracking-wide"
                  >
                    <Printer size={13} /> {t("printMenuLabel")} <ChevronDown size={12} className={`transition-transform ${printMenuOpen ? "rotate-180" : ""}`} />
                  </button>
                  {printMenuOpen && (
                    <div
                      className="absolute right-0 top-full mt-1.5 w-56 rounded-xl overflow-hidden shadow-xl border border-white/10 z-30"
                      style={{ background: "#26221C" }}
                    >
                      <button
                        onClick={() => { setPrintMenuOpen(false); handlePrint(); }}
                        className="w-full text-left px-3 py-2.5 text-xs text-white/80 hover:bg-white/10 flex items-center gap-2"
                      >
                        <Printer size={13} className="shrink-0 text-white/40" /> {t("printTicket")}
                      </button>
                      <button
                        onClick={() => { setPrintMenuOpen(false); handlePrintRecipeSheet(); }}
                        className="w-full text-left px-3 py-2.5 text-xs text-white/80 hover:bg-white/10 flex items-center gap-2 border-t border-white/5"
                      >
                        <Printer size={13} className="shrink-0 text-[#3B82F6]" /> {t("printRecipeSheet")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pleine largeur et police du corps de l'app à la place de `max-w-md` + `font-mono` :
                la chasse fixe et la colonne étroite étaient là pour imiter un ticket de caisse,
                elles ne faisaient que rendre la fiche moins lisible et plus longue à parcourir. */}
            <div className={`ticket px-4 sm:px-8 py-7 sm:py-9 w-full font-body text-[15px] ${hidePricesPrint ? "hide-prices" : ""}`}>
              <input
                ref={recipeNameInputRef}
                value={active.name}
                onChange={(e) => updateRecipe({ name: e.target.value })}
                className="w-full bg-transparent font-display text-2xl sm:text-3xl uppercase tracking-wide mb-2 outline-none text-center border-b border-black/10 pb-3"
              />
              <div className="flex justify-center mb-2">
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                  style={{ background: `${TIER_COLORS.mid}18`, border: `1.5px solid ${TIER_COLORS.mid}70` }}
                >
                  <span className="text-[11px] uppercase tracking-wide font-bold" style={{ color: TIER_COLORS.mid }}>{t("portions")}</span>
                  <NumField
                    allowDecimal={false}
                    value={active.portions}
                    onChange={(v) => updateRecipe({ portions: v || 1 })}
                    className="w-10 bg-transparent text-center outline-none text-lg font-bold"
                    style={{ color: TIER_COLORS.mid }}
                  />
                </div>
              </div>

              {/* Deux actions distinctes et nommées, jamais un comportement implicite : le champ
                  ci-dessus change le nombre de portions SANS toucher aux quantités (préparation
                  entière déjà saisie), celui-ci recalcule les grammages (fiche à imprimer pour un
                  autre nombre de couverts). Mélanger les deux serait forcément faux pour la moitié
                  des utilisateurs. */}
              {active.lines.length > 0 && (
                <div className="flex items-center justify-center gap-1.5 mb-3 print:hidden">
                  <span className="text-[11px] text-black/45">{t("scalePortionsLabel")}</span>
                  <NumField
                    allowDecimal={false}
                    value={scaleTarget}
                    onChange={setScaleTarget}
                    className="w-11 bg-white rounded px-1.5 py-1 text-center text-sm text-black outline-none border border-black/15 focus:border-[#8B5CF6]"
                  />
                  <button
                    type="button"
                    onClick={() => scaleRecipeToPortions(scaleTarget)}
                    disabled={!(scaleTarget > 0) || scaleTarget === active.portions}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full disabled:opacity-35"
                    style={{ background: `${BRAND_SOLID}22`, color: BRAND_SOLID }}
                  >
                    {t("scalePortionsButton")}
                  </button>
                </div>
              )}

              <div className="text-center text-[10px] text-black/40 mb-4">{t("createdOn")} {active.createdAt || today()}</div>
              {active.isExample && (
                <div className="flex justify-center -mt-3 mb-4 print:hidden">
                  <span className="text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full font-bold" style={{ background: "#3B82F622", color: "#3B82F6" }}>
                    {t("exampleRecipeBadge")}
                  </span>
                </div>
              )}

              {/* Nouveaux repères de section (2026-08, demande explicite de simplifier la lecture
                  d'une fiche par ailleurs longue) : de simples libellés, rien de replié/caché — la
                  recette exemple doit rester lisible d'un coup d'œil dès l'arrivée, sans clic
                  supplémentaire pour comprendre sa structure. */}
              <div className="text-[10px] uppercase tracking-wide text-black/40 mt-2">{t("ingredientsSectionLabel")}</div>
              <div className="border-t border-b border-black/10 py-4 space-y-2.5">
                {/* Ajout rapide en TÊTE de liste : c'est le geste le plus fréquent quand on
                    construit une recette, il doit être le premier sous la main. */}
                <QuickAddLine
                  ingredients={ingredients}
                  ingredientDisplayName={ingredientDisplayName}
                  lang={lang}
                  t={t}
                  onAdd={quickAddLine}
                  guessUnit={guessUnitForName}
                  guessPrice={guessPriceForName}
                />
                {active.lines.map((line, idx) => {
                  const ing = ingredientById(line.ingredientId);
                  const variation = ing ? priceVariation(ing) : null;
                  const loss = ing?.lossPercent || 0;
                  // L'unité de cet ingrédient a changé depuis que cette quantité a été saisie
                  // (ex: un scan de facture a fait basculer "Ail" de pièce à kg) — la quantité
                  // affichée n'a peut-être plus le même sens, à revérifier. `unitAtEntry`
                  // undefined (lignes déjà existantes avant ce correctif) ne déclenche jamais
                  // l'avertissement.
                  const unitMismatch = ing && line.unitAtEntry !== undefined && line.unitAtEntry !== ing.unit;
                  return (
                    <div key={idx}>
                      <div className="flex items-center gap-2 text-sm">
                        <IngredientPicker
                          ingredients={ingredients}
                          value={line.ingredientId}
                          displayName={ingredientDisplayName}
                          onChange={(id) => changeLineIngredient(idx, id)}
                          className="flex-1 min-w-0 text-black/80"
                          autoOpen={autoOpenIdx === idx}
                          placeholder={t("recipeLineIngredientPlaceholder")}
                          onCreateNew={(query) => openAddWizard(idx, query)}
                          createNewLabel={t("recipeCreateIngredientFromLine")}
                          searchPlaceholder={t("pickerSearchPlaceholder")}
                          typeToSearchText={t("pickerTypeToSearch")}
                          noResultsText={t("pickerNoResults")}
                        />
                        <QtyField qty={line.qty} unit={ing?.unit} onChange={(v) => updateLineQty(idx, v)} className="w-14 shrink-0 bg-transparent text-right outline-none border-b border-black/20 py-1" t={t} />
                        {activeSupplier(ing)?.priceSource === "estimate" && (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 price-field" style={{ background: TIER_COLORS.mid }} title={t("estimatedPriceHint")} />
                        )}
                        {editingLinePriceIdx === idx && ing ? (
                          <NumField
                            value={activeSupplier(ing)?.price || 0}
                            onChange={(v) => updateActiveSupplierPrice(ing.id, v)}
                            // [BUG confirmé et corrigé, 2026-08-27] Ce champ affiche/édite le prix
                            // AU KILO (activeSupplier(ing).price), alors que le même emplacement
                            // affiche normalement le COÛT DE LA LIGNE (lineCost, prix × quantité)
                            // — deux nombres différents dans le même slot visuel. Rien ne fermait
                            // le mode édition après la saisie (seul un second clic sur le crayon le
                            // faisait) : après avoir tapé "9" pour "9€/kg", le champ restait
                            // affiché à "9,00€" à côté de "150 g", donnant l'impression fausse que
                            // 150g coûtaient 9€ — alors que le prix était bien enregistré à 9€/kg
                            // et le coût réel de la ligne (1,35€) correctement calculé en interne,
                            // simplement jamais réaffiché. On referme le mode édition dès que la
                            // saisie est terminée (perte de focus, même moment que onCommit) pour
                            // que l'écran redonne immédiatement le vrai coût de la ligne.
                            onCommit={(v) => {
                              commitActiveSupplierPrice(ing.id, v);
                              setEditingLinePriceIdx(null);
                            }}
                            className="w-16 shrink-0 bg-black/5 text-right outline-none rounded px-1 price-field"
                          />
                        ) : (
                          <span className="w-14 shrink-0 text-right price-field">{lineCost(line).toFixed(2)}€</span>
                        )}
                        {ing && (
                          <button
                            onClick={() => setEditingLinePriceIdx((v) => (v === idx ? null : idx))}
                            className="text-black/25 hover:text-black print:hidden shrink-0 price-field"
                            title={t("editLinePriceTooltip")}
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                        <button onClick={() => removeLine(idx)} className="text-black/25 hover:text-red-600 print:hidden shrink-0" title={t("deleteLineTooltip")}><Trash2 size={12} /></button>
                      </div>
                      {ing && (variation || loss > 0) && (
                        <div className="flex items-center gap-2 text-[10px] text-black/50 pl-0.5 -mt-0.5 mb-1.5">
                          {variation && (
                            <span
                              className="flex items-center gap-0.5 font-semibold price-field"
                              style={{ color: variation.dir === "up" ? "#DC2626" : "#16A34A" }}
                              title={t("priceVariationHint")}
                            >
                              {variation.dir === "up" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                              {variation.pct}%
                            </span>
                          )}
                          {loss > 0 && <span>{t("lossLineBadge")(loss)}</span>}
                        </div>
                      )}
                      {unitMismatch && (
                        <div
                          className="flex items-center gap-1.5 text-[10px] font-semibold rounded px-2 py-1 mb-1.5 price-field"
                          style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}
                        >
                          <AlertTriangle size={11} className="shrink-0" />
                          {t("lineUnitMismatchWarning")(line.unitAtEntry, ing.unit)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Une recette toute neuve (0 ligne) tombait sur un simple petit lien "+ ligne"
                    perdu au milieu d'une page par ailleurs vide (0,00€ partout) — repéré comme
                    confus par l'utilisateur. Remplacé par un bouton bien visible tant qu'aucun
                    ingrédient n'a encore été ajouté ; redevient le petit lien discret habituel dès
                    la première ligne, pour ne pas prendre de place inutile une fois la recette lancée. */}
                {active.lines.length === 0 && (
                  <button
                    onClick={addLine}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-display uppercase tracking-wide py-2.5 rounded-xl border border-dashed border-black/25 text-black/50 hover:text-black hover:border-black/50 active:scale-95 transition mb-1 print:hidden"
                  >
                    <Plus size={14} /> {t("firstIngredientPrompt")}
                  </button>
                )}
                <div className="flex items-center justify-between pt-1 print:hidden">
                  <button onClick={addLine} className="text-xs text-black/40 hover:text-black flex items-center gap-1">
                    <Plus size={12} /> {t("line")}
                  </button>
                  {/* Discret et opt-in à la demande (2026-08) : pas de texte permanent sur chaque
                      ligne, juste un repère accessible d'un clic pour qui pense en cuillères/pincées
                      plutôt qu'en grammes — la valeur stockée reste toujours un vrai grammage saisi
                      à la main, aucune conversion automatique risquée. */}
                  <button onClick={() => setShowQtyHint((v) => !v)} className="text-[10px] text-black/30 hover:text-black underline decoration-dotted">
                    {t("qtyHintToggle")}
                  </button>
                </div>
                {showQtyHint && (
                  <div className="text-[10px] text-black/40 pt-1">{t("qtyHintText")}</div>
                )}
              </div>

              <div className="pt-3 space-y-1 text-sm price-field">
                <div className="text-[10px] uppercase tracking-wide text-black/40 mb-1">{t("pricingSectionLabel")}</div>
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
                {active.lines.some((l) => activeSupplier(ingredientById(l.ingredientId))?.priceSource === "estimate") && (
                  <div className="flex items-center justify-end gap-1.5 text-[10px] text-black/40 pt-1 text-right">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: TIER_COLORS.mid }} />
                    {t("estimatedPriceLegend")}
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-black/30 mt-3 pt-3 text-xs space-y-2 print:hidden">
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
                      <button
                        onClick={() => updateRecipe({ sellPrice: Math.round(suggestedTTC * 2) / 2 })}
                        className="text-[10px] uppercase tracking-wide px-3 py-1 rounded-full font-semibold"
                        style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                      >
                        {t("use")}
                      </button>
                    </div>
                  </div>
                )}
                {isAtOrAboveTarget && nextMarginStep !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-black/50">{t("recipeTargetReached")}</span>
                    <button
                      onClick={() => updateRecipe({ targetMargin: nextMarginStep })}
                      className="text-[10px] uppercase tracking-wide px-3 py-1 rounded-full font-semibold text-white"
                      style={{ background: TIER_COLORS.high }}
                    >
                      {t("simulateHigherMargin")(nextMarginStep)}
                    </button>
                  </div>
                )}
              </div>

              {margin !== null && (
                <div className="flex flex-col items-center mt-6 mb-1 gap-2 price-field">
                  <div className="inline-flex items-stretch rounded-2xl border-2 overflow-hidden" style={{ borderColor: TIER_COLORS[tier] }}>
                    <div
                      className="px-4 py-2 flex items-center justify-center font-display uppercase tracking-wide text-sm font-bold"
                      style={{ color: TIER_COLORS[tier] }}
                    >
                      {t("marginLabel")} {Math.round(margin)}%
                    </div>
                    {costPerPortion > 0 && (
                      <>
                        <div className="w-px" style={{ background: `${TIER_COLORS[tier]}50` }} />
                        <div className="px-4 py-1.5 flex flex-col items-center justify-center" style={{ color: TIER_COLORS[tier] }}>
                          <span className="font-mono font-bold text-sm leading-none">×{(sellHT / costPerPortion).toFixed(1)}</span>
                          <span className="text-[7px] uppercase tracking-wide opacity-60 mt-0.5">{t("coefLabel")}</span>
                        </div>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowMarginLegend((v) => !v)}
                      className="w-5 h-5 shrink-0 self-center mr-1.5 rounded-full flex items-center justify-center text-[10px] font-bold border"
                      style={{ borderColor: `${TIER_COLORS[tier]}80`, color: TIER_COLORS[tier] }}
                      title={t("marginLegendToggle")}
                    >
                      ?
                    </button>
                  </div>
                  {/* Rouge/orange/vert code un seuil de marge que l'utilisateur choisit lui-même
                      dans les Paramètres — la légende n'était visible que là-bas, jamais à
                      l'endroit où la couleur apparaît réellement. Bouton "?" discret plutôt
                      qu'un texte permanent, pour ne pas surcharger la fiche recette. */}
                  {showMarginLegend && (
                    <p className="text-[10px] text-black/40 text-center max-w-[280px]">
                      {hasOrangeZone
                        ? t("marginLegendWithOrange")(effectiveGreenTarget, CRITICAL_MARGIN)
                        : t("marginLegendNoOrange")(CRITICAL_MARGIN)}
                    </p>
                  )}
                  <div
                    className="flex items-center gap-1.5 text-[11px] font-body text-center px-3 py-1.5 rounded-full font-medium max-w-[280px]"
                    style={{ color: TIER_COLORS[tier], background: `${TIER_COLORS[tier]}18` }}
                  >
                    {tier === "high" ? <Check size={12} className="shrink-0" /> : <AlertTriangle size={12} className="shrink-0" />}
                    {marginMessage(Math.round(margin), effectiveGreenTarget, tier, lang)}
                  </div>
                  {marginSuggestion && (
                    <div
                      className="flex items-start gap-2 text-[11px] font-body text-left px-3 py-2 rounded-xl max-w-[320px]"
                      style={{ color: TIER_COLORS[tier], background: `${TIER_COLORS[tier]}0f`, border: `1px dashed ${TIER_COLORS[tier]}50` }}
                    >
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      <span><strong>{t("suggestionTitle")}</strong> {marginSuggestion}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-dashed border-black/30 mt-4 pt-3 space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-black/40 mb-1">{t("notes")}</div>
                  <textarea value={active.notes || ""} onChange={(e) => updateRecipe({ notes: e.target.value })} placeholder={t("notesPlaceholder")} rows={3} className="w-full bg-black/5 rounded p-2 text-xs outline-none resize-none focus:bg-black/10 print:hidden" />
                  {active.notes && (
                    <div className="hidden print:block text-xs p-2 whitespace-pre-wrap">{active.notes}</div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] uppercase tracking-wide text-black/40 flex items-center gap-1.5">
                      {t("allergens")}
                      {active.allergensAuto !== false && active.allergens && (
                        <span className="normal-case tracking-normal text-[9px] px-1 py-0.5 rounded bg-black/10 text-black/40">{t("allergensAutoBadge")}</span>
                      )}
                    </div>
                  </div>
                  <input
                    value={active.allergens || ""}
                    onChange={(e) => updateRecipe({ allergens: e.target.value, allergensAuto: false, allergenCodes: matchAllergenCodesFromText(e.target.value) })}
                    placeholder={t("allergensPlaceholder")}
                    className="w-full bg-black/5 rounded p-2 text-xs outline-none focus:bg-black/10 print:hidden"
                  />
                  {active.allergens && (
                    <div className="hidden print:block text-xs p-2 whitespace-pre-wrap">{active.allergens}</div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => deleteRecipe(active.id)}
              className="mt-4 w-full text-center text-[11px] text-white/25 hover:text-[#B23A2E] print:hidden"
            >
              <Trash2 size={11} className="inline mr-1 -mt-0.5" /> {t("deleteRecipeButton")}
            </button>
          </div>
        )}

        {/* ---------------- ONGLET SCANNER ---------------- */}
        {activeTab === "scanner" && (
          <div className="max-w-md mx-auto pt-6">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanFile} />
            {/* PDF de nouveau proposé sur tous les appareils, y compris iOS (2026-08-25) : le
                blocage temporaire posé plus tôt dans la soirée (voir git log) n'est plus
                nécessaire depuis que le PDF est envoyé brut à Claude au lieu d'être parsé dans le
                navigateur — le bug WebKit qui justifiait ce blocage ne peut simplement plus se
                produire, plus besoin de distinguer les appareils. */}
            <input ref={fileInputLibraryRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleScanFile} />
            <div className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center font-body border border-white/10" style={{ background: "#26221C" }}>
              <svg viewBox="0 0 120 120" width="104" height="104" className="mb-1">
                <rect x="30" y="14" width="60" height="86" rx="4" fill="#F3EBDA" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                {[26, 34, 42, 50, 58, 66, 74].map((y, i) => (
                  <rect key={i} x="38" y={y} width={i % 3 === 0 ? 30 : 44} height="3" rx="1.5" fill="#2B262022" />
                ))}
                <rect x="38" y="84" width="44" height="4" rx="2" fill="#8B5CF655" />
                <g style={{ transformOrigin: "60px 57px", animation: "scanPulse 2.2s ease-in-out infinite" }}>
                  <rect x="26" y="53" width="68" height="3" rx="1.5" fill="#8B5CF6" opacity="0.9" />
                </g>
                <g style={{ animation: "scanFlash 2.2s ease-in-out infinite" }}>
                  <circle cx="94" cy="100" r="17" fill="#8B5CF6" />
                  <rect x="86" y="93" width="16" height="12" rx="2.5" fill="#1B1815" />
                  <circle cx="94" cy="99" r="3.4" fill="#8B5CF6" />
                </g>
              </svg>
              <h2 className="font-display text-white uppercase tracking-wide text-sm mt-1">{t("scanInvoice")}</h2>
              <p className="text-white/40 text-xs leading-relaxed">{t("scanTabHint")}</p>
              {/* Import de fichier mis en avant (PDF natif ou photo depuis la galerie) plutôt que
                  la prise de photo directe — demande explicite de l'utilisateur, 2026-08, suite à
                  la campagne de test qui a confirmé le PDF natif comme la modalité la plus fiable
                  (aucun risque d'alignement visuel/décalage de ligne). La prise de photo reste
                  pleinement fonctionnelle (l'utilisateur confirme de bons résultats même sur un
                  ticket de caisse pris rapidement) — seule la mise en avant visuelle change,
                  jamais une fonctionnalité retirée. */}
              <span
                className="mt-3 text-[9px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full"
                style={{ background: "#3B82F622", color: "#3B82F6" }}
              >
                {t("scanRecommendedBadge")}
              </span>
              <button
                onClick={() => fileInputLibraryRef.current?.click()}
                className="mt-1.5 w-full text-xs font-display uppercase tracking-wide py-3 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform"
                style={{ background: "#3B82F6", color: "#fff", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 14px rgba(59,130,246,0.4)" }}
              >
                <Upload size={15} /> {t("scanUploadFile")}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full text-xs font-display uppercase tracking-wide py-3 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform border border-white/20 text-white/60"
              >
                <Camera size={15} /> {t("scanTakePhoto")}
              </button>
            </div>

            <div className="rounded-2xl p-4 mt-3 text-xs leading-relaxed border border-white/10" style={{ background: "#26221C" }}>
              <p className="text-white/70 font-semibold mb-1">{t("scanTipTitle")}</p>
              <p className="text-white/45">{t("scanTipBody")}</p>
            </div>
          </div>
        )}

        {/* ---------------- ONGLET GARDE-MANGER ---------------- */}
        {activeTab === "pantry" && (
          <div>
            <h2 className="font-display text-white/90 uppercase text-sm tracking-widest mb-3">{t("pantry")}</h2>

            {ingredients.length > 0 && ingredients.every((i) => activeSupplier(i)?.priceSource === "estimate") && (
              <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 mb-3 text-xs" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{t("pantryOnboardingHint")}</span>
              </div>
            )}

            {/* Un appareil qui a visité l'app avant le vidage du garde-manger de démarrage
                (~200 ingrédients -> 7) garde pour toujours son ancien garde-manger : le principe
                "ne jamais écraser une donnée existante" s'applique aussi à cette ancienne démo,
                exactement comme à de vraies données. Repéré en test réel (2026-08, téléphone de
                l'utilisateur toujours sur l'ancienne liste). Condition volontairement stricte
                (>20 ingrédients ET tous encore au prix "estimé") pour ne jamais se déclencher sur
                un vrai garde-manger déjà utilisé, même partiellement. */}
            {ingredients.length > 20 && ingredients.every((i) => activeSupplier(i)?.priceSource === "estimate") && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3 text-xs" style={{ background: "#8B5CF618", color: "#C4B5FD" }}>
                <AlertTriangle size={14} className="shrink-0" />
                <span className="flex-1">{t("legacyPantryHint")}</span>
                <button
                  onClick={() => setIngredients(SEED_INGREDIENTS)}
                  className="shrink-0 text-[11px] font-display uppercase tracking-wide px-2.5 py-1.5 rounded-full"
                  style={{ background: BRAND_GRADIENT, color: "#fff" }}
                >
                  {t("legacyPantryButton")}
                </button>
              </div>
            )}

            {uncategorizedIngredients.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3 text-xs" style={{ background: "#8B5CF618", color: "#C4B5FD" }}>
                <Tags size={14} className="shrink-0" />
                <span className="flex-1">{t("pantryReclassifyHint")(uncategorizedIngredients.length)}</span>
                <button
                  onClick={reclassifyUncategorized}
                  className="shrink-0 text-[11px] font-display uppercase tracking-wide px-2.5 py-1.5 rounded-full"
                  style={{ background: BRAND_GRADIENT, color: "#fff" }}
                >
                  {t("pantryReclassifyButton")}
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 mb-2 border border-white/10" style={{ background: "#26221C" }}>
              <Search size={13} className="text-white/40 shrink-0" />
              <input
                value={pantryQuery}
                onChange={(e) => setPantryQuery(e.target.value)}
                placeholder={t("pantryFilterPlaceholder")}
                className="w-full bg-transparent text-white text-sm outline-none min-w-0"
              />
            </div>
            <div className="flex flex-wrap gap-1 mb-4">
              <button
                onClick={() => setPantryCategory((c) => (c === "recent" ? "none" : "recent"))}
                className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border flex items-center gap-1 ${pantryCategory === "recent" ? "bg-[#3B82F6] text-white border-[#3B82F6]" : "text-[#3B82F6] border-[#3B82F650] hover:border-[#3B82F6]"}`}
              >
                <Clock size={10} /> {t("recentIngredients")}
              </button>
              <button
                onClick={() => setPantryCategory((c) => (c === "all" ? "none" : "all"))}
                className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border ${pantryCategory === "all" ? "bg-[#8B5CF6] text-white border-[#8B5CF6]" : "text-white/50 border-white/15 hover:border-white/40"}`}
              >
                {t("allCategories")}
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setPantryCategory((cur) => (cur === c.id ? "none" : c.id))}
                  className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border ${pantryCategory === c.id ? "bg-[#8B5CF6] text-white border-[#8B5CF6]" : "text-white/50 border-white/15 hover:border-white/40"}`}
                >
                  {c[lang]}
                </button>
              ))}
            </div>

            {pantryCategory === "recent" && recentGrouped && recentGrouped.length > 0 && (
              <div className="flex items-center justify-between mb-2 px-1">
                <button
                  onClick={() => {
                    const allIds = recentGrouped.flatMap((g) => g.items.map((i) => i.id));
                    const allSelected = allIds.length > 0 && allIds.every((id) => selectedRecentIds.has(id));
                    setSelectedRecentIds(allSelected ? new Set() : new Set(allIds));
                  }}
                  className="text-[11px] text-white/50 hover:text-white underline decoration-dotted"
                >
                  {recentGrouped.flatMap((g) => g.items).every((i) => selectedRecentIds.has(i.id)) ? t("deselectAll") : t("selectAllRecent")}
                </button>
                {selectedRecentIds.size > 0 && (
                  <button
                    onClick={() => setBulkDeleteConfirmOpen(true)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#EF4444] hover:text-[#B23A2E]"
                  >
                    <Trash2 size={12} /> {t("deleteSelectedButton")(selectedRecentIds.size)}
                  </button>
                )}
              </div>
            )}

            <div className="rounded-xl overflow-hidden font-body border border-white/10" style={{ background: "#26221C" }}>
              {(() => {
                const displayGroups = pantryCategory === "recent" ? recentGrouped || [] : pantryGrouped;
                if (displayGroups.length === 0) {
                  return (
                    <div className="px-3 py-8 text-center text-white/30 text-sm">
                      {pantryCategory === "recent"
                        ? t("noRecentIngredients")
                        : pantryCategory === "none" && !pantryQuery.trim()
                        ? t("pantryEmptyPrompt")
                        : t("noFilterMatch")}
                    </div>
                  );
                }
                return displayGroups.map(({ label, items }) => (
                  <div key={label}>
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/40" style={{ background: "#1B1815" }}>
                      {label}
                    </div>
                    {items.map((ing) => {
                    const sup = activeSupplier(ing);
                    const isOpen = expandedIngId === ing.id;
                    return (
                      <div key={ing.id} className="border-t border-white/5">
                        <div className="w-full flex items-center gap-2 px-3 py-2.5">
                          {pantryCategory === "recent" && (
                            <input
                              type="checkbox"
                              checked={selectedRecentIds.has(ing.id)}
                              onChange={() => toggleRecentSelection(ing.id)}
                              className="shrink-0"
                            />
                          )}
                          <button
                            onClick={() => setExpandedIngId(isOpen ? null : ing.id)}
                            className="flex-1 min-w-0 flex items-center gap-2 text-left"
                          >
                            <span className="flex-1 min-w-0 text-white text-sm truncate">{ingredientDisplayName(ing)}</span>
                            {sup?.priceSource === "estimate" && (
                              <span
                                className="shrink-0 text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded-full font-semibold"
                                style={{ color: TIER_COLORS.mid, background: `${TIER_COLORS.mid}22` }}
                                title={t("estimatedPriceHint")}
                              >
                                {t("estimatedPriceBadge")}
                              </span>
                            )}
                            <span className="text-white/40 text-[11px] shrink-0">{unitDisplayLabel(ing.unit, t)}</span>
                            <span className="text-white/80 text-xs font-mono shrink-0 w-16 text-right">{(sup?.price || 0).toFixed(2)}€</span>
                          </button>
                          <button
                            onClick={() => setExpandedIngId(isOpen ? null : ing.id)}
                            className="shrink-0 flex items-center gap-0.5 text-white/30 hover:text-white p-1"
                            title={t("viewDetailsTooltip")}
                          >
                            <span className="text-[9px] uppercase tracking-wide">{t("viewDetailsLabel")}</span>
                            <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </button>
                        </div>

                        {isOpen && (
                          <div className="px-3 pb-3" style={{ background: "#1B1815" }}>
                            <input
                              value={ingredientDisplayName(ing)}
                              onChange={(e) => updateIngredientName(ing.id, e.target.value)}
                              className="w-full bg-transparent text-white text-sm font-medium outline-none border-b border-white/10 focus:border-[#8B5CF6] pb-1 pt-2 mb-2"
                            />
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] uppercase tracking-wide text-white/40">{t("unitFieldLabel")}</span>
                              <select
                                value={ing.unit}
                                onChange={(e) => updateIngredientField(ing.id, "unit", e.target.value)}
                                className="bg-black/20 text-white/70 text-xs outline-none rounded px-1.5 py-1"
                                style={{ colorScheme: "dark" }}
                              >
                                <option value="kg">kg</option>
                                <option value="L">L</option>
                                <option value="pièce">{t("unitPieceLabel")}</option>
                              </select>
                            </div>

                            {/* Reclassement manuel — seul moyen de corriger un ingrédient jamais rapproché
                                automatiquement du catalogue (nom trop spécifique à la facture, ex: "Mozzarella
                                di bufala"). Ne touche jamais catalogId (donc pas le lien allergène) : changer
                                juste la catégorie ne doit pas faire croire à un rapprochement produit fiable. */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] uppercase tracking-wide text-white/40">{t("categoryLabel")}</span>
                              <select
                                value={ing.category || "autres"}
                                onChange={(e) => updateIngredientField(ing.id, "category", e.target.value)}
                                className="bg-black/20 text-white/70 text-xs outline-none rounded px-1.5 py-1"
                                style={{ colorScheme: "dark" }}
                              >
                                {CATEGORIES.map((c) => (
                                  <option key={c.id} value={c.id}>{c[lang]}</option>
                                ))}
                              </select>
                            </div>

                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] uppercase tracking-wide text-white/40">{t("lossPercentLabel")}</span>
                              <NumField
                                value={ing.lossPercent || 0}
                                onChange={(v) => updateIngredientField(ing.id, "lossPercent", Math.min(Math.max(v, 0), 95))}
                                allowDecimal={false}
                                className="w-12 bg-black/20 text-white/70 text-xs outline-none rounded px-1.5 py-1 text-right"
                              />
                              <span className="text-white/40 text-xs">%</span>
                            </div>

                            <div className="space-y-1 mb-2">
                              {ing.suppliers.map((s) => (
                                <div key={s.id} className="flex items-center gap-1.5 text-xs text-white/60">
                                  <input type="radio" checked={ing.selectedSupplierId === s.id} onChange={() => selectSupplier(ing.id, s.id)} className="shrink-0" />
                                  <input
                                    value={s.name}
                                    onChange={(e) => updateSupplier(ing.id, s.id, "name", e.target.value)}
                                    className="flex-1 bg-transparent outline-none border-b border-white/10 focus:border-[#8B5CF6] min-w-0"
                                  />
                                  <NumField value={s.price} onChange={(v) => updateSupplier(ing.id, s.id, "price", v)} onCommit={(v) => commitSupplierPrice(ing.id, s.id, v)} className="w-14 shrink-0 bg-transparent font-mono outline-none border-b border-white/10 focus:border-[#8B5CF6] text-right" />
                                  <span className="shrink-0">€</span>
                                  {ing.suppliers.length > 1 && (
                                    <button onClick={() => removeSupplier(ing.id, s.id)} className="text-white/25 hover:text-red-400 shrink-0"><Trash2 size={11} /></button>
                                  )}
                                </div>
                              ))}
                              <button onClick={() => addSupplier(ing.id)} className="text-[10px] uppercase tracking-wide text-white/40 hover:text-[#8B5CF6] flex items-center gap-1">
                                <Plus size={10} /> {t("supplier")}
                              </button>
                            </div>

                            {ing.history && ing.history.length > 0 && (
                              <div className="pt-2 border-t border-white/10 text-[10px] text-white/40 font-mono flex items-start gap-1 mb-2">
                                <History size={11} className="mt-0.5 shrink-0" />
                                <span className="break-words">{ing.history.slice(-3).map((h) => `${h.date}: ${h.price.toFixed(2)}€`).join("  ·  ")}</span>
                              </div>
                            )}

                            <button onClick={() => deleteIngredient(ing.id)} className="text-[10px] uppercase tracking-wide text-white/30 hover:text-[#B23A2E] flex items-center gap-1">
                              <Trash2 size={11} /> {t("deleteIngredientButton")}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ));
              })()}
            </div>

            <button onClick={() => openAddWizard()} className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-display uppercase tracking-wide py-2.5 rounded-xl border border-dashed border-white/25 text-white/60 hover:text-[#8B5CF6] hover:border-[#8B5CF6] active:scale-95 transition">
              <Plus size={14} /> {t("addIngredient")}
            </button>
          </div>
        )}
      </main>

      {/* Premier lancement guidé — voir FirstRunWizard. Rendu par-dessus tout le reste, mais
          uniquement sur un compte encore totalement vierge (voir looksBrandNew) et jamais une
          seconde fois (drapeau firstRunDone, stocké par compte). */}
      {showFirstRun && (
        <FirstRunWizard t={t} onFinish={finishFirstRun} onSkip={closeFirstRun} />
      )}

      {/* ---------------- NAVIGATION PAR ONGLETS (bas d'écran) ---------------- */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 flex items-stretch backdrop-blur-lg print:hidden"
        style={{ background: "rgba(38,34,28,0.8)", borderTop: "1px solid rgba(201,154,85,0.2)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {[
          { id: "recipes", label: t("recipes"), icon: Receipt },
          { id: "scanner", label: t("scanTab"), icon: Camera },
          { id: "pantry", label: t("pantry"), icon: Package },
        ].map((tabDef) => {
          const TabIcon = tabDef.icon;
          const isActive = activeTab === tabDef.id;
          return (
            <button
              key={tabDef.id}
              onClick={() => { setActiveTab(tabDef.id); if (tabDef.id === "recipes") setRecipeSubView("list"); }}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 active:scale-90 transition-transform"
            >
              <TabIcon size={20} color={isActive ? BRAND_SOLID : "rgba(255,255,255,0.4)"} />
              <span className={`text-[10px] font-display uppercase tracking-wide ${isActive ? "text-[#8B5CF6]" : "text-white/40"}`}>{tabDef.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
