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

  const prompt = `Tu es un assistant spécialisé dans la lecture de factures et tickets fournisseurs pour la restauration.
Analyse l'image et réponds UNIQUEMENT avec un objet JSON valide (aucun texte avant/après, pas de balises markdown), au format exact :

{
  "supplier": "nom du fournisseur ou null",
  "date": "AAAA-MM-JJ ou null",
  "items": [
    {
      "rawLabel": "le texte EXACT et complet de la ligne tel qu'imprimé sur le document, SANS AUCUNE simplification (garde les codes, abréviations, mentions de poids/volume comme '250G', '0.5KG', '75CL', '1.5L')",
      "name": "nom SIMPLIFIÉ et NORMALISÉ de l'ingrédient en français, ex: 'Crème liquide 35%' au lieu de 'CR. LFF. 35% BQ 1L'",
      "quantity": nombre,
      "unit": "kg" ou "L" ou "pièce",
      "unitPriceHT": nombre — DÉJÀ CONVERTI dans l'unité ci-dessus (voir règles de conversion ci-dessous),
      "totalPriceHT": nombre
    }
  ]
}

RÈGLES DE LECTURE DES COLONNES (très important, source d'erreurs fréquente) :
- Une ligne de facture a généralement 3 valeurs numériques distinctes : la QUANTITÉ achetée, le PRIX D'UNE UNITÉ, et le PRIX TOTAL de la ligne.
- Ne confonds JAMAIS le prix total avec un prix au kilo/litre. Vérifie toujours avec cette formule avant de répondre :
  quantité × prix unitaire ≈ prix total (à quelques centimes près).
  Exemple : "Filet de poulet — 6,2 kg — 11,00 €/kg — 68,20 €" → quantity: 6.2, unitPriceHT: 11.00, totalPriceHT: 68.20.
  Si tu ne vois qu'UNE SEULE valeur de prix sur la ligne (pas de distinction unité/total), et que tu connais la quantité, calcule le prix unitaire = prix affiché ÷ quantité plutôt que de recopier le prix affiché tel quel comme prix unitaire.
- Si après ton calcul la formule quantité × unitPriceHT ne correspond pas au totalPriceHT que tu as lu, refais le calcul : c'est signe que tu as confondu deux colonnes.

RÈGLES DE CONVERSION D'UNITÉ (très important, à appliquer systématiquement) :
1. Si le libellé mentionne un POIDS (g, gr, kg...) : unit = "kg" et unitPriceHT = prix payé ÷ poids en kg.
   Exemple : "Chicorée 250g à 3,09 €" → name: "Chicorée", unit: "kg", unitPriceHT: 12.36 (calcul : 3.09 / 0.25).
2. Si le libellé mentionne un VOLUME (cl, ml, L...) : unit = "L" et unitPriceHT = prix payé ÷ volume en litres.
   Exemple : "Huile d'olive 75cl à 9,00 €" → name: "Huile d'olive", unit: "L", unitPriceHT: 12.00 (calcul : 9.00 / 0.75).
3. Si AUCUN poids ni volume n'est mentionné (produit vraiment vendu à l'unité, ex: œuf, citron, avocat, burrata) : unit = "pièce", unitPriceHT = prix d'une pièce, sans conversion.
4. Si le prix est déjà affiché au kilo ou au litre sur le document (ex: "1,35 €/kg" imprimé), UTILISE TOUJOURS cette valeur imprimée telle quelle comme unitPriceHT — ne la recalcule JAMAIS à partir d'un total ou d'une quantité de colis/caisses, qui sont beaucoup moins fiables.
5. Si le produit est vendu par CONDITIONNEMENT GROUPÉ (caisse, carton, colis, lot, palette) sans poids ni prix au kilo visible : garde unit = "pièce" avec la quantité de colis/caisses et leur prix, SANS essayer de deviner un prix au kilo — tu n'as pas l'information nécessaire pour le calculer correctement.
Fais toujours le calcul toi-même avec précision (2 décimales) — ne laisse jamais un produit pesé/mesuré en "pièce" si un poids ou volume est visible.

Autres règles :
- Simplifie systématiquement les abréviations fournisseurs en noms clairs et courts.
- Si une ligne entière est trop floue/illisible pour être fiable, IGNORE-la simplement (ne l'inclus pas dans "items") plutôt que de bloquer toute la réponse.
- Pour un champ isolé illisible sur une ligne par ailleurs lisible, mets null pour ce champ uniquement (jamais de texte inventé).
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
        max_tokens: 1500,
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