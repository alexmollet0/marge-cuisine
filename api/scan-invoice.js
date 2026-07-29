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
      "name": "nom SIMPLIFIÉ et NORMALISÉ de l'ingrédient en français, ex: 'Crème liquide 35%' au lieu de 'CR. LFF. 35% BQ 1L'",
      "packageCount": nombre de colis/unités achetés (le "x2", "x3" imprimé — PAS le poids total),
      "packageContent": nombre représentant le contenu d'UN SEUL colis dans packageContentUnit,
      "packageContentUnit": "kg" ou "L" ou "pièce",
      "weighable": true si ce type de produit se vend normalement au poids/volume en cuisine professionnelle (légumes, fruits, viande, poisson, fromage, farine, huile, vin, boissons vendues en bouteille/carton avec un volume indiqué...), false s'il se vend vraiment à l'unité entière et indivisible (œuf, boîte de conserve, plateau, sachet compté à la pièce...),
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

COMMENT REMPLIR printedUnitPriceHT / printedPriceUnit :
Recopie le prix unitaire strictement tel qu'il est imprimé (ex: "0,94€/kg" → printedUnitPriceHT: 0.94, printedPriceUnit: "kg" ; "34,15€/U" → printedUnitPriceHT: 34.15, printedPriceUnit: "colis"). NE FAIS AUCUNE CONVERSION toi-même, ne divise rien — la conversion sera faite ensuite par un programme, pas par toi. Ton seul travail ici est de recopier fidèlement les nombres imprimés dans les bons champs.

CAS DES TICKETS DE CAISSE SIMPLES (sans détail de poids/conditionnement) :
Si le document ne montre qu'un nom et un prix total, sans aucune indication de poids, volume ou prix au kilo/litre, pour un produit normalement vendu au poids (ex: "TOMATES 2.30€" sans autre précision) : mets quand même printedUnitPriceHT au prix affiché et printedPriceUnit: "colis", packageContent: 1, packageContentUnit: "pièce", mais mets bien weighable: true. Ne tente JAMAIS d'inventer un poids ou un prix au kilo que tu ne peux pas lire.

Autres règles :
- Simplifie systématiquement les abréviations fournisseurs en noms clairs et courts pour le champ "name" (mais garde rawLabel intact).
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
        max_tokens: 2000,
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
    const raw = (textBlock?.text || "{}").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return res.status(502).json({ error: "Réponse de l'IA illisible.", raw });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}