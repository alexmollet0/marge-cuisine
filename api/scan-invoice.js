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
      "name": "nom SIMPLIFIÉ et NORMALISÉ de l'ingrédient en français, ex: 'Crème liquide 35%' au lieu de 'CR. LFF. 35% BQ 1L'",
      "quantity": nombre,
      "unit": "kg" ou "L" ou "pièce",
      "unitPriceHT": nombre,
      "totalPriceHT": nombre
    }
  ]
}

Règles :
- Simplifie systématiquement les abréviations fournisseurs en noms clairs et courts.
- Si une valeur est illisible ou absente, mets null pour cette valeur (jamais de texte inventé).
- Les prix sont toujours HT (hors taxes) si la facture les distingue, sinon utilise le prix affiché.
- N'invente aucune ligne qui n'est pas visible sur le document.`;

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