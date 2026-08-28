// Ingrédients/recette de démo — extrait de App.jsx le 2026-08-28.

export const SEED_INGREDIENTS = [
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
export const SEED_RECIPE_NOTES = {
  fr: "Détaillez le bœuf en cubes de 4-5 cm, salez, poivrez. Faites-le mariner 12h au frais dans le vin rouge avec thym, laurier et un oignon émincé. Égouttez la viande en réservant la marinade, épongez-la bien avant de la saisir à feu vif dans un mélange beurre/huile jusqu'à belle coloration ; réservez. Faites revenir les lardons, puis les oignons et les carottes coupés en rondelles. Remettez la viande, saupoudrez d'une cuillère de farine, mouillez avec la marinade filtrée et complétez avec un peu d'eau ou de fond si besoin pour bien couvrir. Portez à frémissement, couvrez et laissez mijoter 3h à feu très doux. Ajoutez les champignons 30 min avant la fin de cuisson. Rectifiez l'assaisonnement, montez la sauce avec le reste du beurre bien froid hors du feu pour la lier et la lustrer. Pendant ce temps, faites cuire les tagliatelles al dente dans l'eau bouillante salée, égouttez-les. Dressez le bœuf bourguignon et sa sauce sur les tagliatelles, parsemez de persil frais ciselé.",
  es: "Corta la carne de vacuno en dados de 4-5 cm, sala y pimienta. Déjala marinar 12h en la nevera en el vino tinto con tomillo, laurel y una cebolla picada. Escurre la carne reservando la marinada, sécala bien antes de sellarla a fuego fuerte en una mezcla de mantequilla/aceite hasta que quede bien dorada; reserva. Sofríe el bacon, luego la cebolla y las zanahorias cortadas en rodajas. Vuelve a añadir la carne, espolvorea con una cucharada de harina, moja con la marinada colada y completa con un poco de agua o caldo si hace falta para cubrir bien. Lleva a ebullición suave, tapa y cocina a fuego muy bajo durante 3h. Añade los champiñones 30 min antes de terminar la cocción. Rectifica la sazón, liga la salsa con el resto de la mantequilla bien fría fuera del fuego para espesarla y darle brillo. Mientras tanto, cuece los tallarines al dente en agua hirviendo con sal y escúrrelos. Sirve la carne y su salsa sobre los tallarines, espolvoreada con perejil fresco picado.",
  en: "Cut the beef into 4-5 cm cubes, season with salt and pepper. Marinate for 12h in the fridge in the red wine with thyme, bay leaf and a chopped onion. Drain the meat, keeping the marinade, and pat it dry before searing it over high heat in a butter/oil mix until nicely browned; set aside. Sauté the lardons, then the onions and carrots cut into rounds. Add the meat back in, sprinkle with a spoonful of flour, moisten with the strained marinade and top up with a little water or stock if needed to cover well. Bring to a gentle simmer, cover and cook on very low heat for 3h. Add the mushrooms 30 min before the end of cooking. Adjust the seasoning, then swirl in the rest of the cold butter off the heat to thicken and give the sauce a glossy finish. Meanwhile, cook the tagliatelle al dente in salted boiling water and drain. Plate the beef and its sauce over the tagliatelle, sprinkled with freshly chopped parsley.",
};
export const SEED_RECIPE_ALLERGENS = { fr: "Sulfites (vin)", es: "Sulfitos (vino)", en: "Sulfites (wine)" };

// Vrai uniquement si LA recette de démo (id "r1") n'a jamais été modifiée (notes/allergènes
// encore identiques à l'une des 3 langues connues) — sert à décider si on peut la reconstruire
// dans une nouvelle langue sans risquer d'écraser un vrai texte tapé par l'utilisateur. Ne
// dépend PAS du nombre total de recettes : un utilisateur qui a déjà créé ses propres recettes
// à côté doit quand même voir la démo se traduire tant qu'il n'a personnellement rien changé dedans.
export function isPristineSeedRecipe(r) {
  return !!r && r.id === "r1" && Object.values(SEED_RECIPE_NOTES).includes(r.notes) && Object.values(SEED_RECIPE_ALLERGENS).includes(r.allergens);
}

// Reconstruit la recette de démo dans la langue demandée — appelée au premier chargement (langue
// sauvegardée si elle existe) et à chaque changement de langue tant que l'utilisateur n'a pas
// modifié la recette lui-même (voir isPristineSeedRecipe, changeLang dans App).
export function buildSeedRecipes(lang) {
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
