// Fonction serveur Vercel dédiée au scanner de fiche recette/technique existante — distincte de
// api/scan-invoice.js (autre besoin, autre prompt), pour ne jamais risquer de faire régresser le
// scanner de factures en le modifiant. Même principe d'exécution (clé API côté serveur uniquement).
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

RÈGLE — CONVERSION D'UNITÉS ET QUANTITÉS IMPRÉCISES :
- Convertis toujours les grammes en kg (divise par 1000, ex: "500g" → qty: 0.5, unit: "kg") et les millilitres en litres (divise par 1000, ex: "250ml" → qty: 0.25, unit: "L").
- Si la quantité est donnée dans une unité qui ne peut PAS être convertie avec certitude en poids/volume (cuillère à soupe/à café, pincée, "au goût", "un peu de", botte, gousse, branche, tranche, verre, sachet sans poids précisé...), ou si aucune quantité n'est écrite du tout pour cette ligne : mets qty: null et impreciseQuantity: true. N'invente JAMAIS une conversion approximative (ex: ne devine jamais combien pèse "une pincée" ou "une gousse") — mieux vaut laisser le champ vide que faux.
- Sinon (quantité déjà en kg/g/L/mL/pièce, ou un nombre de pièces claire comme "2 œufs"), remplis qty/unit normalement avec impreciseQuantity: false.

RÈGLE STRICTE — UN NOMBRE DE PIÈCES NE SUFFIT PAS POUR LA VIANDE/POISSON/FROMAGE/LÉGUME/LIQUIDE SANS POIDS ÉCRIT :
Pour tout ingrédient normalement vendu et facturé au poids ou au volume (viande, poisson, fromage, légume, liquide/sauce...), un simple nombre de pièces SANS aucun poids/volume écrit à côté (ex: "2 faux filets", "4 escalopes de poulet", "1 filet de saumon", "3 tomates" sans grammage) N'EST PAS une quantité utilisable — le poids réel d'une pièce est bien trop variable pour être deviné. Dans ce cas : qty: null, unit: null, impreciseQuantity: true, exactement comme pour une pincée ou une gousse. Ne renvoie "pièce" avec impreciseQuantity: false QUE pour un ingrédient réellement compté à l'unité fixe et non ambiguë (œuf, citron entier, boîte de conserve, sachet au poids imprimé...), jamais pour approximer le poids d'une portion de viande/poisson/fromage/légume.

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
      const detail = await response.text();
      return res.status(502).json({ error: "L'IA n'a pas pu traiter l'image.", detail });
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
      return res.status(502).json({ error: "Réponse de l'IA illisible.", detail: raw ? raw.slice(0, 500) : "(réponse vide)" });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
