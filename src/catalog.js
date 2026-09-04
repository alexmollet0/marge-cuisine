// Catalogue d'ingrédients (195 entrées), allergènes, catégories et fonctions de détection
// associées — extrait de App.jsx le 2026-08-28, pure donnée + logique sans état React.
import { TR } from "./translations.js";

export const CATEGORIES = [
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
export const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// Prix indicatifs par catégorie (ordre de grandeur grossier, marché français, par kg/L/pièce
// selon l'unité de l'ingrédient) pour le bouton "estimer un prix temporaire" de l'assistant
// ingrédient — un flat 1€ pour tout (viande comme légume) a été jugé inutile en test réel
// (2026-08). Ça reste un point de départ à corriger par l'utilisateur, pas une vraie estimation
// de marché, juste un chiffre moins absurde que le même pour tout.
export const CATEGORY_ESTIMATE_PRICE = {
  viandes: 15, poissons: 18, legumes: 2.5, fruits: 3, cremerie: 6,
  epicerie: 4, epices: 20, boissons: 5, autres: 5,
};

// [BUG confirmé et corrigé, 2026-09-04] Repère de secours dédié pour un ingrédient compté à la
// PIÈCE (œuf, citron, tête d'ail...) — les nombres de CATEGORY_ESTIMATE_PRICE ci-dessus sont
// calibrés au kg/L ; les réutiliser tels quels pour une seule pièce donne un prix absurde (bug
// réel signalé par l'utilisateur : "Œufs" catalogué en Crémerie/unité pièce recevait le 6€ pensé
// pour 1kg de produit laitier, soit 6€ l'œuf). Volontairement bas et générique, un point de
// départ à corriger, pas une vraie estimation de marché — comme CATEGORY_ESTIMATE_PRICE.
export const PIECE_ESTIMATE_PRICE = 0.5;

// Unité par défaut par catégorie pour un ingrédient créé depuis le scanner de fiche recette
// quand la quantité est imprécise (voir impreciseQuantity, api/scan-recipe.js) — sert de
// garde-fou pour ne jamais suivre aveuglément une unité "pièce" hasardeuse proposée par l'IA
// pour un ingrédient normalement vendu au poids (ex: "faux filet" ne doit jamais partir en
// pièce). Uniquement utilisé dans ce cas précis, jamais pour une quantité déjà précise.
export const CATEGORY_DEFAULT_UNIT = {
  viandes: "kg", poissons: "kg", legumes: "kg", fruits: "kg", cremerie: "kg",
  epicerie: "kg", epices: "kg", boissons: "L", autres: "pièce",
};

export const CATALOG = [
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
export const CATALOG_MAP = Object.fromEntries(CATALOG.map((c) => [c.id, c]));
export const normUnit = (u) => (u === "U" ? "pièce" : u);
// "pièce" est un identifiant interne stable (comparé un peu partout dans le code, ex: unit ===
// "pièce") — jamais renommé. Seul son AFFICHAGE doit être traduit ; "kg"/"L" restent identiques
// dans les 3 langues donc n'ont besoin d'aucune conversion.
export const unitDisplayLabel = (u, t) => (u === "pièce" ? t("unitPieceLabel") : u);

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

export const ALLERGEN_MAP = {
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
export const ALLERGEN_NAME_KEYWORDS = {
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
export const normalizeDiacritics = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

// Recherche "insensible" utilisée dans toutes les barres de recherche de l'app (garde-manger,
// assistant ingrédient, sélecteur de ligne de recette) — avant cet ajout ces filtres faisaient
// juste .toLowerCase().includes(), donc ni les accents ni œ/æ n'étaient ignorés.
export const textIncludes = (haystack, needle) => normalizeDiacritics(haystack).includes(normalizeDiacritics(needle));

export const normalizeAllergenText = (s) => normalizeDiacritics(s).replace(/[^a-z0-9]+/g, " ").trim();

// Nom source (toujours français), indépendant de la langue d'interface — utilisé pour
// toute détection par mots-clés (allergènes, féculents...) afin de rester cohérent
// quelle que soit la langue choisie par l'utilisateur.
export function ingredientSourceName(ing) {
  return ing?.catalogId && CATALOG_MAP[ing.catalogId] ? CATALOG_MAP[ing.catalogId].fr : ing?.name || "";
}

export function detectAllergenCodesSet(lines, ingredientsList) {
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

export function detectAllergens(lines, ingredientsList, lang) {
  return Array.from(detectAllergenCodesSet(lines, ingredientsList)).map((a) => ALLERGEN_LABELS[a][lang]).join(", ");
}

// Codes bruts (indépendants de la langue), utilisés par la carte digitale publique pour afficher
// des logos d'allergène traduits dans la langue choisie par le client — jamais dans le texte libre
// `allergens` (déjà figé dans la langue de l'app du restaurateur au moment du calcul).
export function detectAllergenCodes(lines, ingredientsList) {
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
export function matchAllergenCodesFromText(text) {
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
export const FECULENT_NAME_KEYWORDS = [
  ["riz"], ["pate"], ["spaghetti"], ["tagliatelle"], ["penne"], ["macaroni"], ["nouille"],
  ["vermicelle"], ["patate"], ["frite"], ["semoule"], ["couscous"], ["quinoa"], ["boulgour"],
  ["polenta"], ["lentille"], ["pain"], ["baguette"], ["pomme", "de", "terre"],
  ["pois", "chiche"], ["haricot", "blanc"], ["haricot", "rouge"],
];

export function matchesFeculentKeywords(tokens) {
  return FECULENT_NAME_KEYWORDS.some((phrase) => {
    for (let i = 0; i <= tokens.length - phrase.length; i++) {
      if (phrase.every((pt, j) => tokens[i + j] === pt || tokens[i + j] === pt + "s")) return true;
    }
    return false;
  });
}

export function isProteinIngredient(ing) {
  return ing?.category === "viandes" || ing?.category === "poissons";
}

export function isFeculentIngredient(ing) {
  if (!ing) return false;
  const tokens = normalizeAllergenText(ingredientSourceName(ing)).split(" ").filter(Boolean);
  return matchesFeculentKeywords(tokens);
}

// Suggestion contextuelle d'optimisation de marge : règles déterministes (pas d'appel IA),
// pour garantir qu'on ne mentionne jamais une protéine/féculent absent de la recette.
// Priorité : protéine présente > féculent sans protéine > ni l'un ni l'autre (dessert,
// boisson, entrée simple), auquel cas on pointe l'ingrédient le plus cher de la recette.
export function recipeSuggestion(recipe, ingredientsList, lineCostFn, displayNameFn, lang) {
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
