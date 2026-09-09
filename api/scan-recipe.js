import { checkUserSoft } from "./_lib.js";

// Fonction serveur Vercel dédiée au scanner de fiche recette/technique existante — distincte de
// api/scan-invoice.js (autre besoin, autre prompt), pour ne jamais risquer de faire régresser le
// scanner de factures en le modifiant. Même principe d'exécution (clé API côté serveur uniquement).
// maxDuration : même raison que dans api/scan-invoice.js — sans ce réglage la plateforme peut tuer
// la fonction avant la fin et renvoyer une page HTML que le client ne sait pas interpréter.
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Clé API manquante côté serveur (variable ANTHROPIC_API_KEY non configurée sur Vercel).",
    });
  }

  const { image, mediaType, text, ocrText, dishName, stockIngredients, wantedIngredients, excludedIngredients, dishCategory, targetCostTotal } = req.body || {};
  // "Recette express" (2026-09-02) : troisième mode d'entrée, distinct de la lecture d'une fiche
  // existante (image/text) — ici RIEN n'est écrit nulle part, l'IA invente une base de recette
  // réaliste à partir du seul nom d'un plat. Prompt entièrement séparé ci-dessous (isExpressMode)
  // pour ne jamais risquer de faire régresser le mode "lecture de fiche" déjà en place.
  // "Plat du jour depuis mon stock" (2026-09-08) : variante du même mode express — au lieu d'un
  // nom de plat, l'IA reçoit la liste des ingrédients déjà connus du garde-manger et propose un
  // plat qui les utilise en priorité. Même schéma JSON, même logique de réponse ; seul le prompt
  // change (voir plus bas), donc partage volontairement le même `isExpressMode`.
  const cleanStock = Array.isArray(stockIngredients)
    ? stockIngredients.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim().slice(0, 60)).slice(0, 80)
    : [];
  const hasStock = cleanStock.length > 0;
  // Ingrédients imposés par l'utilisateur (2026-09-09, "je veux écrire poulet, steak haché") —
  // combinés au stock ci-dessus, jamais à sa place ; suffisant à eux seuls pour déclencher le mode
  // express (un compte au garde-manger encore vide doit pouvoir taper ses ingrédients directement).
  const cleanWanted = Array.isArray(wantedIngredients)
    ? wantedIngredients.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim().slice(0, 60)).slice(0, 20)
    : [];
  const hasWanted = cleanWanted.length > 0;
  // Ingrédients à éviter (2026-09-09, "si j'ai pas les ingrédients qu'il me dit c'est relou") — plus
  // simple et moins coûteux qu'une régénération après coup ou plusieurs recettes générées d'un coup :
  // l'utilisateur exclut par avance ce qu'il n'a pas, avant même le premier appel IA.
  const cleanExcluded = Array.isArray(excludedIngredients)
    ? excludedIngredients.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim().slice(0, 60)).slice(0, 20)
    : [];
  const hasExcluded = cleanExcluded.length > 0;
  const isExpressMode = (typeof dishName === "string" && dishName.trim().length > 0) || hasStock || hasWanted;
  if (!image && !text && !isExpressMode) {
    return res.status(400).json({ error: "Aucune image, texte ni nom de plat reçu." });
  }
  // Budget de coût maximum (2026-09-09) — calculé côté client à partir de prix de vente + marge
  // cible + portions (même formule que `recipeMargin`, src/App.jsx, pour que ce budget corresponde
  // exactement à ce que la fiche affichera). Corrige un vrai retour utilisateur : sans ça, l'IA
  // composait librement et la marge tombait où elle voulait (42% obtenu sur un essai réel malgré
  // un prix de vente renseigné) — inutile pour un restaurateur qui vise une marge précise.
  const cleanBudget = Number.isFinite(targetCostTotal) && targetCostTotal > 0 ? Math.round(targetCostTotal * 100) / 100 : null;

  // Même serrure souple que api/scan-invoice.js (voir checkUserSoft dans _lib.js) : cet endpoint
  // consomme lui aussi des crédits d'IA et était tout aussi ouvert. Le bouton qui l'appelle est
  // actuellement masqué dans l'app, mais l'adresse, elle, reste publique.
  const auth = await checkUserSoft(req);
  if (auth.status === "missing" || auth.status === "invalid") {
    return res.status(401).json({ error: "Session expirée, reconnecte-toi puis réessaie." });
  }

  if (isExpressMode) {
    // Bornes défensives : évite un texte absurdement long ou un nombre de portions farfelu
    // d'atteindre le prompt (aucune conséquence de sécurité réelle, juste de l'hygiène d'entrée).
    const cleanDishName = (dishName || "").trim().slice(0, 100);
    const portions = Number.isFinite(req.body?.portions) && req.body.portions > 0 ? Math.min(Math.round(req.body.portions), 200) : 4;
    // "Plat du jour" (2026-09-08, étendu le 2026-09-09) : seule l'intro du prompt change selon le
    // mode — même schéma JSON, mêmes règles ci-dessous, pour ne dupliquer aucune des règles déjà
    // éprouvées (unités, priceEstimateHT...) entre les variantes. `isDailyMode` regroupe stock ET
    // ingrédients imposés : les deux sources se combinent, jamais l'une à la place de l'autre.
    const isDailyMode = hasStock || hasWanted;
    // Catégorie du plat (2026-09-09, "choisir si on veut une entrée plat ou dessert") — mêmes ids
    // que les sections par défaut de la carte digitale (MENU_CATEGORIES, src/brand.js), réutilisés
    // tels quels côté client pour poser `recipe.menuCategory` sans créer de nouveau système.
    const categoryLabels = { starter: "une ENTRÉE", main: "un PLAT PRINCIPAL", dessert: "un DESSERT" };
    const cleanDishCategory = typeof dishCategory === "string" && categoryLabels[dishCategory] ? dishCategory : null;
    const categoryClause = cleanDishCategory ? ` Le plat proposé doit être ${categoryLabels[cleanDishCategory]}, pas autre chose.` : "";
    // Ingrédients à éviter (2026-09-09) : combinés aux ingrédients imposés/stock ci-dessus, jamais
    // en conflit (si un ingrédient apparaît dans les deux listes par erreur de saisie, l'exclusion
    // gagne — plus sûr pour l'utilisateur qui a explicitement dit ne pas l'avoir).
    const excludedClause = hasExcluded
      ? ` Ingrédients à NE JAMAIS utiliser, même en petite quantité, même comme simple assaisonnement : ${cleanExcluded.join(", ")}. ⚠️ Cette exclusion porte sur le PRODUIT réel, pas sur un nom précis — ne le fais JAMAIS réapparaître sous un autre nom, une variante, un synonyme ou une désignation commerciale différente pour la même chose (ex: si "galette de riz" est exclue, "feuille de riz", "pâte à nems" ou "wrapper de riz" restent le même produit et sont TOUT AUTANT interdits). Si le plat le plus évident (y compris un plat dont le NOM t'a été donné explicitement) dépend STRUCTURELLEMENT d'un de ces ingrédients exclus (ex: des nems sans galette de riz sous quelque nom que ce soit, un tiramisu sans mascarpone, une pizza sans pâte) : NE PROPOSE JAMAIS ce même plat déguisé ou juste privé de son ingrédient essentiel, ça n'aurait plus aucun sens — choisis un plat RÉELLEMENT DIFFÉRENT et cohérent qui n'en a structurellement pas besoin, avec un nom et des instructions qui correspondent vraiment à ce nouveau plat. Le respect de cette exclusion prime toujours sur le fait de coller au nom de plat donné par le restaurateur.`
      : "";
    // Simplicité quand le garde-manger n'est pas connu (2026-09-09, "il m'a sorti galette de riz
    // j'en ai pas") — sans stock, l'IA n'a aucune idée de ce qu'un restaurant a réellement sous la
    // main ; chaque ingrédient complémentaire qu'elle invente elle-même est un risque de tomber sur
    // quelque chose d'inhabituel. Ne s'applique qu'en l'absence de stock connu — avec un stock, on
    // sait déjà ce qui est disponible, moins besoin de cette prudence.
    const simplicityClause = !hasStock
      ? " Comme le garde-manger du restaurateur n'est pas connu ici, reste volontairement SOBRE sur les ingrédients complémentaires que tu ajoutes toi-même : uniquement le strict nécessaire pour un plat cohérent (une base courante comme riz/pâtes/pommes de terre, un assaisonnement basique, un légume simple), jamais une préparation ou un produit spécifique et peu courant qu'un restaurant n'a pas forcément sous la main (ex: une galette déjà préparée, un fromage rare, une sauce du commerce précise) — en cas de doute sur la disponibilité d'un ingrédient, préfère toujours l'option la plus commune."
      : "";
    // Variété d'une génération à l'autre (2026-09-09, "quand je recommence ça me fait toujours la
    // même recette") — Sonnet 5 n'accepte pas `temperature` sur ce point d'accès (voir plus bas), et
    // même avec Haiku la même contrainte stricte (mêmes ingrédients imposés, même budget) tend à
    // reproduire la même idée "évidente". Un style tiré au hasard à chaque appel force une vraie
    // variation sans dépendre d'un paramètre de hasard du modèle.
    const styleHints = [
      "cuisine traditionnelle française de brasserie",
      "inspiration méditerranéenne (Sud de la France, Italie, Espagne)",
      "version bistronomique moderne et un peu créative",
      "plat mijoté/réconfortant",
      "préparation rapide et généreuse, service efficace",
      "inspiration d'Asie du Sud-Est (sans dénaturer les ingrédients imposés)",
      "grillades/plancha",
    ];
    const styleHint = styleHints[Math.floor(Math.random() * styleHints.length)];
    const introPrompt = isDailyMode
      ? `Tu es un chef cuisinier qui aide un restaurateur à trouver une idée de PLAT DU JOUR dans son application de gestion de marges — il n'a pas d'idée, c'est à TOI de lui en proposer une.
${hasStock ? `Ingrédients déjà disponibles dans son garde-manger (à privilégier fortement, pas besoin de tous les utiliser) : ${cleanStock.join(", ")}.\n` : ""}${hasWanted ? `Ingrédients que le restaurateur veut ABSOLUMENT utiliser dans ce plat, même si non listés ci-dessus : ${cleanWanted.join(", ")}. Ils doivent obligatoirement apparaître dans "lines".\n` : ""}${cleanDishName ? `Envie/thème donné en plus : "${cleanDishName}".\n` : ""}Nombre de portions demandé : ${portions}.${categoryClause}${excludedClause}${simplicityClause}
Propose un plat RÉALISTE et cohérent, comme le ferait un vrai chef professionnel. Tu peux ajouter quelques ingrédients complémentaires courants (herbes, condiments, une base comme riz/pâtes/pommes de terre) qui ne sont dans aucune des listes ci-dessus si c'est nécessaire pour un plat cohérent, mais privilégie fortement ce qui est déjà disponible — c'est tout l'intérêt de la demande (éviter le gaspillage, ne pas racheter ce qu'on a déjà). Si aucun ingrédient n'est fourni/imposé, propose quand même un plat du jour classique et polyvalent de brasserie française plutôt que de renvoyer une liste vide.
Pour cette proposition précise, oriente-toi plutôt vers : ${styleHint} — évite de retomber systématiquement sur l'idée la plus évidente/classique si un restaurateur redemandait une suggestion avec les mêmes contraintes, varie réellement d'une proposition à l'autre.`
      : `Tu es un chef cuisinier qui aide un restaurateur à démarrer rapidement une nouvelle recette dans son application de gestion de marges, en lui proposant une base de recette réaliste à partir du seul nom d'un plat — contrairement à une lecture de document, ici RIEN n'est déjà écrit nulle part : c'est à TOI d'inventer des quantités raisonnables à partir de ta connaissance de la cuisine professionnelle française.
Nom du plat donné par l'utilisateur : "${cleanDishName}". Nombre de portions demandé : ${portions}.${excludedClause}`;
    // Contrainte de budget (2026-09-09) : corrige un vrai retour utilisateur — un prix de vente
    // renseigné sans marge cible ne fait qu'AFFICHER la marge obtenue au hasard (42% observé sur
    // un essai réel, jugé inutile). Consigne forte plutôt qu'une simple suggestion : c'est
    // précisément ce qui manquait pour que "prix de vente + marge cible" serve à quelque chose.
    const budgetClause = cleanBudget
      ? `\n\nCONTRAINTE DE BUDGET IMPORTANTE : le coût total des ingrédients pour les ${portions} portion(s) (somme de qty × priceEstimateHT sur toutes les lignes) ne doit PAS dépasser environ ${cleanBudget}€ HT — c'est le budget qui permet au restaurateur d'atteindre la marge qu'il vise sur ce plat précis. Choisis des morceaux/produits plus économiques et des quantités raisonnables plutôt que des produits de luxe si nécessaire pour rester dans ce budget, tout en gardant un plat cohérent et savoureux. ⚠️ Si le budget est serré, ne pars pas par réflexe sur la première idée "classique" qui implique une viande chère (bœuf, agneau, magret...) — pense d'abord à une protéine ou une base économique cohérente avec les ingrédients imposés (poulet, œuf, légumineuse, poisson blanc bon marché, ou un plat végétarien bien construit) : c'est souvent ce qui permet de VRAIMENT tenir la marge visée, pas juste de s'en approcher. Un léger dépassement (jusqu'à 15%) est acceptable si le respecter strictement rendrait le plat absurde, mais vise activement à respecter ce budget — ce n'est pas une simple suggestion.`
      : "";
    const expressPrompt = `${introPrompt}${budgetClause}
Réponds UNIQUEMENT avec un objet JSON valide (aucun texte avant/après, pas de balises markdown), au format exact :

{
  "name": "nom du plat normalisé proprement (première lettre en majuscule, orthographe corrigée si besoin)",
  "portions": ${portions},
  "notes": "les étapes de préparation, écrites comme une vraie fiche technique de cuisine professionnelle (courtes phrases à l'impératif, dans l'ordre : préparation des ingrédients, cuisson, dressage) — texte fluide, pas une liste à puces",
  "lines": [
    { "name": "nom simple de l'ingrédient : juste la matière première en français, sans marque ni conditionnement (ex: 'Parmesan', 'Poulet', 'Salade romaine')", "qty": nombre, "unit": "kg" ou "L" ou "pièce", "priceEstimateHT": nombre }
  ]
}

RÈGLES :
- Liste RÉALISTE d'ingrédients pour ce plat, comme le ferait un vrai chef de cuisine professionnelle en France, pour EXACTEMENT ${portions} portion(s) — adapte toujours les quantités au nombre de portions demandé (pas une recette pour 4 si on te demande 1).
- Quantités TOUJOURS en grammes convertis en kg (ex: 150g → qty: 0.15, unit: "kg") ou en millilitres convertis en litres (ex: 50ml → qty: 0.05, unit: "L") pour tout ingrédient qui se pèse ou se mesure normalement (viande, poisson, légume, fromage, sauce, liquide...). N'utilise "pièce" QUE pour un ingrédient réellement compté à l'unité fixe (ex: 1 œuf, 1 citron) — jamais pour approximer le poids d'une portion de viande/poisson/légume.
- Entre 5 et 12 ingrédients pour un plat normal (ni liste trop courte qui manquerait l'essentiel, ni liste interminable). N'inclus le sel/poivre/eau que s'ils ont un vrai poids notable dans la recette (ex: eau de cuisson d'un risotto) — omets-les s'ils sont juste un assaisonnement classique en quantité négligeable, ça n'apporte rien au calcul de marge.
- Si le nom donné ne correspond à AUCUN plat reconnaissable (charabia, texte hors-sujet), réponds quand même avec "lines": [] plutôt que d'inventer n'importe quoi — c'est une réponse honnête et valide.
- "notes" : quelques phrases (3 à 8 lignes selon le plat) décrivant comment réaliser ce plat concrètement en cuisine — assez concret pour qu'un cuisinier puisse s'en servir tel quel, sans réinventer la recette. Jamais vide si "lines" contient au moins un ingrédient.
- "priceEstimateHT" : prix HT réaliste au kg/L/pièce (même unité que "unit"), tel qu'un restaurateur français le paierait auprès d'un grossiste professionnel (type Metro/Transgourmet/Pomona) — PAS un prix de supermarché grand public. Fais-le varier normalement d'un ingrédient à l'autre selon sa vraie valeur marchande, même au sein d'un même type d'aliment (ex: un magret de canard coûte nettement plus cher qu'un poulet entier ou une escalope de dinde, un filet de bœuf plus cher qu'un morceau à mijoter) — ne mets jamais le même prix par réflexe à deux ingrédients différents. Reste une estimation à corriger ensuite avec de vraies factures, une approximation raisonnable suffit.
- ⚠️ **"priceEstimateHT" doit TOUJOURS rester ce prix grossiste réaliste, MÊME quand une contrainte de budget est donnée ci-dessous.** N'invente jamais un prix anormalement bas juste pour faire rentrer le budget dans les clous — ce serait mentir au restaurateur sur son vrai coût. Pour respecter un budget, joue uniquement sur le CHOIX des ingrédients/morceaux (privilégie des morceaux/produits économiques mais réels) et sur les QUANTITÉS — jamais sur le prix lui-même. S'il est impossible de tenir le budget avec des prix réalistes, dépasse-le plutôt que de sous-évaluer un prix.
Réponds toujours avec un JSON syntaxiquement valide.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        // Sonnet 5 (2026-09-09, était Haiku 4.5) — demandé par l'utilisateur ("IA plus intelligente")
        // après un plat trop cher malgré une contrainte de budget claire. Même réglage que
        // api/scan-invoice.js pour ce modèle sur ce type d'appel : `temperature` n'est plus accepté
        // par ce point d'accès sur Sonnet 5, et le "thinking" par défaut doit être désactivé
        // explicitement (sinon coupe le texte de réponse avant le JSON, déjà rencontré ailleurs).
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 2048,
          thinking: { type: "disabled" },
          messages: [{ role: "user", content: [{ type: "text", text: expressPrompt }] }],
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        console.error(`[scan-recipe:express] HTTP ${response.status}`, detail.slice(0, 800));
        return res.status(502).json({ error: "L'IA n'a pas pu générer cette recette." });
      }
      const data = await response.json();
      const textBlock = (data.content || []).find((c) => c.type === "text");
      // [BUG confirmé et corrigé le 2026-09-08 dans api/scan-invoice.js, même correctif appliqué
      // ici par cohérence] Un bloc texte absent (réponse tronquée/vide) ne doit jamais retomber
      // silencieusement sur "{}" (JSON valide, donc aucune erreur ne se déclencherait) — traité
      // explicitement comme un échec.
      if (!textBlock) {
        console.error("[scan-recipe:express] réponse sans bloc texte", JSON.stringify({ stopReason: data.stop_reason }));
        return res.status(502).json({ error: "Réponse de l'IA illisible." });
      }
      let raw = textBlock.text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) raw = raw.slice(firstBrace, lastBrace + 1);
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.error("[scan-recipe:express] JSON illisible", (raw || "(vide)").slice(0, 800));
        return res.status(502).json({ error: "Réponse de l'IA illisible." });
      }
      return res.status(200).json(parsed);
    } catch (e) {
      return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
    }
  }

  const prompt = `Tu es un assistant qui lit des fiches techniques/recettes de cuisine (photo, éventuellement manuscrite, ou texte numérique déjà extrait d'un PDF), pour aider un restaurateur à saisir rapidement une recette qu'il utilise déjà.
Réponds UNIQUEMENT avec un objet JSON valide (aucun texte avant/après, pas de balises markdown), au format exact :

{
  "name": "nom du plat/de la recette, ou null si illisible",
  "portions": nombre de portions/couverts si indiqué sur la fiche, sinon null,
  "sellPrice": prix de vente TTC si indiqué (carte, menu), sinon null,
  "allergens": "texte des allergènes mentionnés sur la fiche, ou null si rien n'est indiqué",
  "notes": "les étapes de préparation/instructions telles qu'écrites, recopiées et légèrement nettoyées en un texte fluide et lisible — ne cherche JAMAIS à en extraire de nouveaux ingrédients (voir règle ci-dessous)",
  "lines": [
    {
      "rawText": "texte exact de cette ligne d'ingrédient telle qu'écrite sur la fiche (nom + quantité)",
      "name": "nom nettoyé de l'ingrédient : juste la matière première (ex: 'Beurre', 'Oignon', 'Farine'), sans la quantité",
      "qty": nombre ou null,
      "unit": "kg" ou "L" ou "pièce" ou null,
      "impreciseQuantity": true si la quantité ne peut pas être convertie en poids/volume précis (voir règle ci-dessous), false sinon
    }
  ]
}

RÈGLE STRICTE — "lines" EST TOUJOURS UN TABLEAU PLAT, JAMAIS DE SOUS-GROUPES :
Certaines fiches techniques comportent plusieurs sous-recettes (ex: "Pour la pâte", "Pour la garniture", "Pour la sauce", "Pour la finition"), chacune avec ses propres ingrédients. Même dans ce cas, "lines" doit rester un UNIQUE tableau plat contenant TOUTES les lignes de TOUTES les sous-recettes mises bout à bout — ne renvoie JAMAIS un objet groupé par section (ex: jamais {"pate": [...], "garniture": [...]}), et ne renvoie jamais un tableau de tableaux. Si tu veux garder une trace de la sous-recette d'origine, tu peux la préfixer dans "rawText" (ex: "Garniture — Beurre 50g"), mais jamais changer la forme globale de "lines".

RÈGLE STRICTE — LA LISTE D'INGRÉDIENTS NE VIENT QUE DE LA LISTE/TABLEAU DÉDIÉ AUX INGRÉDIENTS :
N'ajoute une ligne dans "lines" QUE si elle apparaît dans la liste ou le tableau des ingrédients de la fiche (généralement en haut du document, avec une quantité à côté de chaque nom). Ne crée JAMAIS de ligne supplémentaire à partir d'un ingrédient simplement mentionné dans le texte des instructions/étapes de préparation, même si son nom y réapparaît (ex: si "beurre" est déjà dans la liste d'ingrédients ET mentionné à nouveau dans une étape comme "faites fondre le beurre", ne crée surtout pas une deuxième ligne "beurre" — une seule ligne par ingrédient de la liste). Un ingrédient qui n'apparaît QUE dans le texte des instructions, sans être dans la liste dédiée, ne doit JAMAIS devenir une ligne non plus. Le texte des instructions est recopié uniquement dans le champ "notes", jamais redécomposé en lignes d'ingrédients.

RÈGLE STRICTE — NE JAMAIS DEVINER LA COMPOSITION D'UN INGRÉDIENT AGRÉGÉ (le piège le plus fréquent, sois très vigilant) :
Certaines fiches donnent un ingrédient déjà comme un TOUT dans le tableau (ex: "Base Mayonnaise maison (Jaunes, moutarde, huile)", "Garnitures Sauces (Cornichons, câpres, concentré, curry)", "Fond de veau", "Pâte brisée du commerce") — même quand le nom entre parenthèses évoque ses composants habituels. Dans ce cas, extrais UNE SEULE ligne avec le nom ET la quantité exactement tels qu'écrits sur cette ligne du tableau (ex: "Base Mayonnaise maison" avec sa quantité). NE reconstitue JAMAIS la recette de cet ingrédient à partir de ta connaissance générale de la cuisine pour en faire plusieurs lignes séparées (jaune d'œuf, moutarde, huile, vinaigre, sel, poivre...) — même si une section "méthode/préparation" plus loin dans le document DÉCRIT comment préparer ou décliner cet ingrédient en détail (ex: 4 variantes de sauce à partir d'une base mayonnaise), cette section reste uniquement du texte de méthode à recopier dans "notes", jamais une source de nouvelles lignes d'ingrédients. Une ligne du tableau = une ligne extraite, jamais éclatée en plus de lignes que ce qui est écrit.

RÈGLE STRICTE — UNE DÉSIGNATION AVEC UN CHOIX RESTE UNE SEULE LIGNE :
Une désignation qui propose une alternative (ex: "Bœuf (Rumsteck ou Poire)", "Poisson blanc (Merlan ou Colin)") décrit UN SEUL ingrédient à acheter (le boucher/poissonnier fournira l'un ou l'autre selon disponibilité), jamais deux lignes séparées. Garde le nom complet avec les deux options dans "name" (ou choisis la première mentionnée), une seule ligne, une seule quantité.

RÈGLE — CONVERSION D'UNITÉS ET QUANTITÉS IMPRÉCISES :
- Convertis toujours les grammes en kg (divise par 1000, ex: "500g" → qty: 0.5, unit: "kg") et les millilitres en litres (divise par 1000, ex: "250ml" → qty: 0.25, unit: "L").
- Si la quantité est donnée dans une unité qui ne peut PAS être convertie avec certitude en poids/volume (cuillère à soupe/à café, pincée, "au goût", "un peu de", botte, gousse, branche, tranche, verre, sachet sans poids précisé...), ou si aucune quantité n'est écrite du tout pour cette ligne : mets qty: null et impreciseQuantity: true. N'invente JAMAIS une conversion approximative (ex: ne devine jamais combien pèse "une pincée" ou "une gousse") — mieux vaut laisser le champ vide que faux.
- Sinon (quantité déjà en kg/g/L/mL/pièce, ou un nombre de pièces claire comme "2 œufs"), remplis qty/unit normalement avec impreciseQuantity: false.

RÈGLE STRICTE — UN NOMBRE DE PIÈCES NE SUFFIT PAS POUR LA VIANDE/POISSON/FROMAGE/LÉGUME/LIQUIDE SANS POIDS ÉCRIT :
Pour tout ingrédient normalement vendu et facturé au poids ou au volume (viande, poisson, fromage, légume, liquide/sauce...), un simple nombre de pièces SANS aucun poids/volume écrit à côté (ex: "2 faux filets", "4 escalopes de poulet", "1 filet de saumon", "3 tomates" sans grammage) N'EST PAS une quantité utilisable — le poids réel d'une pièce est bien trop variable pour être deviné. Dans ce cas : qty: null, unit: null, impreciseQuantity: true, exactement comme pour une pincée ou une gousse. Ne renvoie "pièce" avec impreciseQuantity: false QUE pour un ingrédient réellement compté à l'unité fixe et non ambiguë (œuf, citron entier, boîte de conserve, sachet au poids imprimé...), jamais pour approximer le poids d'une portion de viande/poisson/fromage/légume.

VÉRIFICATION FINALE AVANT DE RÉPONDRE : relis ta liste "lines" et demande-toi pour CHAQUE ligne "est-ce que ce nom ET cette quantité sont écrits littéralement sur une ligne du tableau/liste d'ingrédients du document ?" Si la réponse est non (ingrédient deviné à partir d'une description de méthode, composant reconstitué d'un ingrédient agrégé, ou quantité inventée par connaissance générale de la cuisine), retire la ligne. Le nombre de lignes dans "lines" doit correspondre au nombre de lignes réellement visibles dans le tableau/liste d'ingrédients, jamais plus.

Réponds toujours avec un JSON valide, même sur une fiche manuscrite, mal cadrée ou partiellement illisible — n'invente aucune ligne qui n'existe pas réellement sur le document, et ignore silencieusement ce qui est vraiment illisible plutôt que de bloquer toute la réponse.`;

  const content = [];
  if (image) {
    content.push({ type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } });
    if (ocrText && ocrText.trim().length > 20) {
      content.push({
        type: "text",
        text: `Transcription OCR automatique de cette image, faite par un moteur classique indépendant de toi (peut contenir des erreurs, particulièrement sur une écriture manuscrite) — sers-t'en pour confirmer un mot en cas de doute, mais l'image reste la référence en cas de désaccord :\n\n${ocrText.trim().slice(0, 4000)}`,
      });
    }
  } else {
    content.push({
      type: "text",
      text: `Voici le texte numérique natif extrait d'un PDF (pas une image scannée, texte fiable et complet, aucune lecture visuelle à faire) :\n\n${text.trim().slice(0, 8000)}`,
    });
  }
  content.push({ type: "text", text: prompt });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        temperature: 0,
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      // Détail brut jamais renvoyé au client (voir api/scan-invoice.js) : logs Vercel uniquement.
      const detail = await response.text().catch(() => "");
      console.error(`[scan-recipe] HTTP ${response.status}`, detail.slice(0, 800));
      return res.status(502).json({ error: "L'IA n'a pas pu traiter le document." });
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((c) => c.type === "text");
    let raw = (textBlock?.text || "{}").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      raw = raw.slice(firstBrace, lastBrace + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("[scan-recipe] JSON illisible", (raw || "(vide)").slice(0, 800));
      return res.status(502).json({ error: "Réponse de l'IA illisible." });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
