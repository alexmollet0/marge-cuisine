// Traduction automatique de la description d'un plat pour la carte digitale (2026-08) — le
// restaurateur écrit une seule fois, dans sa propre langue, et cet endpoint remplit les deux
// autres (voir DigitalMenuModal, src/App.jsx). Authentifié (comme api/contact.js) : jamais appelé
// par un visiteur anonyme de la carte publique, uniquement par le compte propriétaire, pour ne
// jamais laisser n'importe qui consommer la clé Anthropic du projet.
import { requireUser } from "./_lib.js";

const LANG_NAMES = { fr: "français", es: "espagnol", en: "anglais" };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: "Non authentifié." });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Clé API manquante côté serveur (ANTHROPIC_API_KEY)." });
  }

  const { text, sourceLang } = req.body || {};
  if (!text || typeof text !== "string" || !LANG_NAMES[sourceLang]) {
    return res.status(400).json({ error: "Texte ou langue source manquant." });
  }

  const targets = Object.keys(LANG_NAMES).filter((l) => l !== sourceLang);
  const prompt = `Tu traduis la description d'un plat de restaurant, écrite en ${LANG_NAMES[sourceLang]}, vers ${targets.map((l) => LANG_NAMES[l]).join(" et ")}.
Texte source : "${text.trim().slice(0, 500)}"

Réponds UNIQUEMENT avec un objet JSON valide (aucun texte avant/après, pas de balises markdown), avec une clé par code langue cible (${targets.join(", ")}), chaque valeur étant la traduction naturelle et appétissante du texte, adaptée au vocabulaire de menu de restaurant (pas une traduction mot à mot mécanique). Reste concis, garde à peu près la même longueur que le texte source.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(502).json({ error: "L'IA n'a pas pu traduire ce texte.", detail });
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((c) => c.type === "text");
    let raw = (textBlock?.text || "{}").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) raw = raw.slice(firstBrace, lastBrace + 1);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return res.status(502).json({ error: "Réponse de l'IA illisible." });
    }

    const result = { [sourceLang]: text.trim() };
    targets.forEach((l) => { if (typeof parsed[l] === "string") result[l] = parsed[l]; });
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
