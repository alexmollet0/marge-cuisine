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

  const { image, mediaType } = req.body || {};
  if (!image) {
    return res.status(400).json({ error: "Aucune image reçue." });
  }

  const prompt = `Tu es un assistant spécialisé dans la lecture de factures et bons de livraison fournisseurs pour la restauration.
Analyse l'image et réponds UNIQUEMENT avec un objet JSON valide (aucun texte avant/après, pas de balises markdown), au format exact :

{
  "supplier": "nom du fournisseur ou null",
  "date": "AAAA-MM-JJ ou null",
  "items": [
    {
      "rawLabel": "le texte EXACT et complet de la ligne tel qu'imprimé, SANS AUCUNE simplification (garde codes, abréviations, mentions de conditionnement)",
      "name": "nom PROPRE de l'ingrédient en français : juste la matière première, sans AUCUN conditionnement ni terme de traitement/état (voir règle NETTOYAGE DU NOM ci-dessous)",
      "packageCount": nombre de colis/unités achetés (le "x2", "x3" imprimé — PAS le poids total),
      "packageContent": nombre représentant le contenu d'UN SEUL colis dans packageContentUnit,
      "packageContentUnit": "kg" ou "L" ou "pièce",
      "weighable": true si ce type de produit se vend normalement au poids/volume en cuisine professionnelle (légumes, fruits, viande, poisson, fromage, farine, huile, vin, boissons vendues en bouteille/carton avec un volume indiqué...), false s'il se vend vraiment à l'unité entière et indivisible (œuf, boîte de conserve, plateau, sachet compté à la pièce...),
      "isFood": true si c'est un ingrédient de cuisine consommable (tout ce qui se mange ou se boit, y compris épices, condiments, boissons), false si c'est un article NON-alimentaire (produit d'entretien, lessive, papier cuisson/toilette, pics à brochette, serviettes jetables, gants, sacs poubelle, vaisselle jetable, éponges, matériel...) OU une consigne/frais (voir règle CONSIGNES ET FRAIS ci-dessous). En cas de doute réel sur un produit ambigu, mets true (mieux vaut le proposer en vérification que le perdre silencieusement).
      "isDeposit": true si la ligne est une consigne, un emballage consigné, des frais de port/livraison/transport, ou des frais de service (voir règle CONSIGNES ET FRAIS ci-dessous), false sinon,
      "printedUnitPriceHT": le prix unitaire EXACTEMENT tel qu'imprimé sur le document, sans aucun calcul,
      "printedPriceUnit": "kg" si le prix imprimé est déjà un prix au kilo, "L" si déjà au litre, "colis" s'il s'agit du prix d'un colis/pièce entière,
      "totalPriceHT": le prix total de la ligne tel qu'imprimé
    }
  ]
}

COMMENT REMPLIR packageContent / packageContentUnit (le point le plus important, lis bien) :
Chaque ligne de facture décrit un conditionnement entre parenthèses ou dans le libellé : "Sac 10kg", "Caisse 4kg", "Bidon 5L", "Plateau de 30", "Carton 6x75cl", "Plaque 2kg", "Filet 5kg", "Brick 1L", "Caisse 20pcs"...
- "Sac 10kg" → packageContent: 10, packageContentUnit: "kg"
- "Bidon 5L" → packageContent: 5, packageContentUnit: "L"
- "Plateau de 30" (œufs) → packageContent: 30, packageContentUnit: "pièce"
- "Carton 6x75cl" (bouteilles de vin) → packageContent: 4.5, packageContentUnit: "L" (6 × 0,75L, fais le calcul toi-même)
- "Caisse 20pcs" (pain) → packageContent: 20, packageContentUnit: "pièce"
- Si aucun conditionnement n'est précisé (produit vraiment vendu à l'unité simple, ex: 1 avocat) → packageContent: 1, packageContentUnit: "pièce"
Ne confonds JAMAIS packageCount (combien de colis on achète, le "x2") avec packageContent (combien contient UN colis, ex: 10kg) — ce sont deux nombres différents sur la même ligne.

RÈGLE UNIVERSELLE — QUAND LE POIDS/VOLUME DU COLIS N'EST ÉCRIT NULLE PART :
Certaines lignes donnent un prix par colis/carton/sac pour un produit normalement vendu au poids, SANS qu'aucun chiffre de poids ou volume n'apparaisse dans le libellé (ex: "PDT FRITE 10MM SURG — 8 COLIS — 17.40€" : "10MM" est une taille de découpe, pas un poids). Dans ce cas, tu DOIS impérativement renvoyer packageContent: null (jamais une estimation ou une valeur par défaut comme 1) — quel que soit le fournisseur, la mise en page ou le type de produit. C'est un principe général qui s'applique à TOUTE facture, pas seulement à cet exemple : si tu ne peux pas lire noir sur blanc le poids/volume réel d'UN colis, ne l'invente jamais.

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
NE RETIRE JAMAIS un mot de transformation/préparation qui désigne un produit différent à acheter et à cuisiner : râpé(e), frit(e)/frite(s), haché(e), en dés, tranché(e), moulu(e), en poudre, concassé(e), mariné(e), fumé(e), pané(e), cru(e)/cuit(e), séché(e), confit(e), en bloc, désossé(e), filet (la découpe). Une pomme de terre frite n'est pas une pomme de terre ; un emmental râpé n'est pas un emmental en bloc — ce sont des achats différents pour un chef, garde toujours cette info.
Exemples : "CAROTTE LAVEE 10KG" → name: "Carotte" ; "CAROTTE FRS 10KG" → name: "Carotte" ; "POULET FILET SURGELE CT 5KG" → name: "Filet de poulet" (la découpe "filet" reste, le conditionnement logistique part) ; "MOZZA BOULE 125G x12" → name: "Mozzarella" ; "EMMENTAL RAPE 1KG" → name: "Emmental râpé" ; "PDT FRITE 10MM SURG" → name: "Pomme de terre frite".
Simplifie aussi systématiquement les abréviations fournisseurs en noms clairs et complets (ex: "MOZZA" → "Mozzarella", "CR. LFF." → "Crème liquide"). Le champ rawLabel, lui, reste toujours intact et complet.

LIGNES À NE JAMAIS INCLURE DANS "items" (ce ne sont pas des produits achetés) :
Une facture contient souvent des lignes qui ne décrivent aucun produit : remise, escompte, ristourne, récapitulatif de TVA par taux (base HT / montant TVA par tranche), total HT, total TTC, net à payer, acompte, conditions de paiement, mentions légales. Traite ces lignes exactement comme une ligne illisible : NE LES INCLUS JAMAIS dans "items", quel que soit le montant ou le signe affiché à côté (y compris négatif). Ce sont des lignes de récapitulatif ou de règlement, pas des articles.

CONSIGNES ET FRAIS (règle stricte, distincte d'isFood) :
Une consigne (ex: "CONSIGNE FÛT BIÈRE 30L", "EMBALLAGE CASIER", "CONSIGNE PALETTE"), des frais de port/livraison/transport, ou des frais de service NE SONT JAMAIS un achat d'ingrédient, même si leur libellé contient un mot alimentaire (ex: "bière" dans "CONSIGNE FÛT BIÈRE"). Pour ce type de ligne : isDeposit: true ET isFood: false, systématiquement — ne te laisse jamais influencer par un mot alimentaire présent dans le libellé d'une consigne ou de frais. Ces lignes restent dans "items" (avec leur prix, pour que l'utilisateur puisse les consulter s'il le souhaite), elles sont juste marquées isFood: false / isDeposit: true plutôt que traitées comme un ingrédient de cuisine.

Autres règles :
- Si une ligne entière est trop floue/illisible pour être fiable, IGNORE-la simplement (ne l'inclus pas dans "items") plutôt que de bloquer toute la réponse.
- Pour un champ isolé illisible sur une ligne par ailleurs lisible, mets null pour ce champ uniquement (jamais de valeur inventée).
- Les prix sont toujours HT (hors taxes) si la facture les distingue, sinon utilise le prix affiché.
- N'invente aucune ligne qui n'est pas visible sur le document.
- Réponds TOUJOURS avec un JSON valide, même si l'image est floue, partiellement illisible ou de mauvaise qualité. Ne refuse jamais de répondre et n'ajoute aucun commentaire, explication ou avertissement en dehors du JSON.`;

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
        // Extraction structurée et déterministe (pas de rédaction créative) : on réduit la
        // variabilité d'une lecture à l'autre d'une même facture en fixant la température à 0.
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(502).json({ error: "L'IA n'a pas pu traiter l'image.", detail });
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((c) => c.type === "text");
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