// Fonction serveur Vercel (jamais exécutée dans le navigateur : la clé API
// reste ici, côté serveur, et n'est jamais visible par le client).
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

  const { image, mediaType, text, ocrText } = req.body || {};
  if (!image && !text) {
    return res.status(400).json({ error: "Aucune image ni texte reçu." });
  }

  const prompt = `Tu es un assistant spécialisé dans la lecture de factures et bons de livraison fournisseurs pour la restauration.
Analyse le document fourni (image de facture, éventuellement accompagnée d'une transcription OCR indépendante, ou texte numérique déjà extrait d'un PDF) et réponds UNIQUEMENT avec un objet JSON valide (aucun texte avant/après, pas de balises markdown), au format exact :

{
  "supplier": "nom du fournisseur ou null",
  "date": "AAAA-MM-JJ ou null",
  "items": [
    {
      "rawLabel": "le texte EXACT et complet de LA LIGNE ENTIÈRE tel qu'imprimé, SANS AUCUNE simplification (garde codes, abréviations, mentions de conditionnement). ATTENTION : sur la plupart des factures, la désignation, la quantité, le conditionnement/format et le prix sont dans des COLONNES SÉPARÉES sur la même ligne visuelle — rawLabel doit recopier TOUTES ces colonnes mises bout à bout (ex: \"CARTON DE VIN 6X75CL — 32,40 €\"), jamais seulement le texte de la colonne désignation. C'est essentiel : un texte de conditionnement absent de rawLabel empêche tout recalcul fiable en aval.",
      "name": "nom PROPRE de l'ingrédient en français : juste la matière première, sans AUCUN conditionnement ni terme de traitement/état (voir règle NETTOYAGE DU NOM ci-dessous)",
      "packageCount": nombre de colis/unités achetés (le "x2", "x3" imprimé — PAS le poids total),
      "packageContent": nombre représentant le contenu d'UN SEUL colis dans packageContentUnit,
      "packageContentUnit": "kg" ou "L" ou "pièce",
      "weighable": true si le contenu réel (poids/volume) d'UNE pièce/sachet/boîte peut varier d'un fournisseur ou d'un format à l'autre — c'est le cas de PRESQUE TOUS les produits de cuisine professionnelle, y compris quand ils sont vendus "à la pièce" : légumes, fruits, viande, poisson ET fruits de mer/coquillages même en sachet (ex: noix de Saint-Jacques surgelées vendues par sachet de poids variable), fromage, farine, huile, vin, beurre même en plaquette/paquet (250g ou 500g selon le format), conserves/bocaux/boîtes de sauce ou concentré (le contenu varie selon le format, 400g ou 800g par boîte). Mets false UNIQUEMENT pour ce qui est vraiment indivisible et de taille fixe universelle, sans variation possible : un œuf, un fruit compté à l'unité (1 avocat, 1 citron), une boisson en canette/bouteille déjà comptée dans packageContent (le format de LA bouteille ne varie pas une fois connu). Dans le doute, mets TOUJOURS true — l'app préfère demander une confirmation de poids plutôt que de risquer un prix au kilo faux.
      "isFood": true si c'est un ingrédient de cuisine consommable (tout ce qui se mange ou se boit, y compris épices, condiments, boissons), false si c'est un article NON-alimentaire (produit d'entretien, lessive, papier cuisson/toilette, pics à brochette, serviettes jetables, gants, sacs poubelle, vaisselle jetable, éponges, matériel...) OU une consigne/frais (voir règle CONSIGNES ET FRAIS ci-dessous). En cas de doute réel sur un produit ambigu, mets true (mieux vaut le proposer en vérification que le perdre silencieusement).
      "isDeposit": true si la ligne est une consigne, un emballage consigné, des frais de port/livraison/transport, ou des frais de service (voir règle CONSIGNES ET FRAIS ci-dessous), false sinon,
      "printedUnitPriceHT": le prix unitaire EXACTEMENT tel qu'imprimé sur le document, sans aucun calcul,
      "printedPriceUnit": "kg" si le prix imprimé est déjà un prix au kilo, "L" si déjà au litre, "colis" s'il s'agit du prix d'un colis/pièce entière,
      "totalPriceHT": le prix total de la ligne tel qu'imprimé,
      "lowConfidence": true si tu as le moindre doute sur un des chiffres de CETTE ligne (packageCount, printedUnitPriceHT, totalPriceHT, packageContent) — voir règle SIGNAL DE CONFIANCE ci-dessous —, false si tu es sûr d'avoir lu chaque chiffre bien aligné avec cette ligne précise
    }
  ]
}

RÈGLE — SIGNAL DE CONFIANCE PAR LIGNE (lowConfidence) :
Sur un document flou, peu contrasté, incliné, ou avec un tableau dense où plusieurs lignes se ressemblent, il est facile de mal aligner un chiffre avec la mauvaise ligne, même sans s'en rendre compte. Avant de répondre, pour CHAQUE ligne, pose-toi honnêtement la question : "suis-je certain que ce prix/cette quantité appartient à CETTE ligne précise, et pas à la ligne juste au-dessus ou en-dessous ?" Mets lowConfidence: true si l'un des cas suivants s'applique à cette ligne :
- le chiffre est flou, à la limite du lisible, ou tu as dû deviner entre deux lectures possibles (ex: "3" ou "8", "50" ou "80") ;
- la ligne fait partie d'un tableau dense avec plusieurs lignes très similaires en mise en page, où une confusion avec la ligne voisine est plausible ;
- tu as dû reconstituer un chiffre à partir d'un fragment coupé par un pli, une ombre, ou le bord de l'image.
Mets lowConfidence: false uniquement quand les chiffres de cette ligne sont nets, isolés, sans ambiguïté possible. Ce champ ne remplace pas ta rigueur habituelle (recopie toujours ta MEILLEURE lecture, ne mets jamais null par facilité) : c'est un signal honnête en plus, pas un prétexte pour moins bien lire.

COMMENT REMPLIR packageContent / packageContentUnit (le point le plus important, lis bien) :
Chaque ligne de facture décrit un conditionnement entre parenthèses ou dans le libellé : "Sac 10kg", "Caisse 4kg", "Bidon 5L", "Plateau de 30", "Carton 6x75cl", "Plaque 2kg", "Filet 5kg", "Brick 1L", "Caisse 20pcs"...
- "Sac 10kg" → packageContent: 10, packageContentUnit: "kg"
- "Bidon 5L" → packageContent: 5, packageContentUnit: "L"
- "Plateau de 30" (œufs) → packageContent: 30, packageContentUnit: "pièce"
- "Carton 6x75cl" (bouteilles de vin) → packageContent: 4.5, packageContentUnit: "L"
- "Caisse 20pcs" (pain) → packageContent: 20, packageContentUnit: "pièce"
- Si aucun conditionnement n'est précisé (produit vraiment vendu à l'unité simple, ex: 1 avocat) → packageContent: 1, packageContentUnit: "pièce"
Ne confonds JAMAIS packageCount (combien de colis on achète, le "x2") avec packageContent (combien contient UN colis, ex: 10kg) — ce sont deux nombres différents sur la même ligne.

ATTENTION PARTICULIÈRE — MULTIPACK EN GRAMMES (ex: "12x125g", "Boîte 12x125g", "6x50g") :
Même calcul en deux étapes que pour les volumes, mais en grammes puis conversion en kg : "12x125g" → 12 x 125g = 1500g = 1,5kg. Le résultat en kg (après division par 1000) est packageContent, jamais le nombre de grammes d'une seule pièce, jamais le nombre de pièces seul.

RÈGLE STRICTE — UNE LIGNE VISUELLE = UN SEUL OBJET JSON :
Sur les factures à colonnes séparées (désignation | qté | conditionnement/format | PU | montant), la colonne "conditionnement/format" (ex: "Sac 10kg", "12 PCE", "Bolsa 800g", "Barril 30L") n'est JAMAIS un produit à part entière, même si son texte ressemble à un nom ("Bolsa", "Boîte", "Barril") — c'est une propriété de la ligne à laquelle elle appartient, toujours à fusionner dans le MÊME objet JSON que la désignation juste à côté. Ne crée jamais un item séparé pour une cellule de format/quantité/prix isolée.

RÈGLE STRICTE — NE JAMAIS RÉUTILISER UN CHIFFRE D'UNE AUTRE LIGNE :
Sur un tableau dense avec beaucoup de lignes qui se ressemblent (même mise en page, colonnes étroites, photo de mauvaise qualité), reste rigoureux : packageCount, printedUnitPriceHT et totalPriceHT d'une ligne doivent TOUJOURS provenir de cette ligne précise, jamais de la ligne au-dessus ou en-dessous même si les valeurs semblent proches ou plausibles. Avant de répondre, vérifie mentalement que le nombre de lignes dans "items" correspond bien au nombre de lignes de produits visibles sur le document, et que chaque prix reste aligné horizontalement avec le nom du produit dont il provient.

RÈGLE STRICTE — UN PRIX LISIBLE NE DOIT JAMAIS ÊTRE OMIS À CAUSE D'UN POIDS INCONNU :
packageContent (inconnu) et printedUnitPriceHT/totalPriceHT (le prix imprimé) sont deux informations indépendantes. Si le poids/volume d'un colis n'est écrit nulle part (packageContent: null, voir règle ci-dessous), cela ne veut PAS dire que le prix est illisible : recopie quand même printedUnitPriceHT et totalPriceHT si ces chiffres sont visibles sur la ligne. Ne mets null pour ces prix que s'ils sont eux-mêmes vraiment illisibles.

ATTENTION PARTICULIÈRE — MULTIPACK "N x VOLUME" (ex: "6x75cl", "Carton 6x75cl", "1.5L x6") :
C'est le calcul où tu te trompes le plus souvent, fais-le lentement en deux étapes séparées, sans sauter d'étape :
Étape 1 — convertis l'unité en litres : 75cl = 0,75L ; 1,5L = 1,5L ; 33cl = 0,33L.
Étape 2 — multiplie par le nombre d'unités : 6 x 0,75L = 4,5L ; 6 x 1,5L = 9L ; 24 x 0,33L = 7,92L.
Le résultat de l'étape 2 est packageContent (jamais le nombre d'unités seul, jamais le volume d'une seule unité seul — les DEUX nombres doivent être multipliés ensemble).

ATTENTION PARTICULIÈRE — CONVERSION GRAMMES → KG :
Quand le conditionnement est donné en grammes (ex: "Plaque 250g", "Bloc 500g", "Pot 125g"), packageContentUnit doit être "kg" et packageContent doit être le nombre CONVERTI en kg (divisé par 1000), jamais le nombre de grammes tel quel : "500g" → packageContent: 0.5 (PAS 500) ; "250g" → packageContent: 0.25 (PAS 250) ; "125g" → packageContent: 0.125 (PAS 125). Une erreur ici multiplie ou divise le prix final par 1000, vérifie toujours ce calcul avant de répondre.

RÈGLE UNIVERSELLE — QUAND LE POIDS/VOLUME DU COLIS N'EST ÉCRIT NULLE PART :
Certaines lignes donnent un prix par colis/carton/sac pour un produit normalement vendu au poids, SANS qu'aucun chiffre de poids ou volume n'apparaisse dans le libellé (ex: "PDT FRITE 10MM SURG — 8 COLIS — 17.40€" : "10MM" est une taille de découpe, pas un poids). Dans ce cas, tu DOIS impérativement renvoyer packageContent: null (jamais une estimation ou une valeur par défaut comme 1) — quel que soit le fournisseur, la mise en page ou le type de produit. C'est un principe général qui s'applique à TOUTE facture, pas seulement à cet exemple : si tu ne peux pas lire noir sur blanc le poids/volume réel d'UN colis, ne l'invente jamais.
CAS PARTICULIER FRÉQUENT — "N PCE" SEUL, SANS AUCUN POIDS (ex: "NOIX DE SAINT-JACQUES SURGELÉES — 3 PCE — 27,00€", "3 PCE x 28,90€") : pour un produit weighable (poids réel variable d'une pièce à l'autre — coquillages, viande, poisson, fromage...), "3 PCE" te dit combien de pièces sont achetées (packageCount), PAS combien pèse UNE pièce. Ne recopie JAMAIS ce même chiffre dans packageContent en mettant packageContentUnit: "pièce" — ce serait inventer un contenu qui n'est pas écrit. packageContent doit rester null dans ce cas, exactement comme pour un colis/carton sans poids indiqué. Ne mets packageContentUnit: "pièce" avec un packageContent numérique QUE lorsque la pièce elle-même a une taille fixe et connue (ex: "Plateau de 30" œufs → 30 œufs par plateau, un œuf est une unité fixe) — jamais pour approximer le poids d'un produit weighable.

RÈGLE STRICTE — POURCENTAGES : JAMAIS UNE QUANTITÉ NI UN CONDITIONNEMENT :
Un pourcentage affiché sur une ligne (ex: "5%", "VIANDE HACHÉE 5% MG", "LAIT 15% MG", "-10%") est TOUJOURS un descriptif du produit (taux de matière grasse, taux de sucre...) ou une remise commerciale — JAMAIS une quantité, un nombre de colis, ou un multiplicateur de conditionnement. Ne confonds jamais "5%" avec "x5" ou "5 unités" : ils n'ont rien à voir. Un pourcentage de type "% MG" (matière grasse) fait partie du nom du produit et doit rester dans "name" (ex: "VIANDE HACHÉE 5% MG" → name: "Viande hachée 5% MG", le taux change réellement le produit acheté, comme un mot de transformation). Un pourcentage négatif ou de remise (ex: "-5%", "-10%") suit la règle "LIGNES À NE JAMAIS INCLURE" ci-dessous, jamais utilisé comme packageCount ou packageContent.

COMMENT REMPLIR printedUnitPriceHT / printedPriceUnit :
Recopie le prix unitaire strictement tel qu'il est imprimé (ex: "0,94€/kg" → printedUnitPriceHT: 0.94, printedPriceUnit: "kg" ; "34,15€/U" → printedUnitPriceHT: 34.15, printedPriceUnit: "colis"). NE FAIS AUCUNE CONVERSION toi-même, ne divise rien — la conversion sera faite ensuite par un programme, pas par toi. Ton seul travail ici est de recopier fidèlement les nombres imprimés dans les bons champs.

CAS DES TICKETS DE CAISSE SIMPLES (sans détail de poids/conditionnement) :
Si le document ne montre qu'un nom et un prix total, sans aucune indication de poids, volume ou prix au kilo/litre, pour un produit normalement vendu au poids (ex: "TOMATES 2.30€" sans autre précision) : mets quand même printedUnitPriceHT au prix affiché et printedPriceUnit: "colis", mais packageContent: null (jamais 1 : ce n'est pas une valeur connue, ne l'invente pas), et mets bien weighable: true. Ne tente JAMAIS d'inventer un poids ou un prix au kilo que tu ne peux pas lire.

CAS FRÉQUENT — LA CONTENANCE EST ÉCRITE DANS LE TITRE ET LE PRIX EST "PAR PIÈCE" (PCE) :
Beaucoup de lignes indiquent la contenance directement dans le nom du produit (ex: "LAIT ENTIER UHT 1L", "EMMENTAL RAPE 1KG", "CREME UHT 35% 1L") avec un prix donné par pièce (PCE). Dans ce cas, 1 PCE correspond exactement à la contenance indiquée dans le titre : tu DOIS extraire ce chiffre en packageContent/packageContentUnit (ex: "1L" → packageContent: 1, packageContentUnit: "L"), même si ce chiffre est ensuite retiré du champ "name" nettoyé (voir NETTOYAGE DU NOM) — les deux extractions sont indépendantes, l'une n'efface pas l'autre. Ne renvoie JAMAIS packageContent: null dans ce cas précis : la contenance EST écrite sur la ligne, juste dans le titre plutôt que dans une mention "sac/bidon/carton" séparée.
Exemples : "LAIT ENTIER UHT 1L" + "36 PCE 1.12€" → packageContent: 1, packageContentUnit: "L", printedPriceUnit: "colis" → prix final 1.12€/L. "EMMENTAL RAPE 1KG" + "6 PCE 8.60€" → packageContent: 1, packageContentUnit: "kg" → prix final 8.60€/kg.

NETTOYAGE DU NOM (règle stricte pour le champ "name") :
Le champ "name" doit contenir le nom du produit tel qu'on l'achèterait, débarrassé du conditionnement et de la logistique — mais en GARDANT tout mot qui décrit une transformation/préparation changeant réellement le produit acheté (prix et usage différents). Retire systématiquement :
- Les conditionnements et unités : 2kg, 10kg, 1L, 5L, 75cl, sac, sachet, colis, carton, caisse, plateau, barquette, bidon, brique, PCE, CT, BT, U, x2, x6...
- Les mentions purement logistiques/cosmétiques qui ne changent PAS le produit : lavé(e), épluché(e), calibré(e), IQF, congelé(e)/surgelé(e)/FRS (conservation, sans lien avec le prix ou l'usage en cuisine).
- Les codes fournisseur, références internes et abréviations de gamme qui n'apportent aucune info utile pour identifier le produit en cuisine.
NE RETIRE JAMAIS un mot de transformation/préparation qui désigne un produit différent à acheter et à cuisiner : râpé(e), frit(e)/frite(s), haché(e), en dés, tranché(e), moulu(e), en poudre, concassé(e), mariné(e), fumé(e), pané(e), cru(e)/cuit(e), séché(e), confit(e), en bloc, désossé(e), filet (la découpe). Une pomme de terre frite n'est pas une pomme de terre ; un emmental râpé n'est pas un emmental en bloc — ce sont des achats différents pour un chef, garde toujours cette info. C'est une règle stricte, pas une suggestion : même sur une ligne par ailleurs déjà bien nettoyée, vérifie explicitement si le libellé d'origine contient un de ces mots avant de répondre, et si oui il DOIT figurer dans "name" — "cru"/"crue"/"cuit"/"cuite" sont particulièrement souvent oubliés par erreur, sois vigilant sur ces deux-là en particulier.
Exemples : "CAROTTE LAVEE 10KG" → name: "Carotte" ; "CAROTTE FRS 10KG" → name: "Carotte" ; "POULET FILET SURGELE CT 5KG" → name: "Filet de poulet" (la découpe "filet" reste, le conditionnement logistique part) ; "MOZZA BOULE 125G x12" → name: "Mozzarella" ; "EMMENTAL RAPE 1KG" → name: "Emmental râpé" ; "PDT FRITE 10MM SURG" → name: "Pomme de terre frite".
Simplifie aussi systématiquement les abréviations fournisseurs en noms clairs et complets (ex: "MOZZA" → "Mozzarella", "CR. LFF." → "Crème liquide"). Le champ rawLabel, lui, reste toujours intact et complet.

LIGNES À NE JAMAIS INCLURE DANS "items" (ce ne sont pas des produits achetés) :
Une facture contient souvent des lignes qui ne décrivent aucun produit : remise, escompte, ristourne, récapitulatif de TVA par taux (base HT / montant TVA par tranche), total HT, total TTC, net à payer, acompte, conditions de paiement, mentions légales. Traite ces lignes exactement comme une ligne illisible : NE LES INCLUS JAMAIS dans "items", quel que soit le montant ou le signe affiché à côté (y compris négatif). Ce sont des lignes de récapitulatif ou de règlement, pas des articles.
Important : "ne pas inclure" veut dire ABSENTE du tableau "items", pas présente avec des champs à null. Si tu hésites à exclure une ligne de ce type, rappelle-toi qu'un objet avec "name": null n'a aucune utilité et ne doit jamais apparaître dans "items" — retire-la complètement plutôt que de l'y laisser avec des valeurs vides.
ATTENTION PARTICULIÈRE — LE BLOC DE TOTAUX EN BAS DE PAGE (ex: "Total HT calculé sur les lignes ci-dessus — TVA selon taux en vigueur", "Net à payer : 204,76€") : ce bloc est UNE SEULE zone de texte récapitulatif, jamais une liste de produits. Ne le découpe JAMAIS en plusieurs lignes d'"items" séparées, même si des nombres y apparaissent qui ressemblent à des prix ou des quantités — ce ne sont que des totaux déjà calculés à partir des lignes du tableau au-dessus, jamais de nouveaux articles à ajouter. Si tu identifies un texte comme faisant partie de ce bloc de totaux, ignore-le entièrement pour "items", quelle que soit sa position sur l'image.

CONSIGNES ET FRAIS (règle stricte, distincte d'isFood) :
Une consigne (ex: "CONSIGNE FÛT BIÈRE 30L", "EMBALLAGE CASIER", "CONSIGNE PALETTE", et leurs équivalents espagnols "ENVASE RETORNABLE", "FIANZA", "CASCO"), des frais de port/livraison/transport, ou des frais de service NE SONT JAMAIS un achat d'ingrédient, même si leur libellé contient un mot alimentaire (ex: "bière" dans "CONSIGNE FÛT BIÈRE"). Pour ce type de ligne : isDeposit: true ET isFood: false, systématiquement — ne te laisse jamais influencer par un mot alimentaire présent dans le libellé d'une consigne ou de frais. Ces lignes restent dans "items" (avec leur prix TOUJOURS recopié s'il est lisible, pour que l'utilisateur puisse les consulter s'il le souhaite), elles sont juste marquées isFood: false / isDeposit: true plutôt que traitées comme un ingrédient de cuisine.
IMPORTANT — isDeposit N'EST JAMAIS UNE REMISE : une remise, un escompte, une ristourne ou une réduction commerciale (même à montant négatif) N'EST PAS une consigne. Ces lignes suivent la règle "LIGNES À NE JAMAIS INCLURE" ci-dessus : elles sont omises complètement de "items", jamais marquées isDeposit: true. Ne mélange jamais les deux catégories.

Autres règles :
- Si une ligne entière est trop floue/illisible pour être fiable, IGNORE-la simplement (ne l'inclus pas dans "items") plutôt que de bloquer toute la réponse.
- Pour un champ isolé illisible sur une ligne par ailleurs lisible, mets null pour ce champ uniquement (jamais de valeur inventée).
- Les prix sont toujours HT (hors taxes) si la facture les distingue, sinon utilise le prix affiché.
- N'invente aucune ligne qui n'est pas visible sur le document.
- Réponds TOUJOURS avec un JSON valide, même si l'image est floue, partiellement illisible ou de mauvaise qualité. Ne refuse jamais de répondre et n'ajoute aucun commentaire, explication ou avertissement en dehors du JSON.`;

  // Contenu du message envoyé à Claude : soit une image (+ éventuellement une transcription OCR
  // indépendante en indice), soit du texte natif déjà extrait d'un PDF numérique (pas de scan
  // d'image dans ce cas, le texte est directement fiable). L'OCR (moteur classique, pas une IA)
  // se trompe rarement sur le même chiffre que l'IA de vision — le lui donner en plus l'aide à se
  // corriger elle-même sans lui faire aveuglément confiance (l'image reste la référence en cas de
  // désaccord, précisé explicitement ci-dessous).
  const content = [];
  if (image) {
    content.push({ type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } });
    if (ocrText && ocrText.trim().length > 20) {
      content.push({
        type: "text",
        text: `Transcription OCR automatique de cette image, faite par un moteur classique indépendant de toi (peut contenir des erreurs) — sers-t'en pour confirmer un chiffre en cas de doute, mais l'image reste la référence en cas de désaccord entre les deux :\n\n${ocrText.trim().slice(0, 6000)}`,
      });
    }
  } else {
    content.push({
      type: "text",
      text: `Voici le texte numérique natif extrait d'un PDF de facture (pas une image scannée, texte fiable et complet, aucune lecture visuelle à faire) :\n\n${text.trim().slice(0, 12000)}`,
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
        // TEST TEMPORAIRE (2026-08) : bascule vers Sonnet pour vérifier si le décalage de
        // ligne observé sur les photos dégradées avec Haiku est une limite de capacité du
        // modèle. À revenir sur "claude-haiku-4-5-20251001" après le test, sauf décision
        // explicite de l'utilisateur de garder Sonnet (coût par scan nettement plus élevé).
        model: "claude-sonnet-5",
        // TEST : Sonnet 5 utilise par défaut la réflexion étendue ("thinking") sur ce point
        // d'accès — avec 8192 tokens le modèle épuisait tout le budget en réflexion sans
        // jamais produire de réponse (stop_reason "max_tokens", 0 tokens de texte). Budget
        // relevé pour laisser la place à la réflexion ET à la réponse JSON.
        max_tokens: 20000,
        // TEST TEMPORAIRE : "temperature" est refusé par Sonnet 5 sur ce point d'accès
        // ("deprecated for this model") — retiré le temps du test Sonnet. À remettre avec
        // Haiku (voir commentaire ci-dessus sur le modèle).
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(502).json({ error: "L'IA n'a pas pu traiter l'image.", detail });
    }

    const data = await response.json();
    // DEBUG TEMPORAIRE (test Sonnet) : visibilité sur ce que l'IA a réellement renvoyé quand
    // aucun bloc texte exploitable n'est trouvé, au lieu de silencieusement renvoyer {}.
    const textBlock = (data.content || []).find((c) => c.type === "text");
    if (!textBlock) {
      return res.status(502).json({
        error: "DEBUG: pas de bloc texte trouvé.",
        stop_reason: data.stop_reason,
        content_types: (data.content || []).map((c) => c.type),
        usage: data.usage,
      });
    }
    let raw = (textBlock?.text || "{}").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

    // Filet de sécurité : si l'IA a malgré tout ajouté du texte avant/après le JSON,
    // on ne garde que ce qu'il y a entre la première { et la dernière }.
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      raw = raw.slice(firstBrace, lastBrace + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return res.status(502).json({ error: "Réponse de l'IA illisible.", detail: raw ? raw.slice(0, 500) : "(réponse vide)" });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}