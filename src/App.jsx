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
  Receipt,
  History,
  Settings as SettingsIcon,
  Search,
  ChevronDown,
  Camera,
  X,
  Loader2,
  TrendingUp,
  Package,
  ArrowLeft,
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
  { id: "steak_hache", fr: "Steak haché 15%", es: "Carne picada 15%", unit: "kg", cat: "viandes" },
  { id: "entrecote", fr: "Entrecôte", es: "Entrecot", unit: "kg", cat: "viandes" },
  { id: "filet_boeuf", fr: "Filet de bœuf", es: "Solomillo de ternera", unit: "kg", cat: "viandes" },
  { id: "rumsteck", fr: "Rumsteck", es: "Contra de ternera", unit: "kg", cat: "viandes" },
  { id: "bavette", fr: "Bavette", es: "Bavette de ternera", unit: "kg", cat: "viandes" },
  { id: "cote_porc", fr: "Côte de porc", es: "Chuleta de cerdo", unit: "kg", cat: "viandes" },
  { id: "lardons_fumes", fr: "Lardons fumés", es: "Panceta ahumada en tacos", unit: "kg", cat: "viandes" },
  { id: "saucisse_toulouse", fr: "Saucisse de Toulouse", es: "Salchicha de Toulouse", unit: "kg", cat: "viandes" },
  { id: "merguez", fr: "Merguez", es: "Merguez", unit: "kg", cat: "viandes" },
  { id: "foie_gras", fr: "Foie gras cru", es: "Foie gras crudo", unit: "kg", cat: "viandes" },
  { id: "lapin", fr: "Lapin entier", es: "Conejo entero", unit: "kg", cat: "viandes" },
  { id: "veau_escalope", fr: "Escalope de veau", es: "Escalope de ternera lechal", unit: "kg", cat: "viandes" },
  { id: "pintade", fr: "Pintade", es: "Pintada", unit: "kg", cat: "viandes" },
  { id: "maquereau", fr: "Maquereau", es: "Caballa", unit: "kg", cat: "poissons" },
  { id: "sardine", fr: "Sardine", es: "Sardina", unit: "kg", cat: "poissons" },
  { id: "truite", fr: "Truite", es: "Trucha", unit: "kg", cat: "poissons" },
  { id: "lieu_noir", fr: "Lieu noir", es: "Abadejo", unit: "kg", cat: "poissons" },
  { id: "sole", fr: "Sole", es: "Lenguado", unit: "kg", cat: "poissons" },
  { id: "seiche", fr: "Seiche", es: "Sepia", unit: "kg", cat: "poissons" },
  { id: "calamar", fr: "Calamar", es: "Calamar", unit: "kg", cat: "poissons" },
  { id: "langoustine", fr: "Langoustine", es: "Cigala", unit: "kg", cat: "poissons" },
  { id: "huitres", fr: "Huîtres", es: "Ostras", unit: "U", cat: "poissons" },
  { id: "saint_jacques", fr: "Noix de Saint-Jacques", es: "Vieiras", unit: "kg", cat: "poissons" },
  { id: "saumon_fume", fr: "Saumon fumé", es: "Salmón ahumado", unit: "kg", cat: "poissons" },
  { id: "tarama", fr: "Tarama", es: "Tarama", unit: "kg", cat: "poissons" },
  { id: "surimi", fr: "Surimi", es: "Surimi", unit: "kg", cat: "poissons" },
  { id: "radis", fr: "Radis", es: "Rábano", unit: "kg", cat: "legumes" },
  { id: "betterave", fr: "Betterave", es: "Remolacha", unit: "kg", cat: "legumes" },
  { id: "navet", fr: "Navet", es: "Nabo", unit: "kg", cat: "legumes" },
  { id: "fenouil", fr: "Fenouil", es: "Hinojo", unit: "kg", cat: "legumes" },
  { id: "artichaut", fr: "Artichaut", es: "Alcachofa", unit: "U", cat: "legumes" },
  { id: "asperge", fr: "Asperge verte", es: "Espárrago verde", unit: "kg", cat: "legumes" },
  { id: "chou_blanc", fr: "Chou blanc", es: "Col blanca", unit: "kg", cat: "legumes" },
  { id: "chou_fleur", fr: "Chou-fleur", es: "Coliflor", unit: "U", cat: "legumes" },
  { id: "chou_bruxelles", fr: "Chou de Bruxelles", es: "Coles de Bruselas", unit: "kg", cat: "legumes" },
  { id: "endive", fr: "Endive", es: "Endivia", unit: "kg", cat: "legumes" },
  { id: "roquette", fr: "Roquette", es: "Rúcula", unit: "kg", cat: "legumes" },
  { id: "mache", fr: "Mâche", es: "Canónigos", unit: "kg", cat: "legumes" },
  { id: "patate_douce", fr: "Patate douce", es: "Boniato", unit: "kg", cat: "legumes" },
  { id: "mais_doux", fr: "Maïs doux", es: "Maíz dulce", unit: "kg", cat: "legumes" },
  { id: "gingembre", fr: "Gingembre frais", es: "Jengibre fresco", unit: "kg", cat: "legumes" },
  { id: "oignon_rouge", fr: "Oignon rouge", es: "Cebolla roja", unit: "kg", cat: "legumes" },
  { id: "ciboulette", fr: "Ciboulette fraîche", es: "Cebollino fresco", unit: "kg", cat: "legumes" },
  { id: "coriandre", fr: "Coriandre fraîche", es: "Cilantro fresco", unit: "kg", cat: "legumes" },
  { id: "menthe", fr: "Menthe fraîche", es: "Menta fresca", unit: "kg", cat: "legumes" },
  { id: "poire", fr: "Poire", es: "Pera", unit: "kg", cat: "fruits" },
  { id: "peche", fr: "Pêche", es: "Melocotón", unit: "kg", cat: "fruits" },
  { id: "abricot", fr: "Abricot", es: "Albaricoque", unit: "kg", cat: "fruits" },
  { id: "prune", fr: "Prune", es: "Ciruela", unit: "kg", cat: "fruits" },
  { id: "raisin", fr: "Raisin", es: "Uva", unit: "kg", cat: "fruits" },
  { id: "melon", fr: "Melon", es: "Melón", unit: "U", cat: "fruits" },
  { id: "pasteque", fr: "Pastèque", es: "Sandía", unit: "kg", cat: "fruits" },
  { id: "kiwi", fr: "Kiwi", es: "Kiwi", unit: "kg", cat: "fruits" },
  { id: "mangue", fr: "Mangue", es: "Mango", unit: "U", cat: "fruits" },
  { id: "ananas", fr: "Ananas", es: "Piña", unit: "U", cat: "fruits" },
  { id: "framboise", fr: "Framboise", es: "Frambuesa", unit: "kg", cat: "fruits" },
  { id: "myrtille", fr: "Myrtille", es: "Arándano", unit: "kg", cat: "fruits" },
  { id: "cerise", fr: "Cerise", es: "Cereza", unit: "kg", cat: "fruits" },
  { id: "figue", fr: "Figue", es: "Higo", unit: "kg", cat: "fruits" },
  { id: "pamplemousse", fr: "Pamplemousse", es: "Pomelo", unit: "U", cat: "fruits" },
  { id: "noix_de_coco", fr: "Noix de coco", es: "Coco", unit: "U", cat: "fruits" },
  { id: "comte", fr: "Comté", es: "Comté (queso)", unit: "kg", cat: "cremerie" },
  { id: "emmental", fr: "Emmental", es: "Emmental", unit: "kg", cat: "cremerie" },
  { id: "gruyere", fr: "Gruyère", es: "Gruyer", unit: "kg", cat: "cremerie" },
  { id: "brie", fr: "Brie", es: "Brie", unit: "kg", cat: "cremerie" },
  { id: "camembert", fr: "Camembert", es: "Camembert", unit: "U", cat: "cremerie" },
  { id: "roquefort", fr: "Roquefort", es: "Roquefort", unit: "kg", cat: "cremerie" },
  { id: "feta", fr: "Feta", es: "Feta", unit: "kg", cat: "cremerie" },
  { id: "ricotta", fr: "Ricotta", es: "Ricotta", unit: "kg", cat: "cremerie" },
  { id: "fromage_blanc", fr: "Fromage blanc", es: "Queso fresco batido", unit: "kg", cat: "cremerie" },
  { id: "beurre_demi_sel", fr: "Beurre demi-sel", es: "Mantequilla semisalada", unit: "kg", cat: "cremerie" },
  { id: "margarine", fr: "Margarine", es: "Margarina", unit: "kg", cat: "cremerie" },
  { id: "skyr", fr: "Skyr nature", es: "Skyr natural", unit: "kg", cat: "cremerie" },
  { id: "pain_mie", fr: "Pain de mie", es: "Pan de molde", unit: "kg", cat: "epicerie" },
  { id: "farine_sarrasin", fr: "Farine de sarrasin", es: "Harina de trigo sarraceno", unit: "kg", cat: "epicerie" },
  { id: "levure_boulangere", fr: "Levure boulangère", es: "Levadura de panadería", unit: "kg", cat: "epicerie" },
  { id: "levure_chimique", fr: "Levure chimique", es: "Levadura química", unit: "kg", cat: "epicerie" },
  { id: "bicarbonate", fr: "Bicarbonate de soude", es: "Bicarbonato de sodio", unit: "kg", cat: "epicerie" },
  { id: "sucre_glace", fr: "Sucre glace", es: "Azúcar glas", unit: "kg", cat: "epicerie" },
  { id: "cassonade", fr: "Cassonade", es: "Azúcar moreno", unit: "kg", cat: "epicerie" },
  { id: "confiture", fr: "Confiture", es: "Mermelada", unit: "kg", cat: "epicerie" },
  { id: "pate_a_tartiner", fr: "Pâte à tartiner", es: "Crema de cacao para untar", unit: "kg", cat: "epicerie" },
  { id: "chapelure", fr: "Chapelure", es: "Pan rallado", unit: "kg", cat: "epicerie" },
  { id: "spaghetti", fr: "Spaghetti", es: "Espaguetis", unit: "kg", cat: "epicerie" },
  { id: "tagliatelles", fr: "Tagliatelles", es: "Tallarines", unit: "kg", cat: "epicerie" },
  { id: "lentilles_vertes", fr: "Lentilles vertes", es: "Lentejas verdes", unit: "kg", cat: "epicerie" },
  { id: "pois_chiches", fr: "Pois chiches", es: "Garbanzos", unit: "kg", cat: "epicerie" },
  { id: "haricots_rouges", fr: "Haricots rouges secs", es: "Alubias rojas", unit: "kg", cat: "epicerie" },
  { id: "tofu", fr: "Tofu", es: "Tofu", unit: "kg", cat: "epicerie" },
  { id: "noix_cajou", fr: "Noix de cajou", es: "Anacardos", unit: "kg", cat: "epicerie" },
  { id: "pistaches", fr: "Pistaches", es: "Pistachos", unit: "kg", cat: "epicerie" },
  { id: "tomates_pelees", fr: "Tomates pelées en boîte", es: "Tomate pelado en lata", unit: "kg", cat: "epicerie" },
  { id: "concentre_tomate", fr: "Concentré de tomate", es: "Concentrado de tomate", unit: "kg", cat: "epicerie" },
  { id: "capres", fr: "Câpres", es: "Alcaparras", unit: "kg", cat: "epicerie" },
  { id: "olives_vertes", fr: "Olives vertes", es: "Aceitunas verdes", unit: "kg", cat: "epicerie" },
  { id: "olives_noires", fr: "Olives noires", es: "Aceitunas negras", unit: "kg", cat: "epicerie" },
  { id: "cornichons", fr: "Cornichons", es: "Pepinillos", unit: "kg", cat: "epicerie" },
  { id: "bouillon_volaille", fr: "Bouillon de volaille", es: "Caldo de pollo", unit: "kg", cat: "epicerie" },
  { id: "curcuma", fr: "Curcuma", es: "Cúrcuma", unit: "kg", cat: "epices" },
  { id: "cardamome", fr: "Cardamome", es: "Cardamomo", unit: "kg", cat: "epices" },
  { id: "girofle", fr: "Clou de girofle", es: "Clavo de olor", unit: "kg", cat: "epices" },
  { id: "herbes_provence", fr: "Herbes de Provence", es: "Hierbas provenzales", unit: "kg", cat: "epices" },
  { id: "origan", fr: "Origan", es: "Orégano", unit: "kg", cat: "epices" },
  { id: "romarin", fr: "Romarin", es: "Romero", unit: "kg", cat: "epices" },
  { id: "sauge", fr: "Sauge", es: "Salvia", unit: "kg", cat: "epices" },
  { id: "estragon", fr: "Estragon", es: "Estragón", unit: "kg", cat: "epices" },
  { id: "fleur_de_sel", fr: "Fleur de sel", es: "Flor de sal", unit: "kg", cat: "epices" },
  { id: "poivre_blanc", fr: "Poivre blanc", es: "Pimienta blanca", unit: "kg", cat: "epices" },
  { id: "vanille", fr: "Gousse de vanille", es: "Vaina de vainilla", unit: "U", cat: "epices" },
  { id: "sucre_vanille", fr: "Sucre vanillé", es: "Azúcar avainillado", unit: "kg", cat: "epices" },
  { id: "eau_plate", fr: "Eau minérale plate", es: "Agua mineral sin gas", unit: "L", cat: "boissons" },
  { id: "eau_gazeuse", fr: "Eau gazeuse", es: "Agua con gas", unit: "L", cat: "boissons" },
  { id: "jus_orange", fr: "Jus d'orange", es: "Zumo de naranja", unit: "L", cat: "boissons" },
  { id: "jus_pomme", fr: "Jus de pomme", es: "Zumo de manzana", unit: "L", cat: "boissons" },
  { id: "soda_cola", fr: "Soda cola", es: "Refresco de cola", unit: "L", cat: "boissons" },
  { id: "cafe_grains", fr: "Café en grains", es: "Café en grano", unit: "kg", cat: "boissons" },
  { id: "cafe_moulu", fr: "Café moulu", es: "Café molido", unit: "kg", cat: "boissons" },
  { id: "the_noir", fr: "Thé noir", es: "Té negro", unit: "kg", cat: "boissons" },
  { id: "vin_rose", fr: "Vin rosé de cuisine", es: "Vino rosado de cocina", unit: "L", cat: "boissons" },
  { id: "champagne", fr: "Champagne", es: "Champán", unit: "L", cat: "boissons" },
  { id: "whisky", fr: "Whisky", es: "Whisky", unit: "L", cat: "boissons" },
  { id: "vodka", fr: "Vodka", es: "Vodka", unit: "L", cat: "boissons" },
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
    appTitle: "Marge en cuisine", saved: "Enregistré", loading: "Chargement…", greeting: "Bonjour Chef 👋",
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
    scanLinkedSure: "Ingrédient existant", scanLinkedGuess: "Suggestion, vérifie",
    scanRenameHint: (n) => `Renommer l'ingrédient existant en "${n}"`,
    scanPriceCorrected: "prix recalculé (total ÷ qté)",
    scanPriceCorrectedHint: "Le prix unitaire lu semblait incohérent avec le total, on l'a recalculé automatiquement.",
    scanPriceSame: "Prix inchangé", scanPriceDecrease: "Prix en baisse",
    scanBulkPackaging: "Conditionnement groupé — vérifie",
    scanPriceInconsistent: "Écart avec le total imprimé, vérifie",
    scanExpectedTotal: "attendu", scanPrintedTotal: "imprimé :",
    scanConfirmBigChange: "Confirmer ce changement important",
    scanManyUpWarning: "Plusieurs prix semblent en forte hausse par rapport à tes prix connus — vérifie que le document est bien net avant d'importer.",
    scanImport: "Importer", scanImported: "Importé ✓", scanImportAll: "Importer les lignes sûres",
    scanPriceIncrease: "Prix en hausse", scanNoItems: "Aucun article détecté.",
    scanHint: "Vérifie et corrige chaque ligne avant d'importer — l'IA peut se tromper.",
    scanWeightLabel: "Poids d'1 pièce (laisse à 0 si vraiment à l'unité) :",
    scanTab: "Scanner", scanTabHint: "Prends en photo une facture ou un ticket fournisseur : l'IA extrait les articles automatiquement.",
  },
  es: {
    appTitle: "Margen en cocina", saved: "Guardado", loading: "Cargando…", greeting: "Hola Chef 👋",
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
    scanLinkedSure: "Ingrediente existente", scanLinkedGuess: "Sugerencia, verifica",
    scanRenameHint: (n) => `Renombrar el ingrediente existente a "${n}"`,
    scanPriceCorrected: "precio recalculado (total ÷ cant.)",
    scanPriceCorrectedHint: "El precio unitario leído parecía inconsistente con el total, se recalculó automáticamente.",
    scanPriceSame: "Precio sin cambios", scanPriceDecrease: "Precio a la baja",
    scanBulkPackaging: "Embalaje agrupado — verifica",
    scanPriceInconsistent: "Diferencia con el total impreso, verifica",
    scanExpectedTotal: "esperado", scanPrintedTotal: "impreso:",
    scanConfirmBigChange: "Confirmar este cambio importante",
    scanManyUpWarning: "Varios precios parecen estar muy al alza respecto a tus precios conocidos — verifica que el documento esté bien nítido antes de importar.",
    scanImport: "Importar", scanImported: "Importado ✓", scanImportAll: "Importar las líneas seguras",
    scanPriceIncrease: "Precio en alza", scanNoItems: "No se detectó ningún artículo.",
    scanHint: "Revisa y corrige cada línea antes de importar — la IA puede equivocarse.",
    scanWeightLabel: "Peso de 1 unidad (deja 0 si es realmente por unidad):",
    scanTab: "Escanear", scanTabHint: "Haz una foto de una factura o ticket de proveedor: la IA extrae los artículos automáticamente.",
  },
};

const SEED_INGREDIENTS = [
  { id: "i1", name: "Bœuf (paleron / gîte)", unit: "kg", catalogId: "boeuf", category: "viandes",
    selectedSupplierId: "s1", suppliers: [{ id: "s1", name: "Métro", price: 14.5, priceSource: "estimate" }],
    history: [{ date: "2026-05-02", price: 13.9, supplierName: "Métro" }] },
  { id: "i2", name: "Carottes", unit: "kg", catalogId: "carottes", category: "legumes",
    selectedSupplierId: "s2", suppliers: [{ id: "s2", name: "Grossiste local", price: 1.2, priceSource: "estimate" }], history: [] },
  { id: "i3", name: "Oignons", unit: "kg", catalogId: "oignons", category: "legumes",
    selectedSupplierId: "s3", suppliers: [{ id: "s3", name: "Grossiste local", price: 1.1, priceSource: "estimate" }], history: [] },
  { id: "i4", name: "Vin rouge de cuisine", unit: "L", catalogId: "vin_rouge", category: "boissons",
    selectedSupplierId: "s4", suppliers: [{ id: "s4", name: "Cavavin Pro", price: 4.5, priceSource: "estimate" }], history: [] },
  { id: "i5", name: "Lardons", unit: "kg", catalogId: null, category: "viandes",
    selectedSupplierId: "s5", suppliers: [{ id: "s5", name: "Métro", price: 9.8, priceSource: "estimate" }], history: [] },
  { id: "i6", name: "Champignons de Paris", unit: "kg", catalogId: "champignons", category: "legumes",
    selectedSupplierId: "s6", suppliers: [{ id: "s6", name: "Grossiste local", price: 5.2, priceSource: "estimate" }], history: [] },
  { id: "i7", name: "Beurre doux", unit: "kg", catalogId: "beurre", category: "cremerie",
    selectedSupplierId: "s7",
    suppliers: [{ id: "s7", name: "Métro", price: 7.5, priceSource: "estimate" }, { id: "s7b", name: "Transgourmet", price: 7.1, priceSource: "estimate" }],
    history: [] },
  { id: "i8", name: "Poulet entier", unit: "kg", catalogId: "poulet", category: "viandes",
    selectedSupplierId: "s8", suppliers: [{ id: "s8", name: "Métro", price: 4.9, priceSource: "estimate" }], history: [] },
  { id: "i9", name: "Échine de porc", unit: "kg", catalogId: "porc", category: "viandes",
    selectedSupplierId: "s9", suppliers: [{ id: "s9", name: "Métro", price: 8.5, priceSource: "estimate" }], history: [] },
  { id: "i10", name: "Gigot d'agneau", unit: "kg", catalogId: "agneau", category: "viandes",
    selectedSupplierId: "s10", suppliers: [{ id: "s10", name: "Métro", price: 16.9, priceSource: "estimate" }], history: [] },
  { id: "i11", name: "Escalope de dinde", unit: "kg", catalogId: "dinde", category: "viandes",
    selectedSupplierId: "s11", suppliers: [{ id: "s11", name: "Métro", price: 9.8, priceSource: "estimate" }], history: [] },
  { id: "i12", name: "Magret de canard", unit: "kg", catalogId: "canard", category: "viandes",
    selectedSupplierId: "s12", suppliers: [{ id: "s12", name: "Métro", price: 18.5, priceSource: "estimate" }], history: [] },
  { id: "i13", name: "Chorizo", unit: "kg", catalogId: "chorizo", category: "viandes",
    selectedSupplierId: "s13", suppliers: [{ id: "s13", name: "Métro", price: 11.9, priceSource: "estimate" }], history: [] },
  { id: "i14", name: "Jambon cru", unit: "kg", catalogId: "jambon_cru", category: "viandes",
    selectedSupplierId: "s14", suppliers: [{ id: "s14", name: "Métro", price: 22.0, priceSource: "estimate" }], history: [] },
  { id: "i15", name: "Jambon blanc", unit: "kg", catalogId: "jambon_blanc", category: "viandes",
    selectedSupplierId: "s15", suppliers: [{ id: "s15", name: "Métro", price: 9.5, priceSource: "estimate" }], history: [] },
  { id: "i16", name: "Pavé de saumon", unit: "kg", catalogId: "saumon", category: "poissons",
    selectedSupplierId: "s16", suppliers: [{ id: "s16", name: "Métro", price: 19.9, priceSource: "estimate" }], history: [] },
  { id: "i17", name: "Dos de cabillaud", unit: "kg", catalogId: "cabillaud", category: "poissons",
    selectedSupplierId: "s17", suppliers: [{ id: "s17", name: "Métro", price: 24.0, priceSource: "estimate" }], history: [] },
  { id: "i18", name: "Crevettes", unit: "kg", catalogId: "crevettes", category: "poissons",
    selectedSupplierId: "s18", suppliers: [{ id: "s18", name: "Métro", price: 18.5, priceSource: "estimate" }], history: [] },
  { id: "i19", name: "Thon rouge", unit: "kg", catalogId: "thon", category: "poissons",
    selectedSupplierId: "s19", suppliers: [{ id: "s19", name: "Métro", price: 28.0, priceSource: "estimate" }], history: [] },
  { id: "i20", name: "Filet de bar", unit: "kg", catalogId: "bar", category: "poissons",
    selectedSupplierId: "s20", suppliers: [{ id: "s20", name: "Métro", price: 26.0, priceSource: "estimate" }], history: [] },
  { id: "i21", name: "Dorade", unit: "kg", catalogId: "dorade", category: "poissons",
    selectedSupplierId: "s21", suppliers: [{ id: "s21", name: "Métro", price: 15.9, priceSource: "estimate" }], history: [] },
  { id: "i22", name: "Moules", unit: "kg", catalogId: "moules", category: "poissons",
    selectedSupplierId: "s22", suppliers: [{ id: "s22", name: "Métro", price: 4.5, priceSource: "estimate" }], history: [] },
  { id: "i23", name: "Poulpe", unit: "kg", catalogId: "poulpe", category: "poissons",
    selectedSupplierId: "s23", suppliers: [{ id: "s23", name: "Métro", price: 14.9, priceSource: "estimate" }], history: [] },
  { id: "i24", name: "Anchois", unit: "kg", catalogId: "anchois", category: "poissons",
    selectedSupplierId: "s24", suppliers: [{ id: "s24", name: "Métro", price: 12.0, priceSource: "estimate" }], history: [] },
  { id: "i25", name: "Ail", unit: "kg", catalogId: "ail", category: "legumes",
    selectedSupplierId: "s25", suppliers: [{ id: "s25", name: "Grossiste local", price: 4.5, priceSource: "estimate" }], history: [] },
  { id: "i26", name: "Pommes de terre", unit: "kg", catalogId: "pommes_de_terre", category: "legumes",
    selectedSupplierId: "s26", suppliers: [{ id: "s26", name: "Grossiste local", price: 1.0, priceSource: "estimate" }], history: [] },
  { id: "i27", name: "Tomates", unit: "kg", catalogId: "tomates", category: "legumes",
    selectedSupplierId: "s27", suppliers: [{ id: "s27", name: "Grossiste local", price: 2.2, priceSource: "estimate" }], history: [] },
  { id: "i28", name: "Courgettes", unit: "kg", catalogId: "courgettes", category: "legumes",
    selectedSupplierId: "s28", suppliers: [{ id: "s28", name: "Grossiste local", price: 1.9, priceSource: "estimate" }], history: [] },
  { id: "i29", name: "Aubergines", unit: "kg", catalogId: "aubergines", category: "legumes",
    selectedSupplierId: "s29", suppliers: [{ id: "s29", name: "Grossiste local", price: 2.1, priceSource: "estimate" }], history: [] },
  { id: "i30", name: "Poivrons rouges", unit: "kg", catalogId: "poivrons", category: "legumes",
    selectedSupplierId: "s30", suppliers: [{ id: "s30", name: "Grossiste local", price: 3.2, priceSource: "estimate" }], history: [] },
  { id: "i31", name: "Salade / Laitue", unit: "pièce", catalogId: "salade", category: "legumes",
    selectedSupplierId: "s31", suppliers: [{ id: "s31", name: "Grossiste local", price: 0.9, priceSource: "estimate" }], history: [] },
  { id: "i32", name: "Poireaux", unit: "kg", catalogId: "poireaux", category: "legumes",
    selectedSupplierId: "s32", suppliers: [{ id: "s32", name: "Grossiste local", price: 1.8, priceSource: "estimate" }], history: [] },
  { id: "i33", name: "Épinards", unit: "kg", catalogId: "epinards", category: "legumes",
    selectedSupplierId: "s33", suppliers: [{ id: "s33", name: "Grossiste local", price: 3.5, priceSource: "estimate" }], history: [] },
  { id: "i34", name: "Petits pois", unit: "kg", catalogId: "petits_pois", category: "legumes",
    selectedSupplierId: "s34", suppliers: [{ id: "s34", name: "Grossiste local", price: 3.0, priceSource: "estimate" }], history: [] },
  { id: "i35", name: "Concombre", unit: "pièce", catalogId: "concombre", category: "legumes",
    selectedSupplierId: "s35", suppliers: [{ id: "s35", name: "Grossiste local", price: 0.7, priceSource: "estimate" }], history: [] },
  { id: "i36", name: "Citron", unit: "pièce", catalogId: "citron", category: "fruits",
    selectedSupplierId: "s36", suppliers: [{ id: "s36", name: "Grossiste local", price: 0.35, priceSource: "estimate" }], history: [] },
  { id: "i37", name: "Crème liquide 30%", unit: "L", catalogId: "creme", category: "cremerie",
    selectedSupplierId: "s37", suppliers: [{ id: "s37", name: "Métro", price: 4.5, priceSource: "estimate" }], history: [] },
  { id: "i38", name: "Crème fraîche", unit: "L", catalogId: "creme_fraiche", category: "cremerie",
    selectedSupplierId: "s38", suppliers: [{ id: "s38", name: "Métro", price: 4.2, priceSource: "estimate" }], history: [] },
  { id: "i39", name: "Lait entier", unit: "L", catalogId: "lait", category: "cremerie",
    selectedSupplierId: "s39", suppliers: [{ id: "s39", name: "Métro", price: 1.1, priceSource: "estimate" }], history: [] },
  { id: "i40", name: "Fromage râpé", unit: "kg", catalogId: "fromage_rape", category: "cremerie",
    selectedSupplierId: "s40", suppliers: [{ id: "s40", name: "Métro", price: 8.9, priceSource: "estimate" }], history: [] },
  { id: "i41", name: "Mozzarella", unit: "kg", catalogId: "mozzarella", category: "cremerie",
    selectedSupplierId: "s41", suppliers: [{ id: "s41", name: "Métro", price: 7.5, priceSource: "estimate" }], history: [] },
  { id: "i42", name: "Yaourt nature", unit: "pièce", catalogId: "yaourt", category: "cremerie",
    selectedSupplierId: "s42", suppliers: [{ id: "s42", name: "Métro", price: 0.35, priceSource: "estimate" }], history: [] },
  { id: "i43", name: "Mascarpone", unit: "kg", catalogId: "mascarpone", category: "cremerie",
    selectedSupplierId: "s43", suppliers: [{ id: "s43", name: "Métro", price: 9.5, priceSource: "estimate" }], history: [] },
  { id: "i44", name: "Fromage de chèvre", unit: "kg", catalogId: "chevre", category: "cremerie",
    selectedSupplierId: "s44", suppliers: [{ id: "s44", name: "Métro", price: 14.0, priceSource: "estimate" }], history: [] },
  { id: "i45", name: "Parmesan", unit: "kg", catalogId: "parmesan", category: "cremerie",
    selectedSupplierId: "s45", suppliers: [{ id: "s45", name: "Métro", price: 22.0, priceSource: "estimate" }], history: [] },
  { id: "i46", name: "Œufs", unit: "pièce", catalogId: "oeufs", category: "cremerie",
    selectedSupplierId: "s46", suppliers: [{ id: "s46", name: "Métro", price: 0.28, priceSource: "estimate" }], history: [] },
  { id: "i47", name: "Farine T55", unit: "kg", catalogId: "farine", category: "epicerie",
    selectedSupplierId: "s47", suppliers: [{ id: "s47", name: "Métro", price: 0.9, priceSource: "estimate" }], history: [] },
  { id: "i48", name: "Sucre en poudre", unit: "kg", catalogId: "sucre", category: "epicerie",
    selectedSupplierId: "s48", suppliers: [{ id: "s48", name: "Métro", price: 1.1, priceSource: "estimate" }], history: [] },
  { id: "i49", name: "Sel fin", unit: "kg", catalogId: "sel", category: "epicerie",
    selectedSupplierId: "s49", suppliers: [{ id: "s49", name: "Métro", price: 0.8, priceSource: "estimate" }], history: [] },
  { id: "i50", name: "Poivre noir", unit: "kg", catalogId: "poivre", category: "epicerie",
    selectedSupplierId: "s50", suppliers: [{ id: "s50", name: "Métro", price: 18.0, priceSource: "estimate" }], history: [] },
  { id: "i51", name: "Riz Basmati", unit: "kg", catalogId: "riz", category: "epicerie",
    selectedSupplierId: "s51", suppliers: [{ id: "s51", name: "Métro", price: 2.2, priceSource: "estimate" }], history: [] },
  { id: "i52", name: "Pâtes Penne", unit: "kg", catalogId: "pates", category: "epicerie",
    selectedSupplierId: "s52", suppliers: [{ id: "s52", name: "Métro", price: 1.8, priceSource: "estimate" }], history: [] },
  { id: "i53", name: "Huile d'olive", unit: "L", catalogId: "huile_olive", category: "epicerie",
    selectedSupplierId: "s53", suppliers: [{ id: "s53", name: "Métro", price: 6.9, priceSource: "estimate" }], history: [] },
  { id: "i54", name: "Huile de tournesol", unit: "L", catalogId: "huile_tournesol", category: "epicerie",
    selectedSupplierId: "s54", suppliers: [{ id: "s54", name: "Métro", price: 2.2, priceSource: "estimate" }], history: [] },
  { id: "i55", name: "Huile de sésame", unit: "L", catalogId: "huile_sesame", category: "epicerie",
    selectedSupplierId: "s55", suppliers: [{ id: "s55", name: "Métro", price: 9.5, priceSource: "estimate" }], history: [] },
  { id: "i56", name: "Moutarde", unit: "kg", catalogId: "moutarde", category: "epicerie",
    selectedSupplierId: "s56", suppliers: [{ id: "s56", name: "Métro", price: 4.2, priceSource: "estimate" }], history: [] },
  { id: "i57", name: "Sauce soja", unit: "L", catalogId: "sauce_soja", category: "epicerie",
    selectedSupplierId: "s57", suppliers: [{ id: "s57", name: "Métro", price: 3.8, priceSource: "estimate" }], history: [] },
  { id: "i58", name: "Vinaigre balsamique", unit: "L", catalogId: "vinaigre_balsamique", category: "epicerie",
    selectedSupplierId: "s58", suppliers: [{ id: "s58", name: "Métro", price: 6.5, priceSource: "estimate" }], history: [] },
  { id: "i59", name: "Vinaigre de vin", unit: "L", catalogId: "vinaigre_vin", category: "epicerie",
    selectedSupplierId: "s59", suppliers: [{ id: "s59", name: "Métro", price: 2.8, priceSource: "estimate" }], history: [] },
  { id: "i60", name: "Ketchup", unit: "kg", catalogId: "ketchup", category: "epicerie",
    selectedSupplierId: "s60", suppliers: [{ id: "s60", name: "Métro", price: 3.2, priceSource: "estimate" }], history: [] },
  { id: "i61", name: "Mayonnaise", unit: "kg", catalogId: "mayonnaise", category: "epicerie",
    selectedSupplierId: "s61", suppliers: [{ id: "s61", name: "Métro", price: 4.5, priceSource: "estimate" }], history: [] },
  { id: "i62", name: "Miel", unit: "kg", catalogId: "miel", category: "epicerie",
    selectedSupplierId: "s62", suppliers: [{ id: "s62", name: "Métro", price: 9.9, priceSource: "estimate" }], history: [] },
  { id: "i63", name: "Maïzena", unit: "kg", catalogId: "maizena", category: "epicerie",
    selectedSupplierId: "s63", suppliers: [{ id: "s63", name: "Métro", price: 3.5, priceSource: "estimate" }], history: [] },
  { id: "i64", name: "Quinoa", unit: "kg", catalogId: "quinoa", category: "epicerie",
    selectedSupplierId: "s64", suppliers: [{ id: "s64", name: "Métro", price: 6.5, priceSource: "estimate" }], history: [] },
  { id: "i65", name: "Semoule / Couscous", unit: "kg", catalogId: "couscous", category: "epicerie",
    selectedSupplierId: "s65", suppliers: [{ id: "s65", name: "Métro", price: 2.2, priceSource: "estimate" }], history: [] },
  { id: "i66", name: "Amandes", unit: "kg", catalogId: "amandes", category: "epicerie",
    selectedSupplierId: "s66", suppliers: [{ id: "s66", name: "Métro", price: 12.0, priceSource: "estimate" }], history: [] },
  { id: "i67", name: "Noisettes", unit: "kg", catalogId: "noisettes", category: "epicerie",
    selectedSupplierId: "s67", suppliers: [{ id: "s67", name: "Métro", price: 14.0, priceSource: "estimate" }], history: [] },
  { id: "i68", name: "Chocolat noir", unit: "kg", catalogId: "chocolat_noir", category: "epicerie",
    selectedSupplierId: "s68", suppliers: [{ id: "s68", name: "Métro", price: 9.5, priceSource: "estimate" }], history: [] },
  { id: "i69", name: "Paprika", unit: "kg", catalogId: "paprika", category: "epices",
    selectedSupplierId: "s69", suppliers: [{ id: "s69", name: "Métro", price: 22.0, priceSource: "estimate" }], history: [] },
  { id: "i70", name: "Cumin", unit: "kg", catalogId: "cumin", category: "epices",
    selectedSupplierId: "s70", suppliers: [{ id: "s70", name: "Métro", price: 20.0, priceSource: "estimate" }], history: [] },
  { id: "i71", name: "Thym", unit: "kg", catalogId: "thym", category: "epices",
    selectedSupplierId: "s71", suppliers: [{ id: "s71", name: "Métro", price: 30.0, priceSource: "estimate" }], history: [] },
  { id: "i72", name: "Laurier", unit: "kg", catalogId: "laurier", category: "epices",
    selectedSupplierId: "s72", suppliers: [{ id: "s72", name: "Métro", price: 28.0, priceSource: "estimate" }], history: [] },
  { id: "i73", name: "Basilic frais", unit: "kg", catalogId: "basilic", category: "epices",
    selectedSupplierId: "s73", suppliers: [{ id: "s73", name: "Métro", price: 18.0, priceSource: "estimate" }], history: [] },
  { id: "i74", name: "Persil frais", unit: "kg", catalogId: "persil", category: "epices",
    selectedSupplierId: "s74", suppliers: [{ id: "s74", name: "Métro", price: 14.0, priceSource: "estimate" }], history: [] },
  { id: "i75", name: "Cannelle", unit: "kg", catalogId: "cannelle", category: "epices",
    selectedSupplierId: "s75", suppliers: [{ id: "s75", name: "Métro", price: 26.0, priceSource: "estimate" }], history: [] },
  { id: "i76", name: "Vin blanc de cuisine", unit: "L", catalogId: "vin_blanc", category: "boissons",
    selectedSupplierId: "s76", suppliers: [{ id: "s76", name: "Cavavin Pro", price: 4.5, priceSource: "estimate" }], history: [] },
  { id: "i77", name: "Bière", unit: "L", catalogId: "biere", category: "boissons",
    selectedSupplierId: "s77", suppliers: [{ id: "s77", name: "Cavavin Pro", price: 2.2, priceSource: "estimate" }], history: [] },
  { id: "i78", name: "Porto", unit: "L", catalogId: "porto", category: "boissons",
    selectedSupplierId: "s78", suppliers: [{ id: "s78", name: "Cavavin Pro", price: 8.9, priceSource: "estimate" }], history: [] },
  { id: "i79", name: "Xérès / Jerez", unit: "L", catalogId: "jerez", category: "boissons",
    selectedSupplierId: "s79", suppliers: [{ id: "s79", name: "Cavavin Pro", price: 9.5, priceSource: "estimate" }], history: [] },
  { id: "i80", name: "Rhum", unit: "L", catalogId: "rhum", category: "boissons",
    selectedSupplierId: "s80", suppliers: [{ id: "s80", name: "Cavavin Pro", price: 14.0, priceSource: "estimate" }], history: [] },
  { id: "i81", name: "Cognac", unit: "L", catalogId: "cognac", category: "boissons",
    selectedSupplierId: "s81", suppliers: [{ id: "s81", name: "Cavavin Pro", price: 22.0, priceSource: "estimate" }], history: [] },
  { id: "i82", name: "Steak haché 15%", unit: "kg", catalogId: "steak_hache", category: "viandes",
    selectedSupplierId: "s82", suppliers: [{ id: "s82", name: "Métro", price: 10.5, priceSource: "estimate" }], history: [] },
  { id: "i83", name: "Entrecôte", unit: "kg", catalogId: "entrecote", category: "viandes",
    selectedSupplierId: "s83", suppliers: [{ id: "s83", name: "Métro", price: 19.9, priceSource: "estimate" }], history: [] },
  { id: "i84", name: "Filet de bœuf", unit: "kg", catalogId: "filet_boeuf", category: "viandes",
    selectedSupplierId: "s84", suppliers: [{ id: "s84", name: "Métro", price: 32.0, priceSource: "estimate" }], history: [] },
  { id: "i85", name: "Rumsteck", unit: "kg", catalogId: "rumsteck", category: "viandes",
    selectedSupplierId: "s85", suppliers: [{ id: "s85", name: "Métro", price: 15.5, priceSource: "estimate" }], history: [] },
  { id: "i86", name: "Bavette", unit: "kg", catalogId: "bavette", category: "viandes",
    selectedSupplierId: "s86", suppliers: [{ id: "s86", name: "Métro", price: 13.9, priceSource: "estimate" }], history: [] },
  { id: "i87", name: "Côte de porc", unit: "kg", catalogId: "cote_porc", category: "viandes",
    selectedSupplierId: "s87", suppliers: [{ id: "s87", name: "Métro", price: 7.9, priceSource: "estimate" }], history: [] },
  { id: "i88", name: "Lardons fumés", unit: "kg", catalogId: "lardons_fumes", category: "viandes",
    selectedSupplierId: "s88", suppliers: [{ id: "s88", name: "Métro", price: 8.9, priceSource: "estimate" }], history: [] },
  { id: "i89", name: "Saucisse de Toulouse", unit: "kg", catalogId: "saucisse_toulouse", category: "viandes",
    selectedSupplierId: "s89", suppliers: [{ id: "s89", name: "Métro", price: 7.5, priceSource: "estimate" }], history: [] },
  { id: "i90", name: "Merguez", unit: "kg", catalogId: "merguez", category: "viandes",
    selectedSupplierId: "s90", suppliers: [{ id: "s90", name: "Métro", price: 8.9, priceSource: "estimate" }], history: [] },
  { id: "i91", name: "Foie gras cru", unit: "kg", catalogId: "foie_gras", category: "viandes",
    selectedSupplierId: "s91", suppliers: [{ id: "s91", name: "Métro", price: 55.0, priceSource: "estimate" }], history: [] },
  { id: "i92", name: "Lapin entier", unit: "kg", catalogId: "lapin", category: "viandes",
    selectedSupplierId: "s92", suppliers: [{ id: "s92", name: "Métro", price: 9.5, priceSource: "estimate" }], history: [] },
  { id: "i93", name: "Escalope de veau", unit: "kg", catalogId: "veau_escalope", category: "viandes",
    selectedSupplierId: "s93", suppliers: [{ id: "s93", name: "Métro", price: 21.0, priceSource: "estimate" }], history: [] },
  { id: "i94", name: "Pintade", unit: "kg", catalogId: "pintade", category: "viandes",
    selectedSupplierId: "s94", suppliers: [{ id: "s94", name: "Métro", price: 9.9, priceSource: "estimate" }], history: [] },
  { id: "i95", name: "Maquereau", unit: "kg", catalogId: "maquereau", category: "poissons",
    selectedSupplierId: "s95", suppliers: [{ id: "s95", name: "Métro", price: 8.9, priceSource: "estimate" }], history: [] },
  { id: "i96", name: "Sardine", unit: "kg", catalogId: "sardine", category: "poissons",
    selectedSupplierId: "s96", suppliers: [{ id: "s96", name: "Métro", price: 7.5, priceSource: "estimate" }], history: [] },
  { id: "i97", name: "Truite", unit: "kg", catalogId: "truite", category: "poissons",
    selectedSupplierId: "s97", suppliers: [{ id: "s97", name: "Métro", price: 11.9, priceSource: "estimate" }], history: [] },
  { id: "i98", name: "Lieu noir", unit: "kg", catalogId: "lieu_noir", category: "poissons",
    selectedSupplierId: "s98", suppliers: [{ id: "s98", name: "Métro", price: 13.5, priceSource: "estimate" }], history: [] },
  { id: "i99", name: "Sole", unit: "kg", catalogId: "sole", category: "poissons",
    selectedSupplierId: "s99", suppliers: [{ id: "s99", name: "Métro", price: 32.0, priceSource: "estimate" }], history: [] },
  { id: "i100", name: "Seiche", unit: "kg", catalogId: "seiche", category: "poissons",
    selectedSupplierId: "s100", suppliers: [{ id: "s100", name: "Métro", price: 13.9, priceSource: "estimate" }], history: [] },
  { id: "i101", name: "Calamar", unit: "kg", catalogId: "calamar", category: "poissons",
    selectedSupplierId: "s101", suppliers: [{ id: "s101", name: "Métro", price: 15.9, priceSource: "estimate" }], history: [] },
  { id: "i102", name: "Langoustine", unit: "kg", catalogId: "langoustine", category: "poissons",
    selectedSupplierId: "s102", suppliers: [{ id: "s102", name: "Métro", price: 29.0, priceSource: "estimate" }], history: [] },
  { id: "i103", name: "Huîtres", unit: "pièce", catalogId: "huitres", category: "poissons",
    selectedSupplierId: "s103", suppliers: [{ id: "s103", name: "Métro", price: 0.9, priceSource: "estimate" }], history: [] },
  { id: "i104", name: "Noix de Saint-Jacques", unit: "kg", catalogId: "saint_jacques", category: "poissons",
    selectedSupplierId: "s104", suppliers: [{ id: "s104", name: "Métro", price: 38.0, priceSource: "estimate" }], history: [] },
  { id: "i105", name: "Saumon fumé", unit: "kg", catalogId: "saumon_fume", category: "poissons",
    selectedSupplierId: "s105", suppliers: [{ id: "s105", name: "Métro", price: 32.0, priceSource: "estimate" }], history: [] },
  { id: "i106", name: "Tarama", unit: "kg", catalogId: "tarama", category: "poissons",
    selectedSupplierId: "s106", suppliers: [{ id: "s106", name: "Métro", price: 14.0, priceSource: "estimate" }], history: [] },
  { id: "i107", name: "Surimi", unit: "kg", catalogId: "surimi", category: "poissons",
    selectedSupplierId: "s107", suppliers: [{ id: "s107", name: "Métro", price: 6.5, priceSource: "estimate" }], history: [] },
  { id: "i108", name: "Radis", unit: "kg", catalogId: "radis", category: "legumes",
    selectedSupplierId: "s108", suppliers: [{ id: "s108", name: "Grossiste local", price: 2.5, priceSource: "estimate" }], history: [] },
  { id: "i109", name: "Betterave", unit: "kg", catalogId: "betterave", category: "legumes",
    selectedSupplierId: "s109", suppliers: [{ id: "s109", name: "Grossiste local", price: 1.8, priceSource: "estimate" }], history: [] },
  { id: "i110", name: "Navet", unit: "kg", catalogId: "navet", category: "legumes",
    selectedSupplierId: "s110", suppliers: [{ id: "s110", name: "Grossiste local", price: 1.6, priceSource: "estimate" }], history: [] },
  { id: "i111", name: "Fenouil", unit: "kg", catalogId: "fenouil", category: "legumes",
    selectedSupplierId: "s111", suppliers: [{ id: "s111", name: "Grossiste local", price: 2.9, priceSource: "estimate" }], history: [] },
  { id: "i112", name: "Artichaut", unit: "pièce", catalogId: "artichaut", category: "legumes",
    selectedSupplierId: "s112", suppliers: [{ id: "s112", name: "Grossiste local", price: 1.2, priceSource: "estimate" }], history: [] },
  { id: "i113", name: "Asperge verte", unit: "kg", catalogId: "asperge", category: "legumes",
    selectedSupplierId: "s113", suppliers: [{ id: "s113", name: "Grossiste local", price: 6.9, priceSource: "estimate" }], history: [] },
  { id: "i114", name: "Chou blanc", unit: "kg", catalogId: "chou_blanc", category: "legumes",
    selectedSupplierId: "s114", suppliers: [{ id: "s114", name: "Grossiste local", price: 1.3, priceSource: "estimate" }], history: [] },
  { id: "i115", name: "Chou-fleur", unit: "pièce", catalogId: "chou_fleur", category: "legumes",
    selectedSupplierId: "s115", suppliers: [{ id: "s115", name: "Grossiste local", price: 2.2, priceSource: "estimate" }], history: [] },
  { id: "i116", name: "Chou de Bruxelles", unit: "kg", catalogId: "chou_bruxelles", category: "legumes",
    selectedSupplierId: "s116", suppliers: [{ id: "s116", name: "Grossiste local", price: 3.5, priceSource: "estimate" }], history: [] },
  { id: "i117", name: "Endive", unit: "kg", catalogId: "endive", category: "legumes",
    selectedSupplierId: "s117", suppliers: [{ id: "s117", name: "Grossiste local", price: 2.8, priceSource: "estimate" }], history: [] },
  { id: "i118", name: "Roquette", unit: "kg", catalogId: "roquette", category: "legumes",
    selectedSupplierId: "s118", suppliers: [{ id: "s118", name: "Grossiste local", price: 8.9, priceSource: "estimate" }], history: [] },
  { id: "i119", name: "Mâche", unit: "kg", catalogId: "mache", category: "legumes",
    selectedSupplierId: "s119", suppliers: [{ id: "s119", name: "Grossiste local", price: 9.5, priceSource: "estimate" }], history: [] },
  { id: "i120", name: "Patate douce", unit: "kg", catalogId: "patate_douce", category: "legumes",
    selectedSupplierId: "s120", suppliers: [{ id: "s120", name: "Grossiste local", price: 2.2, priceSource: "estimate" }], history: [] },
  { id: "i121", name: "Maïs doux", unit: "kg", catalogId: "mais_doux", category: "legumes",
    selectedSupplierId: "s121", suppliers: [{ id: "s121", name: "Grossiste local", price: 2.5, priceSource: "estimate" }], history: [] },
  { id: "i122", name: "Gingembre frais", unit: "kg", catalogId: "gingembre", category: "legumes",
    selectedSupplierId: "s122", suppliers: [{ id: "s122", name: "Grossiste local", price: 6.5, priceSource: "estimate" }], history: [] },
  { id: "i123", name: "Oignon rouge", unit: "kg", catalogId: "oignon_rouge", category: "legumes",
    selectedSupplierId: "s123", suppliers: [{ id: "s123", name: "Grossiste local", price: 1.8, priceSource: "estimate" }], history: [] },
  { id: "i124", name: "Ciboulette fraîche", unit: "kg", catalogId: "ciboulette", category: "legumes",
    selectedSupplierId: "s124", suppliers: [{ id: "s124", name: "Grossiste local", price: 18.0, priceSource: "estimate" }], history: [] },
  { id: "i125", name: "Coriandre fraîche", unit: "kg", catalogId: "coriandre", category: "legumes",
    selectedSupplierId: "s125", suppliers: [{ id: "s125", name: "Grossiste local", price: 14.0, priceSource: "estimate" }], history: [] },
  { id: "i126", name: "Menthe fraîche", unit: "kg", catalogId: "menthe", category: "legumes",
    selectedSupplierId: "s126", suppliers: [{ id: "s126", name: "Grossiste local", price: 14.0, priceSource: "estimate" }], history: [] },
  { id: "i127", name: "Citron vert", unit: "pièce", catalogId: "citron_vert", category: "fruits",
    selectedSupplierId: "s127", suppliers: [{ id: "s127", name: "Grossiste local", price: 0.4, priceSource: "estimate" }], history: [] },
  { id: "i128", name: "Pomme", unit: "kg", catalogId: "pomme", category: "fruits",
    selectedSupplierId: "s128", suppliers: [{ id: "s128", name: "Grossiste local", price: 1.9, priceSource: "estimate" }], history: [] },
  { id: "i129", name: "Orange", unit: "kg", catalogId: "orange", category: "fruits",
    selectedSupplierId: "s129", suppliers: [{ id: "s129", name: "Grossiste local", price: 1.8, priceSource: "estimate" }], history: [] },
  { id: "i130", name: "Banane", unit: "kg", catalogId: "banane", category: "fruits",
    selectedSupplierId: "s130", suppliers: [{ id: "s130", name: "Grossiste local", price: 1.7, priceSource: "estimate" }], history: [] },
  { id: "i131", name: "Fraise", unit: "kg", catalogId: "fraise", category: "fruits",
    selectedSupplierId: "s131", suppliers: [{ id: "s131", name: "Grossiste local", price: 5.5, priceSource: "estimate" }], history: [] },
  { id: "i132", name: "Avocat", unit: "pièce", catalogId: "avocat", category: "fruits",
    selectedSupplierId: "s132", suppliers: [{ id: "s132", name: "Grossiste local", price: 0.9, priceSource: "estimate" }], history: [] },
  { id: "i133", name: "Poire", unit: "kg", catalogId: "poire", category: "fruits",
    selectedSupplierId: "s133", suppliers: [{ id: "s133", name: "Grossiste local", price: 2.2, priceSource: "estimate" }], history: [] },
  { id: "i134", name: "Pêche", unit: "kg", catalogId: "peche", category: "fruits",
    selectedSupplierId: "s134", suppliers: [{ id: "s134", name: "Grossiste local", price: 2.9, priceSource: "estimate" }], history: [] },
  { id: "i135", name: "Abricot", unit: "kg", catalogId: "abricot", category: "fruits",
    selectedSupplierId: "s135", suppliers: [{ id: "s135", name: "Grossiste local", price: 3.5, priceSource: "estimate" }], history: [] },
  { id: "i136", name: "Prune", unit: "kg", catalogId: "prune", category: "fruits",
    selectedSupplierId: "s136", suppliers: [{ id: "s136", name: "Grossiste local", price: 2.8, priceSource: "estimate" }], history: [] },
  { id: "i137", name: "Raisin", unit: "kg", catalogId: "raisin", category: "fruits",
    selectedSupplierId: "s137", suppliers: [{ id: "s137", name: "Grossiste local", price: 3.9, priceSource: "estimate" }], history: [] },
  { id: "i138", name: "Melon", unit: "pièce", catalogId: "melon", category: "fruits",
    selectedSupplierId: "s138", suppliers: [{ id: "s138", name: "Grossiste local", price: 2.5, priceSource: "estimate" }], history: [] },
  { id: "i139", name: "Pastèque", unit: "kg", catalogId: "pasteque", category: "fruits",
    selectedSupplierId: "s139", suppliers: [{ id: "s139", name: "Grossiste local", price: 1.5, priceSource: "estimate" }], history: [] },
  { id: "i140", name: "Kiwi", unit: "kg", catalogId: "kiwi", category: "fruits",
    selectedSupplierId: "s140", suppliers: [{ id: "s140", name: "Grossiste local", price: 3.5, priceSource: "estimate" }], history: [] },
  { id: "i141", name: "Mangue", unit: "pièce", catalogId: "mangue", category: "fruits",
    selectedSupplierId: "s141", suppliers: [{ id: "s141", name: "Grossiste local", price: 1.8, priceSource: "estimate" }], history: [] },
  { id: "i142", name: "Ananas", unit: "pièce", catalogId: "ananas", category: "fruits",
    selectedSupplierId: "s142", suppliers: [{ id: "s142", name: "Grossiste local", price: 2.9, priceSource: "estimate" }], history: [] },
  { id: "i143", name: "Framboise", unit: "kg", catalogId: "framboise", category: "fruits",
    selectedSupplierId: "s143", suppliers: [{ id: "s143", name: "Grossiste local", price: 12.0, priceSource: "estimate" }], history: [] },
  { id: "i144", name: "Myrtille", unit: "kg", catalogId: "myrtille", category: "fruits",
    selectedSupplierId: "s144", suppliers: [{ id: "s144", name: "Grossiste local", price: 14.0, priceSource: "estimate" }], history: [] },
  { id: "i145", name: "Cerise", unit: "kg", catalogId: "cerise", category: "fruits",
    selectedSupplierId: "s145", suppliers: [{ id: "s145", name: "Grossiste local", price: 8.9, priceSource: "estimate" }], history: [] },
  { id: "i146", name: "Figue", unit: "kg", catalogId: "figue", category: "fruits",
    selectedSupplierId: "s146", suppliers: [{ id: "s146", name: "Grossiste local", price: 6.5, priceSource: "estimate" }], history: [] },
  { id: "i147", name: "Pamplemousse", unit: "pièce", catalogId: "pamplemousse", category: "fruits",
    selectedSupplierId: "s147", suppliers: [{ id: "s147", name: "Grossiste local", price: 1.2, priceSource: "estimate" }], history: [] },
  { id: "i148", name: "Noix de coco", unit: "pièce", catalogId: "noix_de_coco", category: "fruits",
    selectedSupplierId: "s148", suppliers: [{ id: "s148", name: "Grossiste local", price: 2.2, priceSource: "estimate" }], history: [] },
  { id: "i149", name: "Comté", unit: "kg", catalogId: "comte", category: "cremerie",
    selectedSupplierId: "s149", suppliers: [{ id: "s149", name: "Métro", price: 19.9, priceSource: "estimate" }], history: [] },
  { id: "i150", name: "Emmental", unit: "kg", catalogId: "emmental", category: "cremerie",
    selectedSupplierId: "s150", suppliers: [{ id: "s150", name: "Métro", price: 10.5, priceSource: "estimate" }], history: [] },
  { id: "i151", name: "Gruyère", unit: "kg", catalogId: "gruyere", category: "cremerie",
    selectedSupplierId: "s151", suppliers: [{ id: "s151", name: "Métro", price: 17.9, priceSource: "estimate" }], history: [] },
  { id: "i152", name: "Brie", unit: "kg", catalogId: "brie", category: "cremerie",
    selectedSupplierId: "s152", suppliers: [{ id: "s152", name: "Métro", price: 13.5, priceSource: "estimate" }], history: [] },
  { id: "i153", name: "Camembert", unit: "pièce", catalogId: "camembert", category: "cremerie",
    selectedSupplierId: "s153", suppliers: [{ id: "s153", name: "Métro", price: 3.2, priceSource: "estimate" }], history: [] },
  { id: "i154", name: "Roquefort", unit: "kg", catalogId: "roquefort", category: "cremerie",
    selectedSupplierId: "s154", suppliers: [{ id: "s154", name: "Métro", price: 24.0, priceSource: "estimate" }], history: [] },
  { id: "i155", name: "Feta", unit: "kg", catalogId: "feta", category: "cremerie",
    selectedSupplierId: "s155", suppliers: [{ id: "s155", name: "Métro", price: 9.9, priceSource: "estimate" }], history: [] },
  { id: "i156", name: "Ricotta", unit: "kg", catalogId: "ricotta", category: "cremerie",
    selectedSupplierId: "s156", suppliers: [{ id: "s156", name: "Métro", price: 7.5, priceSource: "estimate" }], history: [] },
  { id: "i157", name: "Fromage blanc", unit: "kg", catalogId: "fromage_blanc", category: "cremerie",
    selectedSupplierId: "s157", suppliers: [{ id: "s157", name: "Métro", price: 3.2, priceSource: "estimate" }], history: [] },
  { id: "i158", name: "Beurre demi-sel", unit: "kg", catalogId: "beurre_demi_sel", category: "cremerie",
    selectedSupplierId: "s158", suppliers: [{ id: "s158", name: "Métro", price: 7.8, priceSource: "estimate" }], history: [] },
  { id: "i159", name: "Margarine", unit: "kg", catalogId: "margarine", category: "cremerie",
    selectedSupplierId: "s159", suppliers: [{ id: "s159", name: "Métro", price: 3.5, priceSource: "estimate" }], history: [] },
  { id: "i160", name: "Skyr nature", unit: "kg", catalogId: "skyr", category: "cremerie",
    selectedSupplierId: "s160", suppliers: [{ id: "s160", name: "Métro", price: 5.9, priceSource: "estimate" }], history: [] },
  { id: "i161", name: "Pain de mie", unit: "kg", catalogId: "pain_mie", category: "epicerie",
    selectedSupplierId: "s161", suppliers: [{ id: "s161", name: "Métro", price: 3.2, priceSource: "estimate" }], history: [] },
  { id: "i162", name: "Farine de sarrasin", unit: "kg", catalogId: "farine_sarrasin", category: "epicerie",
    selectedSupplierId: "s162", suppliers: [{ id: "s162", name: "Métro", price: 2.9, priceSource: "estimate" }], history: [] },
  { id: "i163", name: "Levure boulangère", unit: "kg", catalogId: "levure_boulangere", category: "epicerie",
    selectedSupplierId: "s163", suppliers: [{ id: "s163", name: "Métro", price: 12.0, priceSource: "estimate" }], history: [] },
  { id: "i164", name: "Levure chimique", unit: "kg", catalogId: "levure_chimique", category: "epicerie",
    selectedSupplierId: "s164", suppliers: [{ id: "s164", name: "Métro", price: 6.5, priceSource: "estimate" }], history: [] },
  { id: "i165", name: "Bicarbonate de soude", unit: "kg", catalogId: "bicarbonate", category: "epicerie",
    selectedSupplierId: "s165", suppliers: [{ id: "s165", name: "Métro", price: 4.5, priceSource: "estimate" }], history: [] },
  { id: "i166", name: "Sucre glace", unit: "kg", catalogId: "sucre_glace", category: "epicerie",
    selectedSupplierId: "s166", suppliers: [{ id: "s166", name: "Métro", price: 1.8, priceSource: "estimate" }], history: [] },
  { id: "i167", name: "Cassonade", unit: "kg", catalogId: "cassonade", category: "epicerie",
    selectedSupplierId: "s167", suppliers: [{ id: "s167", name: "Métro", price: 2.2, priceSource: "estimate" }], history: [] },
  { id: "i168", name: "Confiture", unit: "kg", catalogId: "confiture", category: "epicerie",
    selectedSupplierId: "s168", suppliers: [{ id: "s168", name: "Métro", price: 4.5, priceSource: "estimate" }], history: [] },
  { id: "i169", name: "Pâte à tartiner", unit: "kg", catalogId: "pate_a_tartiner", category: "epicerie",
    selectedSupplierId: "s169", suppliers: [{ id: "s169", name: "Métro", price: 6.5, priceSource: "estimate" }], history: [] },
  { id: "i170", name: "Chapelure", unit: "kg", catalogId: "chapelure", category: "epicerie",
    selectedSupplierId: "s170", suppliers: [{ id: "s170", name: "Métro", price: 2.2, priceSource: "estimate" }], history: [] },
  { id: "i171", name: "Spaghetti", unit: "kg", catalogId: "spaghetti", category: "epicerie",
    selectedSupplierId: "s171", suppliers: [{ id: "s171", name: "Métro", price: 1.8, priceSource: "estimate" }], history: [] },
  { id: "i172", name: "Tagliatelles", unit: "kg", catalogId: "tagliatelles", category: "epicerie",
    selectedSupplierId: "s172", suppliers: [{ id: "s172", name: "Métro", price: 2.2, priceSource: "estimate" }], history: [] },
  { id: "i173", name: "Lentilles vertes", unit: "kg", catalogId: "lentilles_vertes", category: "epicerie",
    selectedSupplierId: "s173", suppliers: [{ id: "s173", name: "Métro", price: 3.2, priceSource: "estimate" }], history: [] },
  { id: "i174", name: "Pois chiches", unit: "kg", catalogId: "pois_chiches", category: "epicerie",
    selectedSupplierId: "s174", suppliers: [{ id: "s174", name: "Métro", price: 2.8, priceSource: "estimate" }], history: [] },
  { id: "i175", name: "Haricots rouges secs", unit: "kg", catalogId: "haricots_rouges", category: "epicerie",
    selectedSupplierId: "s175", suppliers: [{ id: "s175", name: "Métro", price: 3.2, priceSource: "estimate" }], history: [] },
  { id: "i176", name: "Tofu", unit: "kg", catalogId: "tofu", category: "epicerie",
    selectedSupplierId: "s176", suppliers: [{ id: "s176", name: "Métro", price: 6.5, priceSource: "estimate" }], history: [] },
  { id: "i177", name: "Noix de cajou", unit: "kg", catalogId: "noix_cajou", category: "epicerie",
    selectedSupplierId: "s177", suppliers: [{ id: "s177", name: "Métro", price: 14.0, priceSource: "estimate" }], history: [] },
  { id: "i178", name: "Pistaches", unit: "kg", catalogId: "pistaches", category: "epicerie",
    selectedSupplierId: "s178", suppliers: [{ id: "s178", name: "Métro", price: 22.0, priceSource: "estimate" }], history: [] },
  { id: "i179", name: "Tomates pelées en boîte", unit: "kg", catalogId: "tomates_pelees", category: "epicerie",
    selectedSupplierId: "s179", suppliers: [{ id: "s179", name: "Métro", price: 1.8, priceSource: "estimate" }], history: [] },
  { id: "i180", name: "Concentré de tomate", unit: "kg", catalogId: "concentre_tomate", category: "epicerie",
    selectedSupplierId: "s180", suppliers: [{ id: "s180", name: "Métro", price: 3.5, priceSource: "estimate" }], history: [] },
  { id: "i181", name: "Câpres", unit: "kg", catalogId: "capres", category: "epicerie",
    selectedSupplierId: "s181", suppliers: [{ id: "s181", name: "Métro", price: 9.5, priceSource: "estimate" }], history: [] },
  { id: "i182", name: "Olives vertes", unit: "kg", catalogId: "olives_vertes", category: "epicerie",
    selectedSupplierId: "s182", suppliers: [{ id: "s182", name: "Métro", price: 5.5, priceSource: "estimate" }], history: [] },
  { id: "i183", name: "Olives noires", unit: "kg", catalogId: "olives_noires", category: "epicerie",
    selectedSupplierId: "s183", suppliers: [{ id: "s183", name: "Métro", price: 6.5, priceSource: "estimate" }], history: [] },
  { id: "i184", name: "Cornichons", unit: "kg", catalogId: "cornichons", category: "epicerie",
    selectedSupplierId: "s184", suppliers: [{ id: "s184", name: "Métro", price: 4.9, priceSource: "estimate" }], history: [] },
  { id: "i185", name: "Bouillon de volaille", unit: "kg", catalogId: "bouillon_volaille", category: "epicerie",
    selectedSupplierId: "s185", suppliers: [{ id: "s185", name: "Métro", price: 9.5, priceSource: "estimate" }], history: [] },
  { id: "i186", name: "Curcuma", unit: "kg", catalogId: "curcuma", category: "epices",
    selectedSupplierId: "s186", suppliers: [{ id: "s186", name: "Métro", price: 18.0, priceSource: "estimate" }], history: [] },
  { id: "i187", name: "Cardamome", unit: "kg", catalogId: "cardamome", category: "epices",
    selectedSupplierId: "s187", suppliers: [{ id: "s187", name: "Métro", price: 65.0, priceSource: "estimate" }], history: [] },
  { id: "i188", name: "Clou de girofle", unit: "kg", catalogId: "girofle", category: "epices",
    selectedSupplierId: "s188", suppliers: [{ id: "s188", name: "Métro", price: 35.0, priceSource: "estimate" }], history: [] },
  { id: "i189", name: "Herbes de Provence", unit: "kg", catalogId: "herbes_provence", category: "epices",
    selectedSupplierId: "s189", suppliers: [{ id: "s189", name: "Métro", price: 16.0, priceSource: "estimate" }], history: [] },
  { id: "i190", name: "Origan", unit: "kg", catalogId: "origan", category: "epices",
    selectedSupplierId: "s190", suppliers: [{ id: "s190", name: "Métro", price: 18.0, priceSource: "estimate" }], history: [] },
  { id: "i191", name: "Romarin", unit: "kg", catalogId: "romarin", category: "epices",
    selectedSupplierId: "s191", suppliers: [{ id: "s191", name: "Métro", price: 16.0, priceSource: "estimate" }], history: [] },
  { id: "i192", name: "Sauge", unit: "kg", catalogId: "sauge", category: "epices",
    selectedSupplierId: "s192", suppliers: [{ id: "s192", name: "Métro", price: 20.0, priceSource: "estimate" }], history: [] },
  { id: "i193", name: "Estragon", unit: "kg", catalogId: "estragon", category: "epices",
    selectedSupplierId: "s193", suppliers: [{ id: "s193", name: "Métro", price: 24.0, priceSource: "estimate" }], history: [] },
  { id: "i194", name: "Fleur de sel", unit: "kg", catalogId: "fleur_de_sel", category: "epices",
    selectedSupplierId: "s194", suppliers: [{ id: "s194", name: "Métro", price: 12.0, priceSource: "estimate" }], history: [] },
  { id: "i195", name: "Poivre blanc", unit: "kg", catalogId: "poivre_blanc", category: "epices",
    selectedSupplierId: "s195", suppliers: [{ id: "s195", name: "Métro", price: 20.0, priceSource: "estimate" }], history: [] },
  { id: "i196", name: "Gousse de vanille", unit: "pièce", catalogId: "vanille", category: "epices",
    selectedSupplierId: "s196", suppliers: [{ id: "s196", name: "Métro", price: 3.5, priceSource: "estimate" }], history: [] },
  { id: "i197", name: "Sucre vanillé", unit: "kg", catalogId: "sucre_vanille", category: "epices",
    selectedSupplierId: "s197", suppliers: [{ id: "s197", name: "Métro", price: 8.0, priceSource: "estimate" }], history: [] },
  { id: "i198", name: "Eau minérale plate", unit: "L", catalogId: "eau_plate", category: "boissons",
    selectedSupplierId: "s198", suppliers: [{ id: "s198", name: "Cavavin Pro", price: 0.35, priceSource: "estimate" }], history: [] },
  { id: "i199", name: "Eau gazeuse", unit: "L", catalogId: "eau_gazeuse", category: "boissons",
    selectedSupplierId: "s199", suppliers: [{ id: "s199", name: "Cavavin Pro", price: 0.55, priceSource: "estimate" }], history: [] },
  { id: "i200", name: "Jus d'orange", unit: "L", catalogId: "jus_orange", category: "boissons",
    selectedSupplierId: "s200", suppliers: [{ id: "s200", name: "Cavavin Pro", price: 2.2, priceSource: "estimate" }], history: [] },
  { id: "i201", name: "Jus de pomme", unit: "L", catalogId: "jus_pomme", category: "boissons",
    selectedSupplierId: "s201", suppliers: [{ id: "s201", name: "Cavavin Pro", price: 2.0, priceSource: "estimate" }], history: [] },
  { id: "i202", name: "Soda cola", unit: "L", catalogId: "soda_cola", category: "boissons",
    selectedSupplierId: "s202", suppliers: [{ id: "s202", name: "Cavavin Pro", price: 1.1, priceSource: "estimate" }], history: [] },
  { id: "i203", name: "Café en grains", unit: "kg", catalogId: "cafe_grains", category: "boissons",
    selectedSupplierId: "s203", suppliers: [{ id: "s203", name: "Cavavin Pro", price: 18.0, priceSource: "estimate" }], history: [] },
  { id: "i204", name: "Café moulu", unit: "kg", catalogId: "cafe_moulu", category: "boissons",
    selectedSupplierId: "s204", suppliers: [{ id: "s204", name: "Cavavin Pro", price: 16.0, priceSource: "estimate" }], history: [] },
  { id: "i205", name: "Thé noir", unit: "kg", catalogId: "the_noir", category: "boissons",
    selectedSupplierId: "s205", suppliers: [{ id: "s205", name: "Cavavin Pro", price: 25.0, priceSource: "estimate" }], history: [] },
  { id: "i206", name: "Vin rosé de cuisine", unit: "L", catalogId: "vin_rose", category: "boissons",
    selectedSupplierId: "s206", suppliers: [{ id: "s206", name: "Cavavin Pro", price: 4.5, priceSource: "estimate" }], history: [] },
  { id: "i207", name: "Champagne", unit: "L", catalogId: "champagne", category: "boissons",
    selectedSupplierId: "s207", suppliers: [{ id: "s207", name: "Cavavin Pro", price: 28.0, priceSource: "estimate" }], history: [] },
  { id: "i208", name: "Whisky", unit: "L", catalogId: "whisky", category: "boissons",
    selectedSupplierId: "s208", suppliers: [{ id: "s208", name: "Cavavin Pro", price: 22.0, priceSource: "estimate" }], history: [] },
  { id: "i209", name: "Vodka", unit: "L", catalogId: "vodka", category: "boissons",
    selectedSupplierId: "s209", suppliers: [{ id: "s209", name: "Cavavin Pro", price: 16.0, priceSource: "estimate" }], history: [] },
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

// Sélecteur d'ingrédient avec recherche (remplace un <select> qui deviendrait interminable).
// Tape au moins 2 lettres pour filtrer, clique une suggestion pour choisir.
function IngredientPicker({ ingredients, value, displayName, onChange, className, autoOpen, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const current = ingredients.find((i) => i.id === value);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered =
    query.trim().length >= 2
      ? ingredients.filter((i) => displayName(i).toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
      : ingredients.slice(0, 8);

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
        <div className="absolute z-30 top-full left-0 mt-1 w-56 max-w-[80vw] rounded-xl overflow-hidden shadow-xl border border-white/10" style={{ background: "#1F1F25" }}>
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-white/10">
            <Search size={12} className="text-white/40 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tape 2 lettres…"
              className="w-full bg-transparent text-white text-xs outline-none min-w-0"
              onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((i) => (
              <button
                key={i.id}
                onMouseDown={(e) => { e.preventDefault(); onChange(i.id); setOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-white/10 ${i.id === value ? "text-[#10B981]" : "text-white/80"}`}
              >
                {displayName(i)}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-2.5 py-2 text-xs text-white/30">Aucun résultat</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const TIER_COLORS = { low: "#EF4444", mid: "#F59E0B", high: "#10B981" };
function marginTier(m, minMargin) {
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
  const gapAbove = roundedMargin - effectiveTarget; // positif si au-dessus de l'objectif
  const gapBelow = effectiveTarget - roundedMargin; // positif si en dessous
  if (tier === "high") {
    return gapAbove >= 10
      ? (lang === "es" ? "¡Margen excelente!" : "Marge excellente !")
      : (lang === "es" ? "Buen margen, por encima de tu objetivo." : "Belle marge, tu es au-dessus de ton objectif.");
  }
  if (tier === "mid") {
    return gapBelow <= 3
      ? (lang === "es"
          ? "Justo por debajo de tu margen deseado, pero sigue siendo un buen plato."
          : "Juste en dessous de ta marge souhaitée, mais la marge reste bonne sur ce plat.")
      : (lang === "es"
          ? "Por debajo de tu margen deseado — a vigilar en este plato."
          : "En dessous de ta marge souhaitée — à surveiller sur ce plat.");
  }
  // tier "low"
  return roundedMargin < 50
    ? (lang === "es"
        ? "Margen muy insuficiente: este plato no es rentable tal cual."
        : "Marge largement insuffisante : ce plat n'est pas assez rentable en l'état.")
    : (lang === "es" ? "Margen insuficiente, a corregir rápidamente." : "Marge insuffisante, à corriger rapidement.");
}

export default function App() {
  const [ingredients, setIngredients] = useState(SEED_INGREDIENTS);
  const [recipes, setRecipes] = useState(SEED_RECIPES);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeId, setActiveId] = useState("r1");
  const [activeTab, setActiveTab] = useState("recipes"); // 'recipes' | 'scanner' | 'pantry'
  const [recipeSubView, setRecipeSubView] = useState("list"); // 'list' | 'detail'
  const [lang, setLang] = useState("fr");
  const [showSettings, setShowSettings] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);

  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [pantryQuery, setPantryQuery] = useState("");
  const [pantryCategory, setPantryCategory] = useState("all");
  const [expandedIngId, setExpandedIngId] = useState(null);
  const [autoOpenIdx, setAutoOpenIdx] = useState(null);

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
  // On compare la valeur ARRONDIE (celle affichée à l'écran) pour éviter qu'un 74.8% affiché "75%" reste bloqué.
  const marginRounded = margin !== null ? Math.round(margin) : null;
  const isBelowTarget = marginRounded !== null && marginRounded < targetMargin;
  const isAtOrAboveTarget = marginRounded !== null && marginRounded >= targetMargin;
  const nextMarginStep = marginRounded !== null ? Math.min(99, Math.ceil((marginRounded + 5) / 5) * 5) : null;

  const updateRecipe = (patch) => setRecipes((rs) => rs.map((r) => (r.id === active.id ? { ...r, ...patch } : r)));
  const applyLinesChange = (newLines) => {
    const patch = { lines: newLines };
    if (active.allergensAuto !== false) patch.allergens = detectAllergens(newLines, ingredients, lang);
    updateRecipe(patch);
  };
  const updateLineQty = (idx, qty) => updateRecipe({ lines: active.lines.map((l, i) => (i === idx ? { ...l, qty } : l)) });
  const removeLine = (idx) => applyLinesChange(active.lines.filter((_, i) => i !== idx));
  const addLine = () => {
    const newIdx = active.lines.length;
    applyLinesChange([...active.lines, { ingredientId: null, qty: 1 }]);
    setAutoOpenIdx(newIdx);
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
    setActiveTab("recipes");
    setRecipeSubView("detail");
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

  const updateIngredientField = (id, field, value) =>
    setIngredients((ings) => ings.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  const updateIngredientName = (id, value) =>
    setIngredients((ings) => ings.map((i) => (i.id === id ? { ...i, name: value, catalogId: null } : i)));

  const addIngredientFromCatalog = (c) => {
    const sId = uid();
    const ni = {
      id: uid(), name: c[lang], unit: normUnit(c.unit), catalogId: c.id, category: c.cat,
      selectedSupplierId: sId, suppliers: [{ id: sId, name: t("supplier"), price: 1, priceSource: "estimate" }], history: [],
    };
    setIngredients((ings) => [...ings, ni]);
    setAdding(false);
    setQuery("");
  };

  const addCustomIngredient = (name) => {
    const sId = uid();
    const ni = {
      id: uid(), name: name || t("newIngredient"), unit: "kg", catalogId: null, category: "autres",
      selectedSupplierId: sId, suppliers: [{ id: sId, name: t("supplier"), price: 1, priceSource: "estimate" }], history: [],
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
        if (field === "price" && value !== s.price) {
          historyPatch = [...historyPatch, { date: today(), price: value, supplierName: s.name }].slice(-15);
          return { ...s, price: value, priceSource: "manual" };
        }
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

  const guessIngredientId = (name) => {
    const tokens = tokenize(name);
    if (!tokens.length) return null;
    const tokenSet = new Set(tokens);
    let best = null;
    let bestScore = 0;
    for (const ing of ingredients) {
      const iTokens = tokenize(ingredientDisplayName(ing));
      if (!iTokens.length) continue;
      const iSet = new Set(iTokens);
      const shared = iTokens.filter((tk) => tokenSet.has(tk)).length;
      const score = shared / Math.min(tokenSet.size, iSet.size);
      if (score > bestScore) {
        bestScore = score;
        best = ing;
      }
    }
    if (!best || bestScore < 0.5) return null;
    return { id: best.id, confident: bestScore >= 0.99 };
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

  // Calcule le prix final au kg/L/pièce à partir de : combien de colis achetés,
  // ce que contient UN colis, et le prix tel qu'imprimé (déjà au kg/L, ou par colis entier).
  // Rien de tout ça n'est deviné par l'IA seule : c'est un calcul déterministe, vérifiable.
  const computeItemPricing = (it) => {
    // Repli sur l'ancien format si jamais l'IA ne renvoie pas les nouveaux champs.
    if (it.packageContent === undefined || it.printedPriceUnit === undefined) {
      const legacy = normalizeUnitAndPrice(it);
      return { finalUnit: legacy.unit, finalUnitPrice: legacy.unitPriceHT, priceInconsistent: false, expectedTotal: null };
    }

    const packageCount = it.packageCount && it.packageCount > 0 ? it.packageCount : 1;
    const packageContent = it.packageContent && it.packageContent > 0 ? it.packageContent : 1;
    const packageContentUnit = it.packageContentUnit || "pièce";
    const printedPrice = it.printedUnitPriceHT || 0;
    const printedUnit = it.printedPriceUnit || "colis";

    let finalUnit;
    let finalUnitPrice;
    if (printedUnit === "kg" || printedUnit === "L") {
      // Le prix imprimé est déjà un prix au kilo/litre : on l'utilise tel quel, sans y toucher.
      finalUnit = printedUnit;
      finalUnitPrice = printedPrice;
    } else {
      // Le prix imprimé est celui d'un colis entier : on le ramène au kg/L/pièce via son contenu.
      finalUnit = packageContentUnit === "kg" || packageContentUnit === "L" ? packageContentUnit : "pièce";
      finalUnitPrice = printedPrice / packageContent;
    }

    const expectedTotal = packageCount * packageContent * finalUnitPrice;
    const printedTotal = it.totalPriceHT || 0;
    let priceInconsistent = false;
    if (printedTotal > 0 && expectedTotal > 0) {
      const diff = Math.abs(expectedTotal - printedTotal) / Math.max(printedTotal, 0.01);
      if (diff > 0.15) priceInconsistent = true;
    }

    return { finalUnit, finalUnitPrice, priceInconsistent, expectedTotal };
  };

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
        const { finalUnit, finalUnitPrice, priceInconsistent, expectedTotal } = computeItemPricing(it);
        const merged = { ...it, unit: finalUnit, unitPriceHT: finalUnitPrice };

        const match = guessIngredientId(merged.name);
        const matchedId = match ? match.id : null;
        const matchedIng = matchedId ? ingredientById(matchedId) : null;
        const activeSup = matchedIng ? activeSupplier(matchedIng) : null;
        const currentPrice = activeSup?.price ?? null;
        const currentPriceIsReal = activeSup?.priceSource && activeSup.priceSource !== "estimate";

        // Grosse variation à confirmer explicitement — uniquement si on la compare à un
        // VRAI prix déjà observé (jamais contre une simple estimation de départ non vérifiée).
        const bigChange =
          currentPrice !== null && currentPriceIsReal && merged.unitPriceHT > 0
            ? Math.abs(merged.unitPriceHT - currentPrice) / currentPrice > 0.4
            : false;

        return {
          ...merged,
          assignTo: matchedId || "new",
          matchConfident: match ? match.confident : false,
          renameOnImport: !!(match && !match.confident),
          imported: false,
          currentPrice,
          currentPriceIsReal,
          priceInconsistent,
          expectedTotal,
          bigChange,
          priceUp: currentPrice !== null && merged.unitPriceHT > currentPrice * 1.02,
          priceDown: currentPrice !== null && merged.unitPriceHT < currentPrice * 0.98,
        };
      });

      // Alerte globale si une grosse majorité des prix scannés semble en forte hausse
      // par rapport aux vrais prix déjà connus — signe probable d'un souci de lecture du document.
      const comparable = items.filter((i) => i.currentPrice !== null && i.currentPriceIsReal);
      const manyUp = comparable.length >= 3 && comparable.filter((i) => i.priceUp).length / comparable.length > 0.6;

      setScanResult({ supplier: data.supplier || null, date: data.date || null, items, manyUp });
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
    const finalUnit = item.unit || "kg";
    const finalPrice = item.unitPriceHT || 0;

    if (item.assignTo === "new") {
      const sId = uid();
      const ni = {
        id: uid(),
        name: item.name,
        unit: finalUnit,
        catalogId: null,
        category: "autres",
        selectedSupplierId: sId,
        suppliers: [{ id: sId, name: supplierName, price: finalPrice, priceSource: "scan" }],
        history: [{ date: today(), price: finalPrice, supplierName }],
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
            suppliers = suppliers.map((s) => (s.id === existing.id ? { ...s, price: finalPrice, priceSource: "scan" } : s));
          } else {
            suppliers = [...suppliers, { id: uid(), name: supplierName, price: finalPrice, priceSource: "scan" }];
          }
          const history = [...(ing.history || []), { date: today(), price: finalPrice, supplierName }].slice(-15);
          const renamed = item.renameOnImport && item.name ? { name: item.name, catalogId: null } : {};
          return { ...ing, unit: finalUnit, suppliers, history, ...renamed, selectedSupplierId: existing ? ing.selectedSupplierId : ing.selectedSupplierId };
        })
      );
    }
    updateScanItem(idx, { imported: true });
  };

  // "Importer tout" ne traite QUE les lignes sans aucun signal d'alerte — tout le reste
  // (prix incohérent, conditionnement ambigu, grosse variation, correspondance incertaine)
  // doit être validé ligne par ligne, en connaissance de cause.
  const isSafeScanItem = (item) =>
    !item.priceInconsistent && !item.bigChange && (item.assignTo === "new" || item.matchConfident);

  const importAllScanItems = () => {
    scanResult.items.forEach((item, idx) => {
      if (isSafeScanItem(item)) importScanItem(idx);
    });
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

  // Tableau du garde-manger : regroupé par catégorie, puis ordre alphabétique dans chaque groupe.
  const pantryGrouped = CATEGORIES.map((c) => ({
    cat: c,
    items: pantryFiltered
      .filter((i) => (i.category || "autres") === c.id)
      .sort((a, b) => ingredientDisplayName(a).localeCompare(ingredientDisplayName(b), lang)),
  })).filter((g) => g.items.length > 0);

  // Le seuil vert ne peut jamais descendre sous 70% (règle fixe du rouge) — on l'utilise
  // pour le texte d'aide afin qu'il reste cohérent avec les couleurs réellement affichées.
  const effectiveGreenTarget = Math.max(settings.minMargin || 0, CRITICAL_MARGIN);
  const hasOrangeZone = effectiveGreenTarget > CRITICAL_MARGIN;

  return (
    <div className="min-h-screen w-full overflow-x-hidden" style={{ background: "#18181B", maxWidth: "100vw" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        .font-display { font-family: 'Oswald', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .ticket { background: #F2ECDD; color: #2B2620; position: relative; box-shadow: 0 12px 30px rgba(0,0,0,0.35); max-width: 100%; }
        .ticket::before, .ticket::after {
          content: ""; position: absolute; left: 0; right: 0; height: 14px;
          background-image: radial-gradient(circle at 10px 7px, #18181B 6px, transparent 7px);
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

      <header className="border-b border-white/10 px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-2 print:hidden" style={{ background: "#1F1F25" }}>
        <div className="flex items-center gap-2">
          <ChefHat size={22} color="#10B981" />
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
          <button onClick={() => setShowSettings(true)} className="text-white/60 hover:text-[#10B981]" title={t("settings")}>
            <SettingsIcon size={16} />
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => setLang("fr")} className={`text-lg leading-none ${lang === "fr" ? "" : "opacity-40 grayscale"}`} title="Français">🇫🇷</button>
            <button onClick={() => setLang("es")} className={`text-lg leading-none ${lang === "es" ? "" : "opacity-40 grayscale"}`} title="Español">🇪🇸</button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setShowSettings(false)}>
          <div className="rounded-2xl p-5 w-full max-w-xs font-body border border-white/10" style={{ background: "#1F1F25" }} onClick={(e) => e.stopPropagation()}>
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
              {hasOrangeZone
                ? (lang === "es"
                    ? `Verde ≥ ${effectiveGreenTarget}% · Naranja entre ${CRITICAL_MARGIN}–${effectiveGreenTarget}% · Rojo < ${CRITICAL_MARGIN}%`
                    : `Vert ≥ ${effectiveGreenTarget}% · Orange entre ${CRITICAL_MARGIN}–${effectiveGreenTarget}% · Rouge < ${CRITICAL_MARGIN}%`)
                : (lang === "es"
                    ? `Verde ≥ ${CRITICAL_MARGIN}% · Rojo < ${CRITICAL_MARGIN}% (sin zona naranja con este umbral)`
                    : `Vert ≥ ${CRITICAL_MARGIN}% · Rouge < ${CRITICAL_MARGIN}% (pas de zone orange avec ce seuil)`)}
            </p>

            <button onClick={() => setShowSettings(false)} className="w-full text-xs font-display uppercase tracking-wide py-2 rounded border border-white/20 text-white/70 hover:border-[#10B981] hover:text-[#10B981]">
              {t("close")}
            </button>
            <button onClick={clearAll} className="w-full text-center mt-3 text-[11px] text-white/30 hover:text-[#B23A2E] underline">
              {t("resetData")}
            </button>
          </div>
        </div>
      )}

      {scanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 print:hidden" onClick={closeScan}>
          <div
            className="rounded-2xl p-5 w-full max-w-xl max-h-[85vh] overflow-y-auto font-body border border-white/10"
            style={{ background: "#1F1F25" }}
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
                <Loader2 size={26} className="animate-spin" style={{ color: "#10B981" }} />
                {t("scanning")}
              </div>
            )}

            {scanErr && !scanning && (
              <div className="text-center py-6">
                <div className="text-[#B23A2E] text-sm mb-3">{t("scanError")} : {scanErr}</div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs uppercase tracking-wide px-3 py-1.5 rounded border border-white/20 text-white/70 hover:border-[#10B981] hover:text-[#10B981]"
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

                {scanResult.manyUp && (
                  <div className="flex items-start gap-2 rounded-lg p-2.5 mb-3 text-xs" style={{ background: `${TIER_COLORS.low}18`, color: TIER_COLORS.low }}>
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    {t("scanManyUpWarning")}
                  </div>
                )}

                {scanResult.items.length === 0 ? (
                  <div className="text-white/40 text-sm py-4 text-center">{t("scanNoItems")}</div>
                ) : (
                  <div className="space-y-2">
                    {scanResult.items.map((item, idx) => (
                      <div
                        key={idx}
                        className={`rounded-xl p-2.5 border border-white/10 ${item.imported ? "opacity-40" : ""}`}
                        style={{ background: "#18181B" }}
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            value={item.name || ""}
                            disabled={item.imported}
                            onChange={(e) => updateScanItem(idx, { name: e.target.value })}
                            className="flex-1 min-w-0 bg-transparent text-white text-sm font-medium outline-none border-b border-white/10 focus:border-[#10B981]"
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

                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {item.assignTo === "new" ? (
                            <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full font-semibold" style={{ color: "#10B981", background: "#10B98122" }}>
                              {t("scanNewIngredient")}
                            </span>
                          ) : (
                            <span
                              className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full font-semibold"
                              style={{ color: item.matchConfident ? "#10B981" : TIER_COLORS.mid, background: item.matchConfident ? "#10B98122" : `${TIER_COLORS.mid}22` }}
                            >
                              {item.matchConfident ? t("scanLinkedSure") : t("scanLinkedGuess")}
                            </span>
                          )}
                        </div>

                        {(item.packageCount || item.packageContent) && !item.imported && (
                          <div className="text-[10px] text-white/35 mt-1 font-mono">
                            {item.packageCount || 1} × {item.packageContent || 1}{item.packageContentUnit === "pièce" ? "" : item.packageContentUnit} @ {(item.printedUnitPriceHT || 0).toFixed(2)}€/{item.printedPriceUnit === "colis" ? (lang === "es" ? "paquete" : "colis") : item.printedPriceUnit}
                          </div>
                        )}

                        {item.priceInconsistent && !item.imported && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] rounded px-2 py-1.5" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
                            <AlertTriangle size={11} className="shrink-0" />
                            <span>
                              {t("scanPriceInconsistent")}
                              {item.expectedTotal !== null ? ` (${t("scanExpectedTotal")} ≈ ${item.expectedTotal.toFixed(2)}€, ${t("scanPrintedTotal")} ${(item.totalPriceHT || 0).toFixed(2)}€)` : ""}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-1.5 text-xs text-white/60">
                          <select
                            value={item.assignTo}
                            disabled={item.imported}
                            onChange={(e) => updateScanItem(idx, { assignTo: e.target.value, matchConfident: true, renameOnImport: false })}
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

                        {item.assignTo !== "new" && !item.imported && item.name && ingredientById(item.assignTo) && ingredientDisplayName(ingredientById(item.assignTo)) !== item.name && (
                          <label className="flex items-center gap-1.5 mt-1.5 text-[10px] text-white/50">
                            <input
                              type="checkbox"
                              checked={!!item.renameOnImport}
                              onChange={(e) => updateScanItem(idx, { renameOnImport: e.target.checked })}
                            />
                            {t("scanRenameHint")(item.name)}
                          </label>
                        )}

                        {!item.imported && item.currentPrice !== null && item.currentPriceIsReal && (
                          <div className="flex items-center gap-1 mt-1.5 text-[10px]" style={{ color: item.bigChange ? TIER_COLORS.low : item.priceUp ? TIER_COLORS.mid : item.priceDown ? "#10B981" : "rgba(255,255,255,0.4)" }}>
                            {(item.priceUp || item.bigChange) && <TrendingUp size={11} />}
                            {item.priceUp
                              ? `${t("scanPriceIncrease")} : ${item.currentPrice.toFixed(2)}€ → ${(item.unitPriceHT || 0).toFixed(2)}€`
                              : item.priceDown
                              ? `${t("scanPriceDecrease")} : ${item.currentPrice.toFixed(2)}€ → ${(item.unitPriceHT || 0).toFixed(2)}€`
                              : t("scanPriceSame")}
                          </div>
                        )}

                        <div className="flex justify-end mt-1.5">
                          {item.imported ? (
                            <span className="text-[10px] text-[#10B981] font-semibold">{t("scanImported")}</span>
                          ) : item.bigChange ? (
                            <button
                              onClick={() => importScanItem(idx)}
                              className="text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full font-semibold flex items-center gap-1"
                              style={{ background: TIER_COLORS.low, color: "#fff" }}
                            >
                              <AlertTriangle size={11} /> {t("scanConfirmBigChange")}
                            </button>
                          ) : (
                            <button
                              onClick={() => importScanItem(idx)}
                              className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-white/20 text-white/70 hover:border-[#10B981] hover:text-[#10B981]"
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
                    style={{ background: "#10B981", color: "#fff" }}
                  >
                    {t("scanImportAll")}
                  </button>
                )}
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
              <ChefHat size={18} color="#10B981" />
              <span className="font-display text-white/50 text-[11px] uppercase tracking-widest">{t("appTitle")}</span>
            </div>
            <h1 className="font-display text-white text-xl mb-5">{t("greeting")}</h1>

            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-white/90 uppercase text-sm tracking-widest">{t("recipes")}</h2>
              <button
                onClick={addRecipe}
                className="flex items-center gap-1 text-xs font-display uppercase tracking-wide px-3 py-1.5 rounded-full active:scale-95 transition-transform"
                style={{ background: "#10B981", color: "#fff" }}
              >
                <Plus size={14} /> {t("newRecipe")}
              </button>
            </div>

            {recipes.length === 0 ? (
              <div className="text-white/40 text-sm text-center py-16 font-body">{t("noRecipeYet")}</div>
            ) : (
              <div className="space-y-2">
                {recipes.map((r) => {
                  const cpp = recipeCostPerPortion(r);
                  const m = recipeMargin(r);
                  const rt = marginTier(m, settings.minMargin);
                  return (
                    <button
                      key={r.id}
                      onClick={() => { setActiveId(r.id); setRecipeSubView("detail"); }}
                      className="w-full text-left rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 font-body transition hover:brightness-110 active:scale-95 border border-white/10"
                      style={{ background: "#1F1F25" }}
                    >
                      <div className="min-w-0">
                        <div className="text-white font-medium text-sm truncate">{r.name}</div>
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
              <div className="flex gap-3">
                <button onClick={() => duplicateRecipe(active)} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-[#10B981] font-display uppercase tracking-wide">
                  <Copy size={13} /> {t("duplicate")}
                </button>
                <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-[#10B981] font-display uppercase tracking-wide">
                  <Printer size={13} /> {t("print")}
                </button>
              </div>
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
                      <IngredientPicker
                        ingredients={ingredients}
                        value={line.ingredientId}
                        displayName={ingredientDisplayName}
                        onChange={(id) => changeLineIngredient(idx, id)}
                        className="flex-1 min-w-0 text-black/80"
                        autoOpen={autoOpenIdx === idx}
                        placeholder={lang === "es" ? "Elegir un ingrediente…" : "Choisir un ingrédient…"}
                      />
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
                        style={{ background: "#10B981", color: "#fff" }}
                      >
                        {t("use")}
                      </button>
                    </div>
                  </div>
                )}
                {isAtOrAboveTarget && nextMarginStep !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-black/50">{lang === "es" ? "Objetivo de esta receta alcanzado" : "Objectif de cette recette atteint"}</span>
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
                <div className="flex flex-col items-center mt-6 mb-1 gap-2">
                  <div className="stamp px-4 py-1.5 text-sm" style={{ color: TIER_COLORS[tier] }}>{t("marginLabel")} {Math.round(margin)}%</div>
                  <div
                    className="flex items-center gap-1.5 text-[11px] font-body text-center px-3 py-1.5 rounded-full font-medium max-w-[280px]"
                    style={{ color: TIER_COLORS[tier], background: `${TIER_COLORS[tier]}18` }}
                  >
                    {tier === "high" ? <Check size={12} className="shrink-0" /> : <AlertTriangle size={12} className="shrink-0" />}
                    {marginMessage(Math.round(margin), effectiveGreenTarget, tier, lang)}
                  </div>
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

            <button
              onClick={() => deleteRecipe(active.id)}
              className="mt-4 w-full text-center text-[11px] text-white/25 hover:text-[#B23A2E] print:hidden"
            >
              <Trash2 size={11} className="inline mr-1 -mt-0.5" /> {t("duplicate") === "Dupliquer" ? "Supprimer cette recette" : "Eliminar esta receta"}
            </button>
          </div>
        )}

        {/* ---------------- ONGLET SCANNER ---------------- */}
        {activeTab === "scanner" && (
          <div className="max-w-md mx-auto pt-6">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanFile} />
            <div className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center font-body border border-white/10" style={{ background: "#1F1F25" }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#10B98122" }}>
                <Camera size={28} color="#10B981" />
              </div>
              <h2 className="font-display text-white uppercase tracking-wide text-sm mt-1">{t("scanInvoice")}</h2>
              <p className="text-white/40 text-xs leading-relaxed">{t("scanTabHint")}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 w-full text-xs font-display uppercase tracking-wide py-3 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform"
                style={{ background: "#10B981", color: "#fff" }}
              >
                <Camera size={15} /> {t("scanInvoice")}
              </button>
            </div>
          </div>
        )}

        {/* ---------------- ONGLET GARDE-MANGER ---------------- */}
        {activeTab === "pantry" && (
          <div>
            <h2 className="font-display text-white/90 uppercase text-sm tracking-widest mb-3">{t("pantry")}</h2>

            <div className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 mb-2 border border-white/10" style={{ background: "#1F1F25" }}>
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
                onClick={() => setPantryCategory("all")}
                className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border ${pantryCategory === "all" ? "bg-[#10B981] text-white border-[#10B981]" : "text-white/50 border-white/15 hover:border-white/40"}`}
              >
                {t("allCategories")}
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setPantryCategory(c.id)}
                  className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border ${pantryCategory === c.id ? "bg-[#10B981] text-white border-[#10B981]" : "text-white/50 border-white/15 hover:border-white/40"}`}
                >
                  {c[lang]}
                </button>
              ))}
            </div>

            <div className="rounded-xl overflow-hidden font-body border border-white/10" style={{ background: "#1F1F25" }}>
              {pantryGrouped.length === 0 && (
                <div className="px-3 py-6 text-center text-white/30 text-sm">{t("noFilterMatch")}</div>
              )}
              {pantryGrouped.map(({ cat, items }) => (
                <div key={cat.id}>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/40" style={{ background: "#18181B" }}>
                    {cat[lang]}
                  </div>
                  {items.map((ing) => {
                    const sup = activeSupplier(ing);
                    const isOpen = expandedIngId === ing.id;
                    return (
                      <div key={ing.id} className="border-t border-white/5">
                        <button
                          onClick={() => setExpandedIngId(isOpen ? null : ing.id)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                        >
                          <span className="flex-1 min-w-0 text-white text-sm truncate">{ingredientDisplayName(ing)}</span>
                          <span className="text-white/40 text-[11px] shrink-0">{ing.unit}</span>
                          <span className="text-white/80 text-xs font-mono shrink-0 w-16 text-right">{(sup?.price || 0).toFixed(2)}€</span>
                          <ChevronDown size={14} className={`text-white/30 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>

                        {isOpen && (
                          <div className="px-3 pb-3" style={{ background: "#18181B" }}>
                            <input
                              value={ingredientDisplayName(ing)}
                              onChange={(e) => updateIngredientName(ing.id, e.target.value)}
                              className="w-full bg-transparent text-white text-sm font-medium outline-none border-b border-white/10 focus:border-[#10B981] pb-1 pt-2 mb-2"
                            />
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] uppercase tracking-wide text-white/40">Unité</span>
                              <select
                                value={ing.unit}
                                onChange={(e) => updateIngredientField(ing.id, "unit", e.target.value)}
                                className="bg-black/20 text-white/70 text-xs outline-none rounded px-1.5 py-1"
                                style={{ colorScheme: "dark" }}
                              >
                                <option value="kg">kg</option>
                                <option value="L">L</option>
                                <option value="pièce">pièce</option>
                              </select>
                            </div>

                            <div className="space-y-1 mb-2">
                              {ing.suppliers.map((s) => (
                                <div key={s.id} className="flex items-center gap-1.5 text-xs text-white/60">
                                  <input type="radio" checked={ing.selectedSupplierId === s.id} onChange={() => selectSupplier(ing.id, s.id)} className="shrink-0" />
                                  <input
                                    value={s.name}
                                    onChange={(e) => updateSupplier(ing.id, s.id, "name", e.target.value)}
                                    className="flex-1 bg-transparent outline-none border-b border-white/10 focus:border-[#10B981] min-w-0"
                                  />
                                  <NumField value={s.price} onChange={(v) => updateSupplier(ing.id, s.id, "price", v)} className="w-14 shrink-0 bg-transparent font-mono outline-none border-b border-white/10 focus:border-[#10B981] text-right" />
                                  <span className="shrink-0">€</span>
                                  {ing.suppliers.length > 1 && (
                                    <button onClick={() => removeSupplier(ing.id, s.id)} className="text-white/25 hover:text-red-400 shrink-0"><Trash2 size={11} /></button>
                                  )}
                                </div>
                              ))}
                              <button onClick={() => addSupplier(ing.id)} className="text-[10px] uppercase tracking-wide text-white/40 hover:text-[#10B981] flex items-center gap-1">
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
                              <Trash2 size={11} /> {t("duplicate") === "Dupliquer" ? "Supprimer l'ingrédient" : "Eliminar ingrediente"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {adding ? (
              <div className="mt-3 relative">
                <div className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 border border-white/10" style={{ background: "#1F1F25" }}>
                  <Search size={13} className="text-white/40 shrink-0" />
                  <input
                    autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("searchPlaceholder")} className="w-full bg-transparent text-white text-sm outline-none min-w-0"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && query.trim()) addCustomIngredient(query.trim());
                      if (e.key === "Escape") setAdding(false);
                    }}
                    onBlur={() => setTimeout(() => setAdding(false), 150)}
                  />
                </div>
                <div className="mt-1 rounded-xl overflow-hidden absolute z-20 w-full border border-white/10" style={{ background: "#1F1F25" }}>
                  {suggestions.map((c) => (
                    <button key={c.id} onMouseDown={(e) => { e.preventDefault(); addIngredientFromCatalog(c); }} className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 flex items-center justify-between">
                      <span>{c[lang]}</span>
                      <span className="text-[10px] text-white/30">{normUnit(c.unit)}</span>
                    </button>
                  ))}
                  {query.trim() && (
                    <button onMouseDown={(e) => { e.preventDefault(); addCustomIngredient(query.trim()); }} className="w-full text-left px-3 py-2 text-xs text-[#10B981] hover:bg-white/10 border-t border-white/10">
                      {t("createCustom")(query.trim())}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button onClick={() => setAdding(true)} className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-display uppercase tracking-wide py-2.5 rounded-xl border border-dashed border-white/25 text-white/60 hover:text-[#10B981] hover:border-[#10B981] active:scale-95 transition">
                <Plus size={14} /> {t("addIngredient")}
              </button>
            )}
          </div>
        )}
      </main>

      {/* ---------------- NAVIGATION PAR ONGLETS (bas d'écran) ---------------- */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t border-white/10 backdrop-blur-lg print:hidden"
        style={{ background: "rgba(31,31,37,0.75)", paddingBottom: "env(safe-area-inset-bottom)" }}
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
              <TabIcon size={20} color={isActive ? "#10B981" : "rgba(255,255,255,0.4)"} />
              <span className={`text-[10px] font-display uppercase tracking-wide ${isActive ? "text-[#10B981]" : "text-white/40"}`}>{tabDef.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
