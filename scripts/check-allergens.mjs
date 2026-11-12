// Garde-fou allergènes — à relancer après tout ajout au catalogue ou aux mots-clés :
//   node scripts/check-allergens.mjs
// 1) Vérifie une liste de cas attendus (dont le bug d'origine : "Tagliatelles" sans gluten).
// 2) Affiche, pour CHAQUE produit du catalogue, les allergènes détectés — à relire d'un œil.
// Sort en erreur (code 1) si un cas attendu ne passe pas.
import { CATALOG, ALLERGEN_MAP, allergenCodesFromName, ingredientAllergenCodes } from "../src/catalog.js";

const sorted = (x) => [...x].sort().join(",");
let failures = 0;
const expect = (label, got, want) => {
  const g = sorted(got), w = sorted(want);
  if (g !== w) { failures++; console.log(`ECHEC  ${label} -> [${g}] attendu [${w}]`); }
};

// Tout identifiant de ALLERGEN_MAP doit exister dans le catalogue (sinon faute de frappe = trou).
const ids = new Set(CATALOG.map((c) => c.id));
Object.keys(ALLERGEN_MAP).forEach((id) => { if (!ids.has(id)) { failures++; console.log(`ECHEC  id inconnu dans ALLERGEN_MAP: ${id}`); } });

// Produits du catalogue
const cat = (id) => ingredientAllergenCodes({ catalogId: id, name: CATALOG.find((c) => c.id === id)?.fr });
expect("catalogue tagliatelles", cat("tagliatelles"), ["gluten"]);
expect("catalogue spaghetti", cat("spaghetti"), ["gluten"]);
expect("catalogue pates", cat("pates"), ["gluten"]);
expect("catalogue pain_mie", cat("pain_mie"), ["gluten"]);
expect("catalogue farine_sarrasin", cat("farine_sarrasin"), []);
expect("catalogue muscade", cat("muscade"), []);
expect("catalogue noix_de_coco", cat("noix_de_coco"), []);
expect("catalogue saint_jacques", cat("saint_jacques"), ["mollusques"]);
expect("catalogue salade", cat("salade"), []);
expect("catalogue huile_sesame", cat("huile_sesame"), ["sesame"]);
expect("catalogue mayonnaise", cat("mayonnaise"), ["oeufs", "moutarde"]);
expect("catalogue sauce_soja", cat("sauce_soja"), ["soja", "gluten"]);
expect("catalogue comte", cat("comte"), ["lait"]);
expect("catalogue vin_rose", cat("vin_rose"), ["sulfites"]);
expect("catalogue huitres", cat("huitres"), ["mollusques"]);
expect("catalogue pommes_de_terre", cat("pommes_de_terre"), []);
expect("catalogue pate_a_tartiner", cat("pate_a_tartiner"), ["lait", "fruits_a_coque", "soja"]);
expect("catalogue pois_chiches", cat("pois_chiches"), []);
expect("catalogue haricots_verts", cat("haricots_verts"), []);

// Noms libres (scan de facture, saisie à la main, IA)
const n = (name, want) => expect(`nom "${name}"`, allergenCodesFromName(name), want);
n("Tagliatelles fraîches", ["gluten"]);
n("TAGLIATELLE", ["gluten"]);
n("Linguine", ["gluten"]);
n("Lasagnes", ["gluten"]);
n("Gnocchis", ["gluten"]);
n("Pâtes fraîches aux œufs", ["gluten", "oeufs"]);
n("Pain burger", ["gluten"]);
n("Brioche", ["gluten", "lait", "oeufs"]);
n("Laitue", []);
n("Lait de coco", []);
n("Lait d'amande", ["fruits_a_coque"]);
n("Lait d'avoine", ["gluten"]);
n("Crème liquide 35%", ["lait"]);
n("Beurre de cacahuète", ["arachides"]);
n("Noix de muscade", []);
n("Noix de Saint-Jacques surgelées", ["mollusques"]);
n("Cerneaux de noix", ["fruits_a_coque"]);
n("Farine de sarrasin", []);
n("Farine de riz", []);
n("Farine T45", ["gluten"]);
n("Nouilles de riz", []);
n("Nouilles", ["gluten"]);
n("Vin blanc Chardonnay", ["sulfites"]);
n("Vinaigre de Xérès", ["sulfites"]);
n("Filets d'anchois", ["poisson"]);
n("Gambas", ["crustaces"]);
n("Huîtres n°3", ["mollusques"]);
n("Sauce soja", ["soja", "gluten"]);
n("Graines de sésame", ["sesame"]);
n("Tahini", ["sesame"]);
n("Cacahuètes grillées", ["arachides"]);
n("Céleri rave", ["celeri"]);
n("Pesto", ["lait", "fruits_a_coque"]);
n("Œufs de saumon", ["poisson"]);
n("Œufs", ["oeufs"]);
n("Bœuf haché", []);
n("Tomates", []);
n("Riz basmati", []);
n("Pomme de terre", []);
n("Poivre noir", []);
n("Barbue", []);
n("Mozzarella di Bufala", ["lait"]);
n("Reblochon", ["lait"]);
n("Bière blonde", ["gluten"]);
n("Chapelure Panko", ["gluten"]);

console.log("\n--- Catalogue complet (à relire) ---");
CATALOG.filter((c) => c.unit).forEach((c) => {
  const codes = sorted(ingredientAllergenCodes({ catalogId: c.id, name: c.fr }));
  if (codes) console.log(`${c.fr.padEnd(28)} ${codes}`);
});
const none = CATALOG.filter((c) => c.unit && ingredientAllergenCodes({ catalogId: c.id, name: c.fr }).size === 0).map((c) => c.fr);
console.log(`\n--- Sans allergène détecté (${none.length}) ---\n${none.join(" · ")}`);

console.log(failures ? `\n${failures} ECHEC(S)` : "\nTous les cas attendus passent.");
process.exit(failures ? 1 : 0);
